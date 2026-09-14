import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/apiAuth";
import { getLevelDef, generateLevelExamProblems } from "@/lib/levels";
import { resolveExamConfig } from "@/lib/examSettings";
import { encryptExamToken } from "@/lib/examToken";

// 관리자가 "감"을 잡을 수 있도록 승급 시험을 직접 체험해보는 기능. 학생 기록에는 전혀
// 영향을 주지 않는다(어떤 학생과도 연결되지 않고, submit에서도 DB에 아무것도 쓰지 않는다).
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const level = Number(body.level);
  const levelDef = getLevelDef(level);
  if (!levelDef) return NextResponse.json({ error: "유효하지 않은 단계입니다." }, { status: 400 });

  const config = (await resolveExamConfig(level, null)) ?? levelDef.examConfig;
  const problems = generateLevelExamProblems(levelDef);
  const examToken = encryptExamToken({
    studentId: "admin-preview",
    kind: "level_preview",
    level,
    problems,
    config,
    createdAt: Date.now(),
  });

  return NextResponse.json({
    examToken,
    problems: problems.map(({ a, b }) => ({ a, b })),
    config,
    levelDef,
  });
}
