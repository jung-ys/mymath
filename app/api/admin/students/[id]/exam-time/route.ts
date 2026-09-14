import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/apiAuth";

type Ctx = { params: Promise<{ id: string }> };

// 이 학생만 승급 시험 제한시간을 따로 준다(단계별 전체 설정보다 우선 적용된다).
// timeLimitSec이 없거나 0 이하면 개별 설정을 지워서 단계별 기본값을 따르게 한다.
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const timeLimitSec = Number(body.timeLimitSec);
  const value = Number.isFinite(timeLimitSec) && timeLimitSec > 0 ? Math.min(3600 * 3, Math.max(30, Math.round(timeLimitSec))) : null;

  try {
    await prisma.student.update({ where: { id }, data: { examTimeOverrideSec: value } });
    return NextResponse.json({ ok: true, examTimeOverrideSec: value });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });
    }
    throw err;
  }
}
