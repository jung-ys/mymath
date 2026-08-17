let summary = null;
let examState = null; // { kind, examId, problems, config, startTs, timerId, submitted }

const elLoading = qs('#loading');
const elDashboard = qs('#view-dashboard');
const elExam = qs('#view-exam');
const elResult = qs('#view-result');

qs('#logout-btn').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  location.href = '/index.html';
});

function showOnly(el) {
  [elLoading, elDashboard, elExam, elResult].forEach((x) => (x.style.display = x === el ? '' : 'none'));
}

async function init() {
  try {
    const me = await api('/api/me');
    if (!me.authed || me.type !== 'student') {
      location.href = '/index.html';
      return;
    }
    qs('#who').textContent = me.student.name + ' 님';
    await loadSummary();
  } catch (ex) {
    location.href = '/index.html';
  }
}

async function loadSummary() {
  summary = await api('/api/student/summary');
  renderDashboard();
}

function levelUpNoteHtml() {
  return `<p class="muted" style="font-size:0.85rem">승급 시험을 통과하면 다음 단계로 올라가요. 선생님께 알려서 셀레나 달러와 간식 쿠폰을 받으세요! 🎉</p>`;
}

function renderDashboard() {
  const { student, dailyTest, levelExam, history, levels, masterLevel } = summary;
  const badgeClass = levelBadgeClass(student.level, masterLevel);

  let levelExamCard;
  if (!levelExam.available && student.isMaster) {
    levelExamCard = `
      <div class="card">
        <h2 class="mt0">🏆 승급 시험</h2>
        <p>모든 단계(2단~19단)를 마스터했어요! 대단해요!</p>
      </div>`;
  } else {
    const ld = levelExam.levelDef;
    const disabled = !levelExam.available ? 'disabled' : '';
    const note = levelExam.attemptedToday
      ? `<p class="muted" style="font-size:0.85rem">오늘은 이미 응시했어요. 내일 다시 도전할 수 있어요.</p>`
      : `<p class="muted" style="font-size:0.85rem">${levelExam.config.questionCount}문제 중 ${levelExam.config.passScore}개 이상, 제한시간 ${Math.floor(levelExam.config.timeLimitSec / 60)}분 안에 풀면 통과!</p>`;
    levelExamCard = `
      <div class="card">
        <h2 class="mt0">🏆 ${ld.title} 승급 시험 <span class="tag">${ld.range}</span></h2>
        ${note}
        <button class="btn" id="start-level-exam" ${disabled}>승급 시험 시작</button>
        ${levelUpNoteHtml()}
      </div>`;
  }

  const dailyCard = dailyTest.taken
    ? `
      <div class="card">
        <h2 class="mt0">📅 오늘의 테스트</h2>
        <div class="result-banner ${dailyTest.result.score === dailyTest.result.total ? 'pass' : ''}" style="padding:16px;">
          <div class="score">${dailyTest.result.score} / ${dailyTest.result.total}</div>
          <p class="muted" style="margin:4px 0 0">오늘 테스트를 완료했어요. 내일 또 도전하세요!</p>
        </div>
      </div>`
    : `
      <div class="card">
        <h2 class="mt0">📅 오늘의 테스트</h2>
        <p class="muted" style="font-size:0.85rem">${dailyTest.config.questionCount}문제, 제한시간 ${Math.floor(dailyTest.config.timeLimitSec / 60)}분. 지금까지 배운 단을 복습해요.</p>
        <button class="btn" id="start-daily-test">오늘의 테스트 시작</button>
      </div>`;

  const historyRows = mergeHistory(history)
    .map(
      (h) => `
      <tr>
        <td>${h.typeLabel}</td>
        <td>${h.dateLabel}</td>
        <td>${h.score}/${h.total}</td>
        <td>${h.passed === null ? '-' : `<span class="pill ${h.passed ? 'pass' : 'fail'}">${h.passed ? '통과' : '미통과'}</span>`}</td>
      </tr>`
    )
    .join('');

  elDashboard.innerHTML = `
    <div class="card flex-between">
      <div>
        <span class="badge ${badgeClass}">${student.levelTitle}</span>
        <div class="stat-row">
          <div class="stat"><div class="num">${student.streak}</div><div class="label">연속 출석일</div></div>
          <div class="stat"><div class="num">${history.levelUps.length}</div><div class="label">누적 레벨업</div></div>
        </div>
      </div>
    </div>
    <div class="grid-2">
      ${dailyCard}
      ${levelExamCard}
    </div>
    <div class="card">
      <h2 class="mt0">최근 기록</h2>
      ${historyRows ? `<table><thead><tr><th>종류</th><th>날짜</th><th>점수</th><th>결과</th></tr></thead><tbody>${historyRows}</tbody></table>` : '<p class="muted">아직 기록이 없어요. 오늘의 테스트부터 시작해보세요!</p>'}
    </div>
  `;

  showOnly(elDashboard);

  const dailyBtn = qs('#start-daily-test');
  if (dailyBtn) dailyBtn.addEventListener('click', () => startExam('daily'));
  const levelBtn = qs('#start-level-exam');
  if (levelBtn) levelBtn.addEventListener('click', () => startExam('level'));
}

function mergeHistory(history) {
  const daily = history.daily.map((d) => ({
    typeLabel: '오늘의 테스트',
    dateLabel: fmtDateOnly(d.date),
    score: d.score,
    total: d.total,
    passed: null,
    ts: d.takenAt,
  }));
  const level = history.levelExams.map((e) => ({
    typeLabel: `${e.level}단계 승급시험`,
    dateLabel: fmtDateOnly(e.date),
    score: e.score,
    total: e.total,
    passed: e.passed,
    ts: e.takenAt,
  }));
  return daily.concat(level).sort((a, b) => b.ts - a.ts).slice(0, 12);
}

