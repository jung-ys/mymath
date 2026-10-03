import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/apiAuth";

type Ctx = { params: Promise<{ id: string }> };

// 이 학생이 하루에 "오늘의 테스트"를 몇 번까지 볼 수 있는지 지정한다. 0이면 무제한,
// 그 외엔 1 이상의 횟수. 기본값은 1회.
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const raw = Number(body.dailyTestLimit);
  if (!Number.isFinite(raw) || raw < 0) {
    return NextResponse.json({ error: "유효하지 않은 값입니다." }, { status: 400 });
  }
  const value = Math.min(99, Math.round(raw));

  try {
    await prisma.student.update({ where: { id }, data: { dailyTestLimit: value } });
    return NextResponse.json({ ok: true, dailyTestLimit: value });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });
    }
    throw err;
  }
}
