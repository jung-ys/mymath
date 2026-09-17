import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/apiAuth";

type Ctx = { params: Promise<{ id: string }> };

// 학부모 온보딩 체크리스트만 초기화한다(학습 진행 상황은 건드리지 않음).
// 선생님이 테스트 삼아 눌러본 체크를 지우고 학부모에게 실제로 다시 안내할 때 사용.
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;

  const student = await prisma.student.findUnique({ where: { id }, select: { id: true } });
  if (!student) return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });

  await prisma.onboardingStep.deleteMany({ where: { studentId: id } });
  return NextResponse.json({ ok: true });
}
