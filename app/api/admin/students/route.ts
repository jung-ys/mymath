import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/apiAuth";
import { hashSecret } from "@/lib/auth";
import { publicStudent, todayStats } from "@/lib/studentView";
import { LEVELS, MASTER_LEVEL } from "@/lib/levels";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });

  const students = await prisma.student.findMany({ orderBy: { name: "asc" } });
  const list = await Promise.all(
    students.map(async (s) => {
      const { dailyDone } = await todayStats(s.id);
      return { ...publicStudent(s), todayDone: !!dailyDone };
    })
  );
  return NextResponse.json({ students: list, levels: LEVELS, masterLevel: MASTER_LEVEL });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const pin = String(body.pin || "").trim();
  const startLevel = Number(body.startLevel) || 1;

  if (!name) return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
  if (!/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ error: "비밀번호(PIN)는 4~6자리 숫자로 입력해주세요." }, { status: 400 });
  }
  if (startLevel < 1 || startLevel > MASTER_LEVEL) {
    return NextResponse.json({ error: "유효하지 않은 시작 단계입니다." }, { status: 400 });
  }

  try {
    const student = await prisma.student.create({
      data: { name, pinHash: hashSecret(pin), level: startLevel },
    });
    return NextResponse.json({ student: publicStudent(student) }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "이미 같은 이름의 학생이 있습니다." }, { status: 409 });
    }
    throw err;
  }
}
