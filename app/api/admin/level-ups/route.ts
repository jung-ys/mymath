import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/apiAuth";
import { getLevelDef } from "@/lib/levels";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });

  const rows = await prisma.levelUp.findMany({
    orderBy: { awardedAt: "desc" },
    include: { student: true },
  });

  const levelUps = rows.map((u) => {
    const levelDef = getLevelDef(u.level);
    return {
      id: u.id,
      studentId: u.studentId,
      studentName: u.student ? u.student.name : "(삭제된 학생)",
      level: u.level,
      levelTitle: levelDef ? `${levelDef.title} (${levelDef.range})` : `${u.level}단계`,
      awardedAt: u.awardedAt,
      rewardGiven: u.rewardGiven,
      rewardNote: u.rewardNote,
    };
  });

  return NextResponse.json({ levelUps });
}
