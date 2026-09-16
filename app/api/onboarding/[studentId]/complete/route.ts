import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ONBOARDING_STEPS } from "@/lib/onboarding";

type Ctx = { params: Promise<{ studentId: string }> };

// 부모가 온보딩 단계를 완료 체크할 때 호출 — 역시 로그인 없이 studentId로만 접근한다.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { studentId } = await params;
  const body = await req.json().catch(() => ({}));
  const step = Number(body.step);
  if (!ONBOARDING_STEPS.some((s) => s.step === step)) {
    return NextResponse.json({ error: "유효하지 않은 단계입니다." }, { status: 400 });
  }

  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!student) return NextResponse.json({ error: "링크가 올바르지 않습니다." }, { status: 404 });

  try {
    await prisma.onboardingStep.upsert({
      where: { studentId_step: { studentId, step } },
      create: { studentId, step },
      update: {},
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ error: "처리하지 못했습니다." }, { status: 400 });
    }
    throw err;
  }
}
