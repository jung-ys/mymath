import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySecret, makeStudentToken, STUDENT_COOKIE, STUDENT_COOKIE_MAX_AGE } from "@/lib/auth";
import { publicStudent } from "@/lib/studentView";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const pin = String(body.pin || "").trim();
  if (!name || !pin) {
    return NextResponse.json({ error: "이름과 비밀번호를 입력해주세요." }, { status: 400 });
  }

  const student = await prisma.student.findUnique({ where: { name } });
  if (!student || !verifySecret(pin, student.pinHash)) {
    return NextResponse.json({ error: "이름 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, student: publicStudent(student) });
  res.cookies.set(STUDENT_COOKIE, makeStudentToken(student.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: STUDENT_COOKIE_MAX_AGE,
  });
  return res;
}
