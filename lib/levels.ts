// 구구단을 5단계로 구성한다. 표준 구구단(2~9단 × 1~9)을 넘어서, 1~4단계는 단(段)과
// 배수 양쪽을 두 구간으로 나눠 4개의 "사분면(quadrant)"으로 정의하고, 그 위에 전체
// 범위(2~19단 × 1~20배)를 무작위로 뒤섞어 내는 "마스터 단계"(5단계)를 최종 관문으로 둔다.
//
//            배수 1~10          배수 11~20
//   단 2~10    1단계               3단계
//   단 11~19   2단계               4단계
//
//   5단계 = 마스터 단계: 위 4개 사분면 전체(2~19단 × 1~20배)에서 150문제를 무작위로 출제.
//
// Student.level 은 "현재 도전 중인 단계"를 의미한다 (1~5).
// 마스터 단계(5단계) 승급 시험까지 통과하면 level 은 MASTER_LEVEL(6, 전 단계 마스터)이 된다.
//
// 승급 시험 문제 구성 방식
// - 1~4단계: 빠짐없이 확인하기 위해 그 단계 자기 사분면(단×배수)의 조합을 전부(단마다
//   배수 구간 전체) 출제한다 — 단계당 90문제. 2단계부터는 여기에 더해 그 아래 모든
//   단계의 사분면에서 뽑은 문제를 CUMULATIVE_EXTRA_COUNT개 추가로 출제해 이전에 배운
//   내용을 계속 누적해서 확인한다(2~4단계 = 110문제).
// - 마스터 단계(5단계): 전체 범위(360개 조합)에서 MASTER_EXAM_QUESTION_COUNT(150)문제를
//   완전히 무작위로 뽑는다 — 이미 1~4단계에서 각 사분면을 낱낱이 확인했으므로 여기서는
//   전 범위를 뒤섞어 종합적으로 확인하는 게 목적이다.
// - 통과 기준은 항상 100%(전부 정답)이다. 1~4단계는 한 번 100%를 받으면 바로 승급되고,
//   마스터 단계만 한 번 100%를 받아도 바로 확정되지 않고 그 다음 응시(다른 날 재도전)에서
//   다시 한 번 연속으로 100%를 받아야 최종적으로 마스터가 확정된다(우연히 한 번 다 맞힌
//   게 아니라 확실히 아는지 재확인하기 위함 — level-exam/submit 라우트에서 처리).

