import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseOnboardingIds } from "@/lib/onboarding";

type Ctx = { params: Promise<{ studentId: string }> };

// 학부모용 온보딩 링크 조회 — 로그인 없이 studentId만으로 접근한다(부모는 계정이 없음).
// 형제자매를 한 링크로 묶을 수 있도록 "id1-id2" 형태도 지원한다. 학생 이름과 "완료한 단계
// 번호 목록"만 내려주고, PIN 등 민감한 정보는 절대 포함하지 않는다.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { studentId } = await params;
  const ids = parseOnboardingIds(studentId);

  const students = await prisma.student.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, onboardingSteps: { select: { step: true } } },
  });
  if (students.length === 0) return NextResponse.json({ error: "링크가 올바르지 않습니다." }, { status: 404 });

  // 링크에 적힌 순서 그대로(둘째 아이가 먼저 나오지 않도록) 정렬해서 내려준다.
  const byId = new Map(students.map((s) => [s.id, s]));
  const ordered = ids.map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => !!s);

  return NextResponse.json({
    students: ordered.map((s) => ({
      id: s.id,
      studentName: s.name,
      completedSteps: s.onboardingSteps.map((o) => o.step),
    })),
  });
}
