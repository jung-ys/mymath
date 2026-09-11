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

// 2단계부터는 승급 시험이 "누적"이 된다: 그 단계 자신의 단(段)은 근접 전 범위로 출제하고,
// 추가로 그 아래 모든 단계에서 뽑은 문제를 CUMULATIVE_EXTRA_COUNT개 더 얹는다.
// (1단계는 아래 단계가 없으므로 그대로 자기 범위만 출제한다.)
export const CUMULATIVE_EXTRA_COUNT = 20;

function computeExamConfig(levelDef: Omit<LevelDef, "examConfig">): ExamConfig {
  const quota = Math.min(levelDef.perTableQuota || 9, 9);
  const ownCount = levelDef.tables.length * quota;
  const extraCount = levelDef.level > 1 ? CUMULATIVE_EXTRA_COUNT : 0;
  const questionCount = ownCount + extraCount;
  const timeLimitSec = Math.round(questionCount * levelDef.secPerQuestion);
  const passScore = Math.ceil(questionCount * PASS_RATIO);
  return { questionCount, timeLimitSec, passScore, graceSec: GRACE_SEC };
}

export const LEVELS: LevelDef[] = RAW_LEVELS.map((l) => ({ ...l, examConfig: computeExamConfig(l) }));

export const MASTER_LEVEL = LEVELS.length + 1; // 5 = 전 단계 마스터

// 승급 시험 "자격 기준": 오늘의 테스트를 최근 것부터 거슬러 올라가며 정답률이
// requiredAccuracy(100%) 인 것이 연속으로 requiredStreak(10)회 이어져야 한다.
// 중간에 한 번이라도 기준 미달이 있으면 그 지점에서 연속 기록이 끊긴다.
export const READINESS_CONFIG = {
  requiredStreak: 10,
  requiredAccuracy: 1.0, // 100%
};

// 오늘의 테스트 문항 수는 지금까지 배운 단 수에 비례해서 늘어난다
// (단마다 3문제, 최소 15문제 ~ 최대 30문제로 제한해 너무 길어지지 않게 한다).
// 30문제 기준 제한시간이 3분(180초)이 되도록 문제당 6초로 잡는다.
const DAILY_QUESTIONS_PER_TABLE = 3;
const DAILY_QUESTIONS_MIN = 15;
const DAILY_QUESTIONS_MAX = 30;
const DAILY_SEC_PER_QUESTION = 6;

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

export type ProblemOrder = "random" | "sequential" | "reverse";

// 출제 순서: 랜덤(기본) / 순서대로(단 오름차순 → 같은 단은 곱수 오름차순) / 거꾸로(그 반대).
export function orderProblems(problems: Problem[], order: ProblemOrder): Problem[] {
  if (order === "random") return shuffle(problems);
  const sorted = problems.slice().sort((x, y) => (x.a - y.a) || (x.b - y.b));
  return order === "reverse" ? sorted.reverse() : sorted;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// tables 배열과 문항 수를 받아 문제 목록 생성 (오늘의 테스트용, 무작위 샘플링).
// allowDuplicates가 false(기본)면 가능한 조합 수를 넘는 문항 수는 조합 수만큼으로 잘라낸다.
// allowDuplicates가 true면 문항 수를 정확히 맞추기 위해 같은 문제가 반복될 수 있다.
export function generateProblems(tables: number[], count: number, allowDuplicates = false): Problem[] {
  const pairs: [number, number][] = [];
  tables.forEach((t) => {
    for (let m = 1; m <= 9; m++) pairs.push([t, m]);
  });
  if (pairs.length === 0) return [];
  const shuffled = shuffle(pairs);
  let chosen: [number, number][];
  if (count <= shuffled.length) {
    chosen = shuffled.slice(0, count);
  } else if (allowDuplicates) {
    chosen = shuffled.slice();
    while (chosen.length < count) {
      chosen.push(pairs[Math.floor(Math.random() * pairs.length)]);
    }
  } else {
    // 중복 비허용인데 조합 수보다 문항 수가 많으면 조합 수만큼으로 잘라낸다.
    chosen = shuffled;
  }
  return shuffle(chosen).map(([a, b]) => ({ a, b, answer: a * b }));
}

// 관리자가 지정한 문항 수(customCount)가 있으면 그대로 쓰고, 없으면 단 수 기준 자동 산정.
export function dailyTestConfigForCustom(tables: number[], customCount: number | null | undefined) {
  if (!customCount || customCount <= 0) return dailyTestConfigFor(tables);
  const questionCount = Math.min(200, Math.max(1, Math.round(customCount)));
  const timeLimitSec = Math.round(questionCount * DAILY_SEC_PER_QUESTION);
  return { questionCount, timeLimitSec };
}

// 전날 오답이 강제로 포함되어 최종 문항 수가 원래 계획보다 늘어났을 때,
// 그 실제 문항 수에 맞춰 제한시간을 다시 계산한다.
export function timeLimitForDailyCount(count: number): number {
  return Math.round(count * DAILY_SEC_PER_QUESTION);
}

// 승급 시험용 문제 생성: 단마다 hardMultipliers(자주 틀리는 곱셈)를 반드시 포함하고,
// perTableQuota 만큼 채운다. quota가 9면 그 단의 ×1~9 전체를 빠짐없이 출제한다.
// 2단계부터는 여기에 더해 그 아래 모든 단계의 단에서 CUMULATIVE_EXTRA_COUNT문제를 추가로
// 무작위 출제해 이전에 배운 내용을 계속 누적해서 확인한다.
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

  if (levelDef.level > 1) {
    const lowerTables = LEVELS.filter((l) => l.level < levelDef.level).flatMap((l) => l.tables);
    const pool: [number, number][] = [];
    lowerTables.forEach((t) => {
      for (let m = 1; m <= 9; m++) pool.push([t, m]);
    });
    const extra = shuffle(pool).slice(0, Math.min(CUMULATIVE_EXTRA_COUNT, pool.length));
    extra.forEach(([a, b]) => problems.push({ a, b, answer: a * b }));
  }

  return shuffle(problems);
}

export function todayKST(date: Date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

// "YYYY-MM-DD"(KST 기준 달력일)를 UTC Date 범위로 변환한다. takenAt(DateTime) 필드를
// 날짜 범위로 필터링할 때 쓴다.
export function kstDayBoundsUtc(dateStr: string): { start: Date; end: Date } {
  return {
    start: new Date(`${dateStr}T00:00:00+09:00`),
    end: new Date(`${dateStr}T23:59:59.999+09:00`),
  };
}

// 오늘(KST) 기준으로 n일 전 날짜 문자열을 반환한다 (리포트 기간 기본값 등에 사용).
export function daysAgoKST(n: number, from: Date = new Date()): string {
  return todayKST(new Date(from.getTime() - n * 24 * 60 * 60 * 1000));
}

// "YYYY-MM-DD" 두 날짜 사이의 일수 차이 (b - a).
export function daysBetween(dateStrA: string, dateStrB: string): number {
  const a = new Date(dateStrA + "T00:00:00Z");
  const b = new Date(dateStrB + "T00:00:00Z");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
