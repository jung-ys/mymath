import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/apiAuth";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    await prisma.levelUp.update({
      where: { id },
      data: {
        rewardGiven: !!body.rewardGiven,
        rewardNote: String(body.note || "").slice(0, 200),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
    }
    throw err;
  }
}