export interface LevelDef {
  level: number;
  title: string;
  range: string;
  tables: number[]; // 이 단계에 속한 단(段) 목록, 예: [2,3,...,10]
  multRange: [number, number]; // 이 단계에서 출제하는 배수(곱하는 수) 구간, 예: [1,10]
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

export type Pair = [number, number];

function rangeArray(min: number, max: number): number[] {
  const out: number[] = [];
  for (let n = min; n <= max; n++) out.push(n);
  return out;
}

const RAW_LEVELS: Omit<LevelDef, "examConfig">[] = [
  {
    level: 1,
    title: "1단계",
    range: "2~10단 · ×1~10배",
    tables: rangeArray(2, 10),
    multRange: [1, 10],
    secPerQuestion: 6,
  },
  {
    level: 2,
    title: "2단계",
    range: "11~19단 · ×1~10배",
    tables: rangeArray(11, 19),
    multRange: [1, 10],
    secPerQuestion: 7,
  },
  {
    level: 3,
    title: "3단계",
    range: "2~10단 · ×11~20배",
    tables: rangeArray(2, 10),
    multRange: [11, 20],
    secPerQuestion: 7,
  },
  {
    level: 4,
    title: "4단계",
    range: "11~19단 · ×11~20배",
    tables: rangeArray(11, 19),
    multRange: [11, 20],
    secPerQuestion: 8,
  },
  {
    level: 5,
    title: "마스터 단계",
    range: "전체 랜덤 · 2~19단 × 1~20배",
    tables: rangeArray(2, 19),
    multRange: [1, 20],
    secPerQuestion: 8,
  },
];

// 마지막 단계(현재 5단계 = 마스터 단계)는 사분면 전체를 다 내는 대신 고정된 수의
// 문제를 전 범위에서 무작위로 뽑는다 — 그리고 이 단계만 승급에 "연속 2회 100점"이 필요하다.
export const FINAL_LEVEL = RAW_LEVELS.length;
export const MASTER_EXAM_QUESTION_COUNT = 150;

const PASS_RATIO = 1.0; // 100% 정답이어야 통과
const GRACE_SEC = 15; // 시간 초과 판정 여유

// 2단계부터 4단계까지는 승급 시험이 "누적"이 된다: 그 단계 자신의 사분면은 전부(90문제)
// 출제하고, 추가로 그 아래 모든 단계에서 뽑은 문제를 CUMULATIVE_EXTRA_COUNT개 더 얹는다.
// (1단계는 아래 단계가 없으므로 그대로 자기 사분면만 출제한다.)
export const CUMULATIVE_EXTRA_COUNT = 20;

function multSpan(multRange: [number, number]): number {
  return multRange[1] - multRange[0] + 1;
}

function computeExamConfig(levelDef: Omit<LevelDef, "examConfig">): ExamConfig {
  let questionCount: number;
  if (levelDef.level === FINAL_LEVEL) {
    questionCount = MASTER_EXAM_QUESTION_COUNT;
  } else {
    const ownCount = levelDef.tables.length * multSpan(levelDef.multRange);
    const extraCount = levelDef.level > 1 ? CUMULATIVE_EXTRA_COUNT : 0;
    questionCount = ownCount + extraCount;
  }
  const timeLimitSec = Math.round(questionCount * levelDef.secPerQuestion);
  const passScore = Math.ceil(questionCount * PASS_RATIO);
  return { questionCount, timeLimitSec, passScore, graceSec: GRACE_SEC };
}

export const LEVELS: LevelDef[] = RAW_LEVELS.map((l) => ({ ...l, examConfig: computeExamConfig(l) }));

export const MASTER_LEVEL = LEVELS.length + 1; // 6 = 마스터 단계까지 통과한 "완전 마스터"

// 한 단계(사분면)에 속한 모든 (단, 배수) 조합을 전부 나열한다.
export function pairsForLevel(levelDef: Pick<LevelDef, "tables" | "multRange">): Pair[] {
  const [lo, hi] = levelDef.multRange;
  const pairs: Pair[] = [];
  levelDef.tables.forEach((t) => {
    for (let m = lo; m <= hi; m++) pairs.push([t, m]);
  });
  return pairs;
}

// 학생이 지금 도전 중인 단계까지의 모든 사분면을 합친 (단, 배수) 조합 (오늘의 테스트 기본 범위).
// 마스터 단계(5단계)는 그 자체로 이미 1~4단계 전체를 합친 범위와 같으므로, 중복 없이
// 합치기 위해 (단,배수) 쌍 기준으로 중복 제거한다.
export function cumulativePairsForLevel(level: number): Pair[] {
  const upTo = level >= MASTER_LEVEL ? LEVELS : LEVELS.filter((l) => l.level <= level);
  const seen = new Set<string>();
  const out: Pair[] = [];
  for (const l of upTo) {
    for (const p of pairsForLevel(l)) {
      const key = `${p[0]}x${p[1]}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(p);
      }
    }
  }
  return out;
}

// 위 pairs에서 중복 없는 단(段) 목록만 뽑아낸다 — 문항 수 자동 산정 등 "몇 개 단을 배웠는지"
// 기준의 계산에 쓴다 (배수 구간 정보는 필요 없는 곳).
export function tablesForStudent(level: number): number[] {
  const set = new Set(cumulativePairsForLevel(level).map(([a]) => a));
  return Array.from(set).sort((a, b) => a - b);
}

// 관리자가 학생별로 특정 단(段)만 직접 골라 지정했을 때 쓰는 조합 — 단계 구분과 무관하게
// 배수 1~20 전체 범위로 연습 문제를 만든다 (지정한 단을 폭넓게 반복 연습시키기 위함).
export function pairsForTables(tables: number[], multMin = 1, multMax = 20): Pair[] {
  const pairs: Pair[] = [];
  tables.forEach((t) => {
    for (let m = multMin; m <= multMax; m++) pairs.push([t, m]);
  });
  return pairs;
}

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

// (단, 배수) 조합 목록과 문항 수를 받아 문제 목록 생성 (오늘의 테스트용, 무작위 샘플링).
// allowDuplicates가 false(기본)면 가능한 조합 수를 넘는 문항 수는 조합 수만큼으로 잘라낸다.
// allowDuplicates가 true면 문항 수를 정확히 맞추기 위해 같은 문제가 반복될 수 있다.
export function generateProblems(pairs: Pair[], count: number, allowDuplicates = false): Problem[] {
  if (pairs.length === 0) return [];
  const shuffled = shuffle(pairs);
  let chosen: Pair[];
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

// 승급 시험용 문제 생성.
// - 1~4단계: 자기 사분면(단×배수구간)의 조합을 빠짐없이 전부 출제하고, 2단계부터는 그
//   아래 모든 단계 사분면에서 CUMULATIVE_EXTRA_COUNT문제를 추가로 뽑아 누적 확인한다.
// - 마스터 단계(5단계): 전체 범위(2~19단 × 1~20배, 360개 조합)에서 완전히 무작위로
//   MASTER_EXAM_QUESTION_COUNT(150)문제를 뽑는다.
export function generateLevelExamProblems(levelDef: LevelDef): Problem[] {
  if (levelDef.level === FINAL_LEVEL) {
    const pool = pairsForLevel(levelDef);
    const chosen = shuffle(pool).slice(0, Math.min(MASTER_EXAM_QUESTION_COUNT, pool.length));
    return chosen.map(([a, b]) => ({ a, b, answer: a * b }));
  }

  const own = pairsForLevel(levelDef).map(([a, b]) => ({ a, b, answer: a * b }));
  const problems: Problem[] = [...own];

  if (levelDef.level > 1) {
    const lowerPairs = LEVELS.filter((l) => l.level < levelDef.level).flatMap(pairsForLevel);
    const extra = shuffle(lowerPairs).slice(0, Math.min(CUMULATIVE_EXTRA_COUNT, lowerPairs.length));
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
