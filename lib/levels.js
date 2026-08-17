'use strict';

// 구구단 2~19단을 4단계로 구성.
// student.level 은 "현재 도전 중인 단계"를 의미한다 (1~4).
// 4단계 승급 시험까지 통과하면 level 은 5(마스터)가 된다.
//
// 승급 시험 문제 구성 방식
// - perTableQuota: 그 단계에 속한 단(段) 하나당 출제할 문항 수 (최대 9 = ×1~9 전부)
// - hardMultipliers: 그 단에서 아이들이 특히 많이 틀리는 곱셈(예: 6~9단 서로 곱하기)을
//   출제 시 우선적으로 반드시 포함시킨다. perTableQuota 안에서 나머지는 무작위로 채운다.
// - 10~19단은 perTableQuota=9 로 두어 사실상 그 단의 ×1~9 전 범위를 빠짐없이 출제한다
//   (단 수가 적어 전 범위 출제가 가능하고, 일부만 맞혀서 통과하는 문제를 방지한다).
const LEVELS = [
  {
    level: 1,
    title: '1단계',
    range: '2~9단',
    tables: [2, 3, 4, 5, 6, 7, 8, 9],
    hardMultipliers: {
      6: [7, 8, 9],
      7: [6, 8, 9],
      8: [6, 7, 9],
      9: [6, 7, 8],
    },
    perTableQuota: 6,
    secPerQuestion: 8,
  },
  {
    level: 2,
    title: '2단계',
    range: '10~13단',
    tables: [10, 11, 12, 13],
    perTableQuota: 9,
    secPerQuestion: 12,
  },
  {
    level: 3,
    title: '3단계',
    range: '14~16단',
    tables: [14, 15, 16],
    perTableQuota: 9,
    secPerQuestion: 13,
  },
  {
    level: 4,
    title: '4단계',
    range: '17~19단',
    tables: [17, 18, 19],
    perTableQuota: 9,
    secPerQuestion: 14,
  },
];

const MASTER_LEVEL = LEVELS.length + 1; // 5 = 전 단계 마스터

const PASS_RATIO = 0.9; // 90% 이상 정답이어야 승급
const GRACE_SEC = 15; // 시간 초과 판정 여유

function computeExamConfig(levelDef) {
  const quota = Math.min(levelDef.perTableQuota || 9, 9);
  const questionCount = levelDef.tables.length * quota;
  const timeLimitSec = Math.round(questionCount * levelDef.secPerQuestion);
  const passScore = Math.ceil(questionCount * PASS_RATIO);
  return { questionCount, timeLimitSec, passScore, graceSec: GRACE_SEC };
}

LEVELS.forEach((l) => {
  l.examConfig = computeExamConfig(l);
});

const DAILY_TEST_CONFIG = {
  questionCount: 10,
  timeLimitSec: 3 * 60, // 3분
};

// 승급 시험 "자격 기준". 아래 두 조건을 모두 만족해야 시험 버튼이 열린다.
// - minStreakDays: 오늘의 테스트를 연속으로 응시한 최소 일수 (꾸준함)
// - minRecentTests / minAvgAccuracy: 최근 N회 오늘의 테스트 평균 정답률 (실력)
const READINESS_CONFIG = {
  minStreakDays: 5,
  minRecentTests: 5,
  minAvgAccuracy: 0.9, // 90%
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

// tables 배열과 문항 수를 받아 {a, b, answer} 목록 생성 (오늘의 테스트용, 무작위 샘플링).
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

// 승급 시험용 문제 생성: 단마다 hardMultipliers(자주 틀리는 곱셈)를 반드시 포함하고,
// perTableQuota 만큼 채운다. quota가 9면 그 단의 ×1~9 전체를 빠짐없이 출제한다.
function generateLevelExamProblems(levelDef) {
  const hard = levelDef.hardMultipliers || {};
  const quota = Math.min(levelDef.perTableQuota || 9, 9);
  const problems = [];

  levelDef.tables.forEach((t) => {
    const musts = (hard[t] || []).filter((m) => m >= 1 && m <= 9);
    const chosen = [];
    const chosenSet = new Set();
    musts.forEach((m) => {
      if (chosen.length < quota && !chosenSet.has(m)) {
        chosen.push(m);
        chosenSet.add(m);
      }
    });
    const restPool = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((m) => !chosenSet.has(m)));
    for (const m of restPool) {
      if (chosen.length >= quota) break;
      chosen.push(m);
    }
    chosen.forEach((m) => problems.push({ a: t, b: m, answer: t * m }));
  });

  return shuffle(problems);
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
  DAILY_TEST_CONFIG,
  READINESS_CONFIG,
  getLevelDef,
  allTables,
  tablesForStudent,
  generateProblems,
  generateLevelExamProblems,
  todayKST,
  daysBetween,
};
