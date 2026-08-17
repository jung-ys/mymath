import { NextRequest, NextResponse } from "next/server";
import { getAuthedStudent } from "@/lib/apiAuth";
import { todayStats } from "@/lib/studentView";
import {
  tablesForStudent,
  generateProblems,
  dailyTestConfigFor,
  dailyTestConfigForCustom,
  timeLimitForDailyCount,
  shuffle,
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
  const baseConfig = hasCustom ? dailyTestConfigForCustom(tables, student.customCount) : dailyTestConfigFor(tables);

  // 지금까지 틀린 채로 남아있는 문제는(어제 이전 오답 포함) 반드시 오늘의 테스트에 포함시킨다.
  const wrongPairs = await computeCurrentWrongPairs(student.id);
  const forced = wrongPairs.map(({ a, b }) => ({ a, b, answer: a * b }));
  const forcedKeys = new Set(forced.map((p) => `${p.a}x${p.b}`));

  const remaining = Math.max(0, baseConfig.questionCount - forced.length);
  let randomPart: ReturnType<typeof generateProblems>;
  if (student.allowDuplicates) {
    randomPart = generateProblems(tables, remaining, true);
  } else {
    // 강제 포함된 오답과 겹치는 조합은 제외한 전체 풀에서 뽑아야 부족해지지 않는다
    // (겹치는 것만 나중에 걸러내면 그만큼 문항 수가 모자라질 수 있다).
    const fullPool = generateProblems(tables, tables.length * 9, false).filter(
      (p) => !forcedKeys.has(`${p.a}x${p.b}`)
    );
    randomPart = fullPool.slice(0, remaining);
  }

  const problems = shuffle([...forced, ...randomPart]);
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
