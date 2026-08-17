import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/apiAuth";
import { publicStudent } from "@/lib/studentView";
import { MASTER_LEVEL } from "@/lib/levels";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const level = Number(body.level);
  if (!Number.isInteger(level) || level < 1 || level > MASTER_LEVEL) {
    return NextResponse.json({ error: "유효하지 않은 단계입니다." }, { status: 400 });
  }
  try {
    const student = await prisma.student.update({ where: { id }, data: { level } });
    return NextResponse.json({ student: publicStudent(student) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });
    }
    throw err;
  }
}
