'use strict';

const db = require('./db');
const session = require('./session');
const { hashSecret, verifySecret } = require('./auth');
const exam = require('./examEngine');
const {
  LEVELS,
  MASTER_LEVEL,
  EXAM_CONFIG,
  DAILY_TEST_CONFIG,
  getLevelDef,
  tablesForStudent,
  todayKST,
  daysBetween,
} = require('./levels');

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1e6) {
        reject(Object.assign(new Error('payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(Object.assign(new Error('invalid json'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function getSession(req) {
  const cookies = session.parseCookies(req);
  return { token: cookies.sid, data: session.get(cookies.sid) };
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', session.cookieHeader('sid', token, { maxAge: 12 * 60 * 60 }));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', session.cookieHeader('sid', '', { expirePast: true }));
}

function findStudent(id) {
  return db.raw.students.find((s) => s.id === id) || null;
}

function findStudentByName(name) {
  const norm = String(name).trim().toLowerCase();
  return db.raw.students.find((s) => s.name.trim().toLowerCase() === norm) || null;
}

function publicStudent(s) {
  const levelDef = getLevelDef(s.level);
  return {
    id: s.id,
    name: s.name,
    level: s.level,
    levelTitle: s.level >= MASTER_LEVEL ? '마스터' : levelDef ? `${levelDef.title} (${levelDef.range})` : '-',
    isMaster: s.level >= MASTER_LEVEL,
    streak: s.streak || 0,
    lastDailyTestDate: s.lastDailyTestDate || null,
    createdAt: s.createdAt,
  };
}

function todayStats(studentId) {
  const today = todayKST();
  const dailyDone = db.raw.dailyTests.find((t) => t.studentId === studentId && t.date === today) || null;
  return { today, dailyDone };
}

function levelExamAttemptToday(studentId, level) {
  const today = todayKST();
  return db.raw.levelExams.find((e) => e.studentId === studentId && e.level === level && e.date === today) || null;
}

function studentHistory(studentId, limit = 20) {
  const daily = db.raw.dailyTests
    .filter((t) => t.studentId === studentId)
    .sort((a, b) => b.takenAt - a.takenAt)
    .slice(0, limit);
  const levelExams = db.raw.levelExams
    .filter((e) => e.studentId === studentId)
    .sort((a, b) => b.takenAt - a.takenAt)
    .slice(0, limit);
  const levelUps = db.raw.levelUps
    .filter((u) => u.studentId === studentId)
    .sort((a, b) => b.awardedAt - a.awardedAt);
  return { daily, levelExams, levelUps };
}

function studentSummary(s) {
  const { today, dailyDone } = todayStats(s.id);
  const levelDef = getLevelDef(s.level);
  const isMaster = s.level >= MASTER_LEVEL;
  const attemptToday = isMaster ? null : levelExamAttemptToday(s.id, s.level);
  return {
    student: publicStudent(s),
    today,
    levels: LEVELS,
    masterLevel: MASTER_LEVEL,
    dailyTest: {
      taken: !!dailyDone,
      result: dailyDone,
      config: DAILY_TEST_CONFIG,
    },
    levelExam: isMaster
      ? { available: false, reason: '모든 단계를 마스터했습니다!' }
      : {
          available: !attemptToday,
          attemptedToday: !!attemptToday,
          lastAttemptToday: attemptToday,
          levelDef,
          config: EXAM_CONFIG,
        },
    history: studentHistory(s.id, 10),
  };
}

// ---- 라우트 핸들러들 ----

const routes = [];
function route(method, pattern, handler) {
  const keys = [];
  const regex = new RegExp(
    '^' +
      pattern.replace(/:[^/]+/g, (m) => {
        keys.push(m.slice(1));
        return '([^/]+)';
      }) +
      '$'
  );
  routes.push({ method, regex, keys, handler });
}

// ---------- 공개 ----------

route('GET', '/api/board', async (req, res) => {
  const students = db.raw.students
    .slice()
    .sort((a, b) => b.level - a.level || (a.name > b.name ? 1 : -1))
    .map(publicStudent);
  const since = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const recentLevelUps = db.raw.levelUps
    .filter((u) => u.awardedAt >= since)
    .sort((a, b) => b.awardedAt - a.awardedAt)
    .map((u) => {
      const st = findStudent(u.studentId);
      const levelDef = getLevelDef(u.level);
      return {
        studentName: st ? st.name : '(삭제된 학생)',
        level: u.level,
        levelTitle: levelDef ? `${levelDef.title} (${levelDef.range})` : `${u.level}단계`,
        awardedAt: u.awardedAt,
        rewardGiven: !!u.rewardGiven,
      };
    });
  const today = todayKST();
  const todayDailyCount = db.raw.dailyTests.filter((t) => t.date === today).length;
  sendJson(res, 200, { levels: LEVELS, students, recentLevelUps, todayDailyCount, masterLevel: MASTER_LEVEL });
});

// ---------- 인증 ----------

route('GET', '/api/admin/status', async (req, res) => {
  sendJson(res, 200, { initialized: !!db.raw.admin.passwordHash });
});

route('POST', '/api/admin/setup', async (req, res, params, body) => {
  if (db.raw.admin.passwordHash) {
    return sendJson(res, 409, { error: '이미 관리자 비밀번호가 설정되어 있습니다.' });
  }
  const password = String(body.password || '');
  if (password.length < 4) return sendJson(res, 400, { error: '비밀번호는 4자 이상이어야 합니다.' });
  db.raw.admin.passwordHash = hashSecret(password);
  db.persist();
  const token = session.create({ type: 'admin' });
  setSessionCookie(res, token);
  sendJson(res, 200, { ok: true });
});

route('POST', '/api/admin/login', async (req, res, params, body) => {
  const password = String(body.password || '');
  if (!verifySecret(password, db.raw.admin.passwordHash)) {
    return sendJson(res, 401, { error: '비밀번호가 올바르지 않습니다.' });
  }
  const token = session.create({ type: 'admin' });
  setSessionCookie(res, token);
  sendJson(res, 200, { ok: true });
});

route('POST', '/api/login', async (req, res, params, body) => {
  const name = String(body.name || '').trim();
  const pin = String(body.pin || '').trim();
  if (!name || !pin) return sendJson(res, 400, { error: '이름과 비밀번호를 입력해주세요.' });
  const student = findStudentByName(name);
  if (!student || !verifySecret(pin, student.pinHash)) {
    return sendJson(res, 401, { error: '이름 또는 비밀번호가 올바르지 않습니다.' });
  }
  const token = session.create({ type: 'student', studentId: student.id });
  setSessionCookie(res, token);
  sendJson(res, 200, { ok: true, student: publicStudent(student) });
});

route('POST', '/api/logout', async (req, res) => {
  const { token } = getSession(req);
  if (token) session.destroy(token);
  clearSessionCookie(res);
  sendJson(res, 200, { ok: true });
});

route('GET', '/api/me', async (req, res) => {
  const { data } = getSession(req);
  if (!data) return sendJson(res, 200, { authed: false });
  if (data.type === 'admin') return sendJson(res, 200, { authed: true, type: 'admin' });
  const student = findStudent(data.studentId);
  if (!student) return sendJson(res, 200, { authed: false });
  sendJson(res, 200, { authed: true, type: 'student', student: publicStudent(student) });
});

// ---------- 인증 가드 ----------

function requireStudent(handler) {
  return async (req, res, params, body) => {
    const { data } = getSession(req);
    if (!data || data.type !== 'student') return sendJson(res, 401, { error: '로그인이 필요합니다.' });
    const student = findStudent(data.studentId);
    if (!student) return sendJson(res, 401, { error: '학생 정보를 찾을 수 없습니다.' });
    return handler(req, res, params, body, student);
  };
}

function requireAdmin(handler) {
  return async (req, res, params, body) => {
    const { data } = getSession(req);
    if (!data || data.type !== 'admin') return sendJson(res, 401, { error: '관리자 로그인이 필요합니다.' });
    return handler(req, res, params, body);
  };
}

// ---------- 학생 ----------

route('GET', '/api/student/summary', requireStudent(async (req, res, params, body, student) => {
  sendJson(res, 200, studentSummary(student));
}));

route('POST', '/api/daily-test/start', requireStudent(async (req, res, params, body, student) => {
  const { dailyDone } = todayStats(student.id);
  if (dailyDone) return sendJson(res, 409, { error: '오늘의 테스트는 이미 완료했습니다.', result: dailyDone });
  const tables = tablesForStudent(student);
  const { examId, problems } = exam.start({
    studentId: student.id,
    kind: 'daily',
    level: student.level,
    tables,
    count: DAILY_TEST_CONFIG.questionCount,
  });
  sendJson(res, 200, { examId, problems, config: DAILY_TEST_CONFIG });
}));

route('POST', '/api/daily-test/submit', requireStudent(async (req, res, params, body, student) => {
  const { examId, answers, elapsedSec } = body;
  const pendingExam = exam.take(examId, student.id);
  if (!pendingExam || pendingExam.kind !== 'daily') {
    return sendJson(res, 400, { error: '유효하지 않거나 만료된 시험입니다. 다시 시작해주세요.' });
  }
  const { dailyDone } = todayStats(student.id);
  if (dailyDone) {
    exam.finish(examId);
    return sendJson(res, 409, { error: '오늘의 테스트는 이미 완료했습니다.', result: dailyDone });
  }
  const total = pendingExam.problems.length;
  const ansArr = Array.isArray(answers) ? answers : [];
  let score = 0;
  const detail = pendingExam.problems.map((p, i) => {
    const given = Number(ansArr[i]);
    const correct = given === p.answer;
    if (correct) score++;
    return { a: p.a, b: p.b, answer: p.answer, given: Number.isFinite(given) ? given : null, correct };
  });
  const today = todayKST();
  const record = {
    id: db.id(),
    studentId: student.id,
    date: today,
    score,
    total,
    takenAt: Date.now(),
    elapsedSec: Number(elapsedSec) || null,
    detail,
  };
  db.raw.dailyTests.push(record);

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const yStr = todayKST(yesterday);
  if (student.lastDailyTestDate === today) {
    // no-op safety
  } else if (student.lastDailyTestDate === yStr) {
    student.streak = (student.streak || 0) + 1;
  } else {
    student.streak = 1;
  }
  student.lastDailyTestDate = today;

  exam.finish(examId);
  db.persist();
  sendJson(res, 200, { result: record, streak: student.streak });
}));

route('POST', '/api/level-exam/start', requireStudent(async (req, res, params, body, student) => {
  if (student.level >= MASTER_LEVEL) {
    return sendJson(res, 409, { error: '이미 모든 단계를 마스터했습니다.' });
  }
  if (levelExamAttemptToday(student.id, student.level)) {
    return sendJson(res, 409, { error: '오늘은 이미 이 단계 승급 시험에 응시했습니다. 내일 다시 도전해주세요.' });
  }
  const levelDef = getLevelDef(student.level);
  const { examId, problems } = exam.start({
    studentId: student.id,
    kind: 'level',
    level: student.level,
    tables: levelDef.tables,
    count: EXAM_CONFIG.questionCount,
  });
  sendJson(res, 200, { examId, problems, config: EXAM_CONFIG, levelDef });
}));

route('POST', '/api/level-exam/submit', requireStudent(async (req, res, params, body, student) => {
  const { examId, answers, elapsedSec } = body;
  const pendingExam = exam.take(examId, student.id);
  if (!pendingExam || pendingExam.kind !== 'level') {
    return sendJson(res, 400, { error: '유효하지 않거나 만료된 시험입니다. 다시 시작해주세요.' });
  }
  if (pendingExam.level !== student.level) {
    exam.finish(examId);
    return sendJson(res, 400, { error: '단계 정보가 일치하지 않습니다. 다시 시작해주세요.' });
  }
  if (levelExamAttemptToday(student.id, student.level)) {
    exam.finish(examId);
    return sendJson(res, 409, { error: '오늘은 이미 이 단계 승급 시험에 응시했습니다.' });
  }

  const total = pendingExam.problems.length;
  const ansArr = Array.isArray(answers) ? answers : [];
  let score = 0;
  const detail = pendingExam.problems.map((p, i) => {
    const given = Number(ansArr[i]);
    const correct = given === p.answer;
    if (correct) score++;
    return { a: p.a, b: p.b, answer: p.answer, given: Number.isFinite(given) ? given : null, correct };
  });

  const elapsed = Number(elapsedSec) || 0;
  const timedOut = elapsed > EXAM_CONFIG.timeLimitSec + EXAM_CONFIG.graceSec;
  const passed = score >= EXAM_CONFIG.passScore && !timedOut;

  const today = todayKST();
  const record = {
    id: db.id(),
    studentId: student.id,
    level: student.level,
    score,
    total,
    passed,
    timedOut,
    date: today,
    takenAt: Date.now(),
    elapsedSec: elapsed,
    detail,
  };
  db.raw.levelExams.push(record);

  let leveledUp = false;
  let newLevelDef = null;
  if (passed) {
    const completedLevel = student.level;
    student.level = completedLevel + 1;
    db.raw.levelUps.push({
      id: db.id(),
      studentId: student.id,
      level: completedLevel,
      awardedAt: Date.now(),
      rewardGiven: false,
      rewardNote: '',
    });
    leveledUp = true;
    newLevelDef = student.level >= MASTER_LEVEL ? null : getLevelDef(student.level);
  }

  exam.finish(examId);
  db.persist();
  sendJson(res, 200, {
    result: record,
    leveledUp,
    isMaster: student.level >= MASTER_LEVEL,
    newLevel: student.level,
    newLevelDef,
  });
}));

// ---------- 관리자 ----------

route('GET', '/api/admin/students', requireAdmin(async (req, res) => {
  const list = db.raw.students
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    .map((s) => {
      const { dailyDone } = todayStats(s.id);
      return { ...publicStudent(s), todayDone: !!dailyDone };
    });
  sendJson(res, 200, { students: list, levels: LEVELS, masterLevel: MASTER_LEVEL });
}));

route('POST', '/api/admin/students', requireAdmin(async (req, res, params, body) => {
  const name = String(body.name || '').trim();
  const pin = String(body.pin || '').trim();
  const startLevel = Number(body.startLevel) || 1;
  if (!name) return sendJson(res, 400, { error: '이름을 입력해주세요.' });
  if (!/^\d{4,6}$/.test(pin)) return sendJson(res, 400, { error: '비밀번호(PIN)는 4~6자리 숫자로 입력해주세요.' });
  if (findStudentByName(name)) return sendJson(res, 409, { error: '이미 같은 이름의 학생이 있습니다.' });
  if (startLevel < 1 || startLevel > MASTER_LEVEL) return sendJson(res, 400, { error: '유효하지 않은 시작 단계입니다.' });
  const student = {
    id: db.id(),
    name,
    pinHash: hashSecret(pin),
    level: startLevel,
    streak: 0,
    lastDailyTestDate: null,
    createdAt: Date.now(),
  };
  db.raw.students.push(student);
  db.persist();
  sendJson(res, 201, { student: publicStudent(student) });
}));

route('GET', '/api/admin/students/:id', requireAdmin(async (req, res, params) => {
  const student = findStudent(params.id);
  if (!student) return sendJson(res, 404, { error: '학생을 찾을 수 없습니다.' });
  sendJson(res, 200, studentSummary(student));
}));

route('POST', '/api/admin/students/:id/reset-pin', requireAdmin(async (req, res, params, body) => {
  const student = findStudent(params.id);
  if (!student) return sendJson(res, 404, { error: '학생을 찾을 수 없습니다.' });
  const pin = String(body.pin || '').trim();
  if (!/^\d{4,6}$/.test(pin)) return sendJson(res, 400, { error: '비밀번호(PIN)는 4~6자리 숫자로 입력해주세요.' });
  student.pinHash = hashSecret(pin);
  db.persist();
  sendJson(res, 200, { ok: true });
}));

route('POST', '/api/admin/students/:id/adjust-level', requireAdmin(async (req, res, params, body) => {
  const student = findStudent(params.id);
  if (!student) return sendJson(res, 404, { error: '학생을 찾을 수 없습니다.' });
  const level = Number(body.level);
  if (!Number.isInteger(level) || level < 1 || level > MASTER_LEVEL) {
    return sendJson(res, 400, { error: '유효하지 않은 단계입니다.' });
  }
  student.level = level;
  db.persist();
  sendJson(res, 200, { student: publicStudent(student) });
}));

route('DELETE', '/api/admin/students/:id', requireAdmin(async (req, res, params) => {
  const idx = db.raw.students.findIndex((s) => s.id === params.id);
  if (idx === -1) return sendJson(res, 404, { error: '학생을 찾을 수 없습니다.' });
  db.raw.students.splice(idx, 1);
  db.raw.dailyTests = db.raw.dailyTests.filter((t) => t.studentId !== params.id);
  db.raw.levelExams = db.raw.levelExams.filter((e) => e.studentId !== params.id);
  db.raw.levelUps = db.raw.levelUps.filter((u) => u.studentId !== params.id);
  db.persist();
  sendJson(res, 200, { ok: true });
}));

route('GET', '/api/admin/level-ups', requireAdmin(async (req, res) => {
  const list = db.raw.levelUps
    .slice()
    .sort((a, b) => b.awardedAt - a.awardedAt)
    .map((u) => {
      const st = findStudent(u.studentId);
      const levelDef = getLevelDef(u.level);
      return {
        id: u.id,
        studentId: u.studentId,
        studentName: st ? st.name : '(삭제된 학생)',
        level: u.level,
        levelTitle: levelDef ? `${levelDef.title} (${levelDef.range})` : `${u.level}단계`,
        awardedAt: u.awardedAt,
        rewardGiven: !!u.rewardGiven,
        rewardNote: u.rewardNote || '',
      };
    });
  sendJson(res, 200, { levelUps: list });
}));

route('POST', '/api/admin/level-ups/:id/reward', requireAdmin(async (req, res, params, body) => {
  const entry = db.raw.levelUps.find((u) => u.id === params.id);
  if (!entry) return sendJson(res, 404, { error: '기록을 찾을 수 없습니다.' });
  entry.rewardGiven = !!body.rewardGiven;
  entry.rewardNote = String(body.note || '').slice(0, 200);
  db.persist();
  sendJson(res, 200, { ok: true });
}));

// ---------- 디스패치 ----------

async function handleApi(req, res, pathname, query) {
  const method = req.method;
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = pathname.match(r.regex);
    if (!m) continue;
    const params = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    let body = {};
    if (method === 'POST' || method === 'PUT') {
      try {
        body = await readBody(req);
      } catch (err) {
        sendJson(res, err.status || 400, { error: '잘못된 요청입니다.' });
        return true;
      }
    }
    try {
      await r.handler(req, res, params, body, query);
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { error: '서버 오류가 발생했습니다.' });
    }
    return true;
  }
  return false;
}

module.exports = { handleApi };
