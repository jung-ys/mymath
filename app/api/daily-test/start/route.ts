import { NextRequest, NextResponse } from "next/server";
import { getAuthedStudent } from "@/lib/apiAuth";
import { todayStats } from "@/lib/studentView";
import { tablesForStudent, generateProblems, dailyTestConfigFor, dailyTestConfigForCustom } from "@/lib/levels";
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
  const config = hasCustom ? dailyTestConfigForCustom(tables, student.customCount) : dailyTestConfigFor(tables);
  const problems = generateProblems(tables, config.questionCount, student.allowDuplicates);
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
  });
}
