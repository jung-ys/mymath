import { NextRequest, NextResponse } from "next/server";
import { getAuthedStudent } from "@/lib/apiAuth";
import { levelExamAttemptToday, computeReadiness } from "@/lib/studentView";
import { getLevelDef, generateLevelExamProblems, MASTER_LEVEL } from "@/lib/levels";
import { encryptExamToken } from "@/lib/examToken";

export async function POST(req: NextRequest) {
  const student = await getAuthedStudent(req);
  if (!student) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  if (student.level >= MASTER_LEVEL) {
    return NextResponse.json({ error: "이미 모든 단계를 마스터했습니다." }, { status: 409 });
  }
  if (await levelExamAttemptToday(student.id, student.level)) {
    return NextResponse.json({ error: "오늘은 이미 이 단계 승급 시험에 응시했습니다. 내일 다시 도전해주세요." }, { status: 409 });
  }
  const readiness = await computeReadiness(student.id, student.streak);
  if (!readiness.eligible) {
    return NextResponse.json(
      { error: "아직 승급 시험 자격 기준을 채우지 못했어요. 오늘의 테스트를 꾸준히 풀어주세요.", readiness },
      { status: 403 }
    );
  }

  const levelDef = getLevelDef(student.level)!;
  const problems = generateLevelExamProblems(levelDef);
  const examToken = encryptExamToken({
    studentId: student.id,
    kind: "level",
    level: student.level,
    problems,
    config: levelDef.examConfig,
    createdAt: Date.now(),
  });

  return NextResponse.json({
    examToken,
    problems: problems.map(({ a, b }) => ({ a, b })),
    config: levelDef.examConfig,
    levelDef,
  });
}
