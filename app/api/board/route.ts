import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/apiAuth";
import { LEVELS, MASTER_LEVEL, todayKST } from "@/lib/levels";
import { publicStudent } from "@/lib/studentView";

// 전체 학생 명단과 단계를 보여주는 게시판이라 선생님(관리자) 로그인이 있어야만 볼 수 있게 한다.
// 교실 모니터에 띄워둘 때는 그 브라우저에서 한 번 관리자로 로그인해두면 계속 열람 가능하다.
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "선생님 로그인이 필요합니다." }, { status: 401 });

  const students = await prisma.student.findMany({ orderBy: [{ level: "desc" }, { name: "asc" }] });

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const recent = await prisma.levelUp.findMany({
    where: { awardedAt: { gte: since } },
    orderBy: { awardedAt: "desc" },
    include: { student: true },
  });

  const recentLevelUps = recent.map((u) => {
    const levelDef = LEVELS.find((l) => l.level === u.level);
    return {
      studentName: u.student ? u.student.name : "(삭제된 학생)",
      level: u.level,
      levelTitle: levelDef ? `${levelDef.title} (${levelDef.range})` : `${u.level}단계`,
      awardedAt: u.awardedAt,
      rewardGiven: u.rewardGiven,
    };
  });

  const today = todayKST();
  const todayDailyCount = await prisma.dailyTest.count({ where: { date: today } });

  return NextResponse.json({
    levels: LEVELS,
    students: students.map(publicStudent),
    recentLevelUps,
    todayDailyCount,
    masterLevel: MASTER_LEVEL,
  });
}
