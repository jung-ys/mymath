import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ONBOARDING_STEPS, parseOnboardingIds } from "@/lib/onboarding";

type Ctx = { params: Promise<{ studentId: string }> };

// 부모가 온보딩 단계를 완료 체크할 때 호출 — 역시 로그인 없이 studentId로만 접근한다.
// body.studentId가 있으면 그 학생 한 명만(로그인/테스트처럼 아이마다 다른 단계), 없으면
// 링크에 묶인 모든 학생에게(홈 화면 추가처럼 한 번만 하면 되는 공통 단계) 체크한다.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { studentId: pathParam } = await params;
  const ids = parseOnboardingIds(pathParam);

  const body = await req.json().catch(() => ({}));
  const step = Number(body.step);
  if (!ONBOARDING_STEPS.some((s) => s.step === step)) {
    return NextResponse.json({ error: "유효하지 않은 단계입니다." }, { status: 400 });
  }

  let targetIds = ids;
  if (typeof body.studentId === "string") {
    if (!ids.includes(body.studentId)) {
      return NextResponse.json({ error: "링크가 올바르지 않습니다." }, { status: 400 });
    }
    targetIds = [body.studentId];
  }

  const students = await prisma.student.findMany({ where: { id: { in: targetIds } }, select: { id: true } });
  if (students.length === 0) return NextResponse.json({ error: "링크가 올바르지 않습니다." }, { status: 404 });

  try {
    await Promise.all(
      students.map((s) =>
        prisma.onboardingStep.upsert({
          where: { studentId_step: { studentId: s.id, step } },
          create: { studentId: s.id, step },
          update: {},
        })
      )
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ error: "처리하지 못했습니다." }, { status: 400 });
    }
    throw err;
  }
}
