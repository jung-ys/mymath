import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LEVELS, MASTER_LEVEL, todayKST } from "@/lib/levels";
import { publicStudent } from "@/lib/studentView";

export async function GET() {
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
