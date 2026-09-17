import { NextRequest, NextResponse } from "next/server";
import { getAuthedStudent } from "@/lib/apiAuth";
import { todayStats, hasFullLevelCoverage } from "@/lib/studentView";
import {
  tablesForStudent,
  cumulativePairsForLevel,
  pairsForTables,
  pairsForLevel,
  getLevelDef,
  generateProblems,
  dailyTestConfigFor,
  dailyTestConfigForCustom,
  timeLimitForDailyCount,
  orderProblems,
  type ProblemOrder,
} from "@/lib/levels";
import { computeCurrentWrongPairs } from "@/lib/retest";
import { encryptExamToken } from "@/lib/examToken";

export async function POST(req: NextRequest) {
  const student = await getAuthedStudent(req);
  if (!student) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { dailyDone } = await todayStats(student.id);
  if (dailyDone) {
    return NextResponse.json({ error: "오늘의 테스트는 이미 완료했습니다.", result: dailyDone }, { status: 409 });
  }

  const hasCustom = student.customTables.length > 0;
  const tables = hasCustom ? student.customTables : tablesForStudent(student.level);
  // 지금 단계의 모든 조합을 이미 한 번씩 다 풀어봤다면(누적 커버리지 완료), 오늘의 테스트를
  // "이 단계 전체 범위" 시험으로 바꾼다 — 승급 자격의 "연속 5회 100점"은 이 전체 범위 시험을
  // 기준으로만 인정되므로(lib/studentView.ts computeReadiness), 그전까지는 단을 하나씩 나눠서
  // 연습하는 지금 방식(최소 15~최대 30문제)을 그대로 유지한다.
  const levelDef = hasCustom ? null : getLevelDef(student.level);
  const fullyCovered = hasCustom ? false : await hasFullLevelCoverage(student.id, student.level);
  const fullScopePairs = levelDef ? pairsForLevel(levelDef) : [];

  // hasCustom: 관리자가 지정한 단(段)에, 관리자가 지정한 배수 범위(기본 1~20 전체)를 적용.
  // fullyCovered: 이 단계 자체의 (단×배수) 조합 전부.
  // 그 외: 학생이 도전 중인 단계까지의 모든 사분면(단×배수구간)을 합친 조합을 쓴다.
  const pairs = hasCustom
    ? pairsForTables(student.customTables, student.customMultMin, student.customMultMax)
    : fullyCovered
      ? fullScopePairs
      : cumulativePairsForLevel(student.level);
  const baseConfig = hasCustom
    ? dailyTestConfigForCustom(tables, student.customCount)
    : fullyCovered
      ? { questionCount: fullScopePairs.length, timeLimitSec: timeLimitForDailyCount(fullScopePairs.length) }
      : dailyTestConfigFor(tables);

  // 지금까지 틀린 채로 남아있는 문제는(어제 이전 오답 포함) 반드시 오늘의 테스트에 포함시킨다.
  const wrongPairs = await computeCurrentWrongPairs(student.id);
  const forced = wrongPairs.map(({ a, b }) => ({ a, b, answer: a * b }));
  const forcedKeys = new Set(forced.map((p) => `${p.a}x${p.b}`));

  const remaining = Math.max(0, baseConfig.questionCount - forced.length);
  let randomPart: ReturnType<typeof generateProblems>;
  if (student.allowDuplicates) {
    randomPart = generateProblems(pairs, remaining, true);
  } else {
    // 강제 포함된 오답과 겹치는 조합은 제외한 전체 풀에서 뽑아야 부족해지지 않는다
    // (겹치는 것만 나중에 걸러내면 그만큼 문항 수가 모자라질 수 있다).
    const availablePairs = pairs.filter(([a, b]) => !forcedKeys.has(`${a}x${b}`));
    randomPart = generateProblems(availablePairs, remaining, false);
  }

  const order = (["random", "sequential", "reverse"] as const).includes(student.problemOrder as ProblemOrder)
    ? (student.problemOrder as ProblemOrder)
    : "random";
  const problems = orderProblems([...forced, ...randomPart], order);
  const config = { questionCount: problems.length, timeLimitSec: timeLimitForDailyCount(problems.length) };

  const examToken = encryptExamToken({
    studentId: student.id,
    kind: "daily",
    level: student.level,
    problems,
    config,
    createdAt: Date.now(),
  });

  return NextResponse.json({
    examToken,
    problems: problems.map(({ a, b }) => ({ a, b })),
    config,
    forcedWrongCount: forced.length,
  });
}
