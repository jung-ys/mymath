'use strict';

// 구구단 2~19단을 4단계로 구성.
// student.level 은 "현재 도전 중인 단계"를 의미한다 (1~4).
// 4단계 승급 시험까지 통과하면 level 은 5(마스터)가 된다.
const LEVELS = [
  { level: 1, title: '1단계', range: '2~5단', tables: [2, 3, 4, 5] },
  { level: 2, title: '2단계', range: '6~9단', tables: [6, 7, 8, 9] },
  { level: 3, title: '3단계', range: '10~14단', tables: [10, 11, 12, 13, 14] },
  { level: 4, title: '4단계', range: '15~19단', tables: [15, 16, 17, 18, 19] },
];

const MASTER_LEVEL = LEVELS.length + 1; // 5 = 전 단계 마스터

const EXAM_CONFIG = {
  questionCount: 20,
  timeLimitSec: 5 * 60, // 5분
  passScore: 18, // 20문제 중 18개(90%) 이상 정답
  graceSec: 15, // 시간 초과 판정 여유
};

const DAILY_TEST_CONFIG = {
  questionCount: 10,
  timeLimitSec: 3 * 60, // 3분
};

function getLevelDef(level) {
  return LEVELS.find((l) => l.level === level) || null;
}

function allTables() {
  const out = [];
  for (let t = 2; t <= 19; t++) out.push(t);
  return out;
}

// 학생이 오늘의 테스트에 사용할 단(段) 범위: 도전 중인 단계 + 이미 통과한 단계 전체 복습
function tablesForStudent(student) {
  if (student.level >= MASTER_LEVEL) return allTables();
  const upTo = LEVELS.filter((l) => l.level <= student.level);
  const set = new Set();
  upTo.forEach((l) => l.tables.forEach((t) => set.add(t)));
  return Array.from(set);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// tables 배열과 문항 수를 받아 {a, b, answer} 목록 생성. 중복을 최대한 피한다.
function generateProblems(tables, count) {
  const pairs = [];
  tables.forEach((t) => {
    for (let m = 1; m <= 9; m++) pairs.push([t, m]);
  });
  const shuffled = shuffle(pairs);
  const chosen = [];
  if (count <= shuffled.length) {
    chosen.push(...shuffled.slice(0, count));
  } else {
    // 문항 수가 조합 수보다 많으면 무작위 반복 허용
    while (chosen.length < count) {
      chosen.push(pairs[Math.floor(Math.random() * pairs.length)]);
    }
  }
  return shuffle(chosen).map(([a, b]) => ({ a, b, answer: a * b }));
}

function todayKST(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function daysBetween(dateStrA, dateStrB) {
  const a = new Date(dateStrA + 'T00:00:00Z');
  const b = new Date(dateStrB + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

module.exports = {
  LEVELS,
  MASTER_LEVEL,
  EXAM_CONFIG,
  DAILY_TEST_CONFIG,
  getLevelDef,
  allTables,
  tablesForStudent,
  generateProblems,
  todayKST,
  daysBetween,
};
