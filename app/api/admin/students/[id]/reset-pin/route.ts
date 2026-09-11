import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/apiAuth";
import { hashSecret, encryptPin } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const pin = String(body.pin || "").trim();
  if (!/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ error: "비밀번호(PIN)는 4~6자리 숫자로 입력해주세요." }, { status: 400 });
  }
  try {
    await prisma.student.update({ where: { id }, data: { pinHash: hashSecret(pin), pinEncrypted: encryptPin(pin) } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });
    }
    throw err;
  }
}
