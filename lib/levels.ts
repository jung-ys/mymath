// 구구단 2~19단을 4단계로 구성.
// Student.level 은 "현재 도전 중인 단계"를 의미한다 (1~4).
// 4단계 승급 시험까지 통과하면 level 은 5(마스터)가 된다.
//
// 승급 시험 문제 구성 방식
// - perTableQuota: 그 단계에 속한 단(段) 하나당 출제할 문항 수 (최대 9 = ×1~9 전부)
// - hardMultipliers: 그 단에서 아이들이 특히 많이 틀리는 곱셈(예: 6~9단 서로 곱하기)을
//   출제 시 우선적으로 반드시 포함시킨다. perTableQuota 안에서 나머지는 무작위로 채운다.
// - 10~19단은 perTableQuota=9 로 두어 사실상 그 단의 ×1~9 전 범위를 빠짐없이 출제한다
//   (단 수가 적어 전 범위 출제가 가능하고, 일부만 맞혀서 통과하는 문제를 방지한다).

export interface LevelDef {
  level: number;
  title: string;
  range: string;
  tables: number[];
  hardMultipliers?: Record<number, number[]>;
  perTableQuota: number;
  secPerQuestion: number;
  examConfig: ExamConfig;
}

export interface ExamConfig {
  questionCount: number;
  timeLimitSec: number;
  passScore: number;
  graceSec: number;
}

export interface Problem {
  a: number;
  b: number;
  answer: number;
}

const RAW_LEVELS: Omit<LevelDef, "examConfig">[] = [
  {
    level: 1,
    title: "1단계",
    range: "2~9단",
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
    title: "2단계",
    range: "10~13단",
    tables: [10, 11, 12, 13],
    perTableQuota: 9,
    secPerQuestion: 12,
  },
  {
    level: 3,
    title: "3단계",
    range: "14~16단",
    tables: [14, 15, 16],
    perTableQuota: 9,
    secPerQuestion: 13,
  },
  {
    level: 4,
    title: "4단계",
    range: "17~19단",
    tables: [17, 18, 19],
    perTableQuota: 9,
    secPerQuestion: 14,
  },
];

const PASS_RATIO = 0.9; // 90% 이상 정답이어야 승급
const GRACE_SEC = 15; // 시간 초과 판정 여유

function computeExamConfig(levelDef: Omit<LevelDef, "examConfig">): ExamConfig {
  const quota = Math.min(levelDef.perTableQuota || 9, 9);
  const questionCount = levelDef.tables.length * quota;
  const timeLimitSec = Math.round(questionCount * levelDef.secPerQuestion);
  const passScore = Math.ceil(questionCount * PASS_RATIO);
  return { questionCount, timeLimitSec, passScore, graceSec: GRACE_SEC };
}

export const LEVELS: LevelDef[] = RAW_LEVELS.map((l) => ({ ...l, examConfig: computeExamConfig(l) }));

export const MASTER_LEVEL = LEVELS.length + 1; // 5 = 전 단계 마스터

// 승급 시험 "자격 기준". 아래 두 조건을 모두 만족해야 시험 버튼이 열린다.
export const READINESS_CONFIG = {
  minStreakDays: 5,
  minRecentTests: 5,
  minAvgAccuracy: 0.9, // 90%
};

// 오늘의 테스트 문항 수는 지금까지 배운 단 수에 비례해서 늘어난다
// (단마다 3문제, 최소 15문제 ~ 최대 30문제로 제한해 너무 길어지지 않게 한다).
const DAILY_QUESTIONS_PER_TABLE = 3;
const DAILY_QUESTIONS_MIN = 15;
const DAILY_QUESTIONS_MAX = 30;
const DAILY_SEC_PER_QUESTION = 12;

export function dailyTestConfigFor(tables: number[]) {
  const questionCount = Math.min(DAILY_QUESTIONS_MAX, Math.max(DAILY_QUESTIONS_MIN, tables.length * DAILY_QUESTIONS_PER_TABLE));
  const timeLimitSec = Math.round(questionCount * DAILY_SEC_PER_QUESTION);
  return { questionCount, timeLimitSec };
}

export function getLevelDef(level: number): LevelDef | null {
  return LEVELS.find((l) => l.level === level) || null;
}

export function allTables(): number[] {
  const out: number[] = [];
  for (let t = 2; t <= 19; t++) out.push(t);
  return out;
}

// 학생이 오늘의 테스트에 사용할 단(段) 범위: 도전 중인 단계 + 이미 통과한 단계 전체 복습
export function tablesForStudent(level: number): number[] {
  if (level >= MASTER_LEVEL) return allTables();
  const upTo = LEVELS.filter((l) => l.level <= level);
  const set = new Set<number>();
  upTo.forEach((l) => l.tables.forEach((t) => set.add(t)));
  return Array.from(set);
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// tables 배열과 문항 수를 받아 문제 목록 생성 (오늘의 테스트용, 무작위 샘플링).
export function generateProblems(tables: number[], count: number): Problem[] {
  const pairs: [number, number][] = [];
  tables.forEach((t) => {
    for (let m = 1; m <= 9; m++) pairs.push([t, m]);
  });
  const shuffled = shuffle(pairs);
  const chosen: [number, number][] = [];
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
export function generateLevelExamProblems(levelDef: LevelDef): Problem[] {
  const hard = levelDef.hardMultipliers || {};
  const quota = Math.min(levelDef.perTableQuota || 9, 9);
  const problems: Problem[] = [];

  levelDef.tables.forEach((t) => {
    const musts = (hard[t] || []).filter((m) => m >= 1 && m <= 9);
    const chosen: number[] = [];
    const chosenSet = new Set<number>();
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

export function todayKST(date: Date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}
