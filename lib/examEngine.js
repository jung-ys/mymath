'use strict';

const { randomToken } = require('./auth');
const { generateProblems } = require('./levels');

// examId -> { studentId, kind: 'daily'|'level', level, problems: [{a,b,answer}], createdAt }
const pending = new Map();
const PENDING_TTL_MS = 30 * 60 * 1000; // 30분 지나면 만료

function cleanup() {
  const now = Date.now();
  for (const [key, val] of pending) {
    if (now - val.createdAt > PENDING_TTL_MS) pending.delete(key);
  }
}

function start({ studentId, kind, level, tables, count }) {
  cleanup();
  const problems = generateProblems(tables, count);
  const examId = randomToken();
  pending.set(examId, { studentId, kind, level, problems, createdAt: Date.now() });
  // 클라이언트에는 정답을 제외한 문제만 전달
  const publicProblems = problems.map(({ a, b }) => ({ a, b }));
  return { examId, problems: publicProblems };
}

function take(examId, studentId) {
  const entry = pending.get(examId);
  if (!entry) return null;
  if (entry.studentId !== studentId) return null;
  return entry;
}

function finish(examId) {
  pending.delete(examId);
}

module.exports = { start, take, finish };
