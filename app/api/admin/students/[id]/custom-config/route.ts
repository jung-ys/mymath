import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/apiAuth";
import { publicStudent } from "@/lib/studentView";

type Ctx = { params: Promise<{ id: string }> };

const VALID_ORDERS = ["random", "sequential", "reverse"];

// 빈 tables 배열을 보내면 커스텀 설정이 해제되어 단계(level) 기준 자동 범위로 돌아간다.
// problemOrder는 tables 설정 여부와 무관하게 항상 적용된다.
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const tablesInput: unknown[] = Array.isArray(body.tables) ? body.tables : [];
  const parsedTables: number[] = tablesInput
    .map((t) => Number(t))
    .filter((t) => Number.isInteger(t) && t >= 2 && t <= 19);
  const tables = Array.from(new Set(parsedTables)).sort((a, b) => a - b);

  const countRaw = body.questionCount;
  const countNum = countRaw === null || countRaw === undefined || countRaw === "" ? null : Number(countRaw);
  const questionCount = countNum && countNum > 0 ? Math.min(200, Math.round(countNum)) : null;

  const allowDuplicates = !!body.allowDuplicates;
  const problemOrder = VALID_ORDERS.includes(body.problemOrder) ? body.problemOrder : "random";

  try {
    const student = await prisma.student.update({
      where: { id },
      data: { customTables: tables, customCount: questionCount, allowDuplicates, problemOrder },
    });
    return NextResponse.json({
      student: publicStudent(student),
      customTables: tables,
      customCount: questionCount,
      allowDuplicates,
      problemOrder,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });
    }
    throw err;
  }
}
