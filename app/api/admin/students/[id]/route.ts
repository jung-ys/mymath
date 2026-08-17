import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/apiAuth";
import { studentSummary } from "@/lib/studentView";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });
  const summary = await studentSummary(student);
  return NextResponse.json(summary);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;
  try {
    await prisma.student.delete({ where: { id } }); // 관련 기록은 onDelete: Cascade로 함께 삭제됨
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });
    }
    throw err;
  }
}
