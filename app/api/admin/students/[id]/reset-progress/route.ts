import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/apiAuth";
import { publicStudent } from "@/lib/studentView";

type Ctx = { params: Promise<{ id: string }> };

// 학생의 이름/PIN은 그대로 두고, 진행 상황(단계/연속기록/오늘의테스트·승급시험·오답 이력·
// 레벨업 보상 기록·커스텀 출제 설정)을 전부 초기화해 "새 학생처럼" 되돌린다.
// 테스트 삼아 이것저것 해본 학생을 처음부터 다시 시작하게 할 때 쓴다.
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;

  try {
    const [student] = await prisma.$transaction([
      prisma.student.update({
        where: { id },
        data: {
          level: 1,
          streak: 0,
          lastDailyTestDate: null,
          customTables: [],
          customCount: null,
          customMultMin: 1,
          customMultMax: 20,
          allowDuplicates: false,
          problemOrder: "random",
        },
      }),
      prisma.dailyTest.deleteMany({ where: { studentId: id } }),
      prisma.levelExam.deleteMany({ where: { studentId: id } }),
      prisma.retestAttempt.deleteMany({ where: { studentId: id } }),
      prisma.levelUp.deleteMany({ where: { studentId: id } }),
    ]);
    return NextResponse.json({ student: publicStudent(student) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });
    }
    throw err;
  }
}
