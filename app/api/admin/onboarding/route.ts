import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/apiAuth";
import { sortStudentsByGrade } from "@/lib/studentView";

// 관리자가 학생별로 학부모 온보딩 진행 현황(어느 단계까지 완료했는지)을 한눈에 보는 목록.
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });

  const students = await prisma.student.findMany({
    select: { id: true, name: true, school: true, grade: true, onboardingSteps: { select: { step: true } } },
  });

  const list = sortStudentsByGrade(
    students.map((s) => ({
      id: s.id,
      name: s.name,
      school: s.school,
      grade: s.grade,
      completedSteps: s.onboardingSteps.map((o) => o.step),
    }))
  );

  return NextResponse.json({ students: list });
}
