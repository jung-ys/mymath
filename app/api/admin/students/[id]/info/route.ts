import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/apiAuth";
import { publicStudent } from "@/lib/studentView";

type Ctx = { params: Promise<{ id: string }> };

// 학교/학년 정보 수정 (매년 진급하거나 전학하는 경우 등). 빈 문자열을 보내면 null로 지운다.
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const school = String(body.school || "").trim().slice(0, 50) || null;
  const grade = String(body.grade || "").trim().slice(0, 20) || null;

  try {
    const student = await prisma.student.update({ where: { id }, data: { school, grade } });
    return NextResponse.json({ student: publicStudent(student) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });
    }
    throw err;
  }
}
