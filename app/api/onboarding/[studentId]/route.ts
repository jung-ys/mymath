import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ studentId: string }> };

// 학부모용 온보딩 링크 조회 — 로그인 없이 studentId만으로 접근한다(부모는 계정이 없음).
// 학생 이름과 "완료한 단계 번호 목록"만 내려주고, PIN 등 민감한 정보는 절대 포함하지 않는다.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { studentId } = await params;
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, name: true },
  });
  if (!student) return NextResponse.json({ error: "링크가 올바르지 않습니다." }, { status: 404 });

  const steps = await prisma.onboardingStep.findMany({ where: { studentId }, select: { step: true } });
  return NextResponse.json({ studentName: student.name, completedSteps: steps.map((s) => s.step) });
}