async function startExam(kind) {
  try {
    const data = await api(kind === 'daily' ? '/api/daily-test/start' : '/api/level-exam/start', { method: 'POST' });
    examState = {
      kind,
      examId: data.examId,
      problems: data.problems,
      config: data.config,
      levelDef: data.levelDef,
      startTs: Date.now(),
      submitted: false,
    };
    renderExam();
  } catch (ex) {
    alert(ex.message);
    if (ex.status === 409) loadSummary();
  }
}

function renderExam() {
  const { kind, problems, config, levelDef } = examState;
  const title = kind === 'daily' ? '📅 오늘의 테스트' : `🏆 ${levelDef ? levelDef.title + ' 승급 시험' : '승급 시험'}`;
  const problemsHtml = problems
    .map(
      (p, i) => `
      <div class="problem" id="p-${i}">
        <span class="idx">${i + 1}</span>
        <span>${p.a} &times; ${p.b} =</span>
        <input type="number" inputmode="numeric" data-idx="${i}" class="ans-input" />
      </div>`
    )
    .join('');

  elExam.innerHTML = `
    <h2 class="mt0">${title}</h2>
    <div class="timer" id="timer-display">--:--</div>
    <div class="progress-track"><div class="progress-fill" id="timer-fill" style="width:100%"></div></div>
    <div class="problem-grid">${problemsHtml}</div>
    <button class="btn" id="submit-exam-btn" style="width:100%">제출하기</button>
  `;
  showOnly(elExam);

  qs('#submit-exam-btn').addEventListener('click', () => submitExam(false));
  const firstInput = qs('.ans-input');
  if (firstInput) firstInput.focus();

  const inputs = qsa('.ans-input');
  inputs.forEach((inp, i) => {
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const next = inputs[i + 1];
        if (next) next.focus();
        else submitExam(false);
      }
    });
  });

  examState.timerId = setInterval(tickTimer, 250);
  tickTimer();
}

function tickTimer() {
  if (!examState || examState.submitted) return;
  const elapsedMs = Date.now() - examState.startTs;
  const remaining = Math.max(0, examState.config.timeLimitSec - Math.floor(elapsedMs / 1000));
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const disp = qs('#timer-display');
  const fill = qs('#timer-fill');
  if (disp) disp.textContent = `${mm}:${ss}`;
  if (fill) fill.style.width = `${(remaining / examState.config.timeLimitSec) * 100}%`;
  if (remaining <= 30 && disp) disp.style.color = 'var(--bad)';
  if (remaining <= 0) {
    submitExam(true);
  }
}

async function submitExam(timedOut) {
  if (!examState || examState.submitted) return;
  examState.submitted = true;
  clearInterval(examState.timerId);

  const answers = examState.problems.map((_, i) => {
    const inp = qs(`.ans-input[data-idx="${i}"]`);
    const v = inp ? inp.value.trim() : '';
    return v === '' ? null : Number(v);
  });
  const elapsedSec = Math.round((Date.now() - examState.startTs) / 1000);

  try {
    const endpoint = examState.kind === 'daily' ? '/api/daily-test/submit' : '/api/level-exam/submit';
    const data = await api(endpoint, {
      method: 'POST',
      body: { examId: examState.examId, answers, elapsedSec },
    });
    renderResult(data, timedOut);
  } catch (ex) {
    alert(ex.message);
    loadSummary();
  }
}

function renderResult(data, timedOut) {
  const result = data.result;
  const isLevel = 'passed' in result;
  const detail = result.detail || [];

  const detailHtml = detail
    .map(
      (d, i) => `
      <div class="problem ${d.correct ? 'correct' : 'wrong'}">
        <span class="idx">${i + 1}</span>
        <span>${d.a} &times; ${d.b} = ${d.answer}</span>
        ${d.correct ? '' : `<span class="ans-key">내 답: ${d.given === null ? '(공백)' : d.given}</span>`}
      </div>`
    )
    .join('');

  let banner;
  if (isLevel) {
    const passed = result.passed;
    banner = `
      <div class="result-banner ${passed ? 'pass' : 'fail'}">
        <div class="confetti">${passed ? '🎉🏆🎉' : '💪'}</div>
        <h2>${passed ? '축하해요! 승급 성공!' : '아쉬워요, 다음에 다시 도전!'}</h2>
        <div class="score">${result.score} / ${result.total}</div>
        ${timedOut ? '<p class="muted">시간 초과로 자동 제출되었어요.</p>' : ''}
        ${passed ? `<p>선생님께 말씀드리고 <strong>셀레나 달러</strong>와 <strong>간식 쿠폰</strong>을 받아가세요! 🍬</p>` : `<p class="muted">내일 다시 응시할 수 있어요. 오늘의 테스트로 연습해봐요!</p>`}
      </div>`;
  } else {
    banner = `
      <div class="result-banner pass">
        <div class="confetti">✏️</div>
        <h2>오늘의 테스트 완료!</h2>
        <div class="score">${result.score} / ${result.total}</div>
        <p>연속 출석 <strong>${data.streak}일째</strong> 🔥</p>
      </div>`;
  }

  elResult.innerHTML = `
    ${banner}
    <div class="card">
      <h2 class="mt0">채점 결과</h2>
      <div class="problem-grid">${detailHtml}</div>
      <button class="btn" id="back-to-dashboard" style="width:100%">확인</button>
    </div>
  `;
  showOnly(elResult);
  qs('#back-to-dashboard').addEventListener('click', async () => {
    await loadSummary();
  });
}

init();
