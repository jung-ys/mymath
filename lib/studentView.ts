import type { Student } from "@prisma/client";
import { prisma } from "./prisma";
import { getLevelDef, MASTER_LEVEL, dailyTestConfigFor, tablesForStudent, READINESS_CONFIG, todayKST } from "./levels";

export function publicStudent(s: Student) {
  const levelDef = getLevelDef(s.level);
  return {
    id: s.id,
    name: s.name,
    level: s.level,
    levelTitle: s.level >= MASTER_LEVEL ? "마스터" : levelDef ? `${levelDef.title} (${levelDef.range})` : "-",
    isMaster: s.level >= MASTER_LEVEL,
    streak: s.streak,
    lastDailyTestDate: s.lastDailyTestDate,
    createdAt: s.createdAt,
  };
}

export async function todayStats(studentId: string) {
  const today = todayKST();
  const dailyDone = await prisma.dailyTest.findUnique({
    where: { studentId_date: { studentId, date: today } },
  });
  return { today, dailyDone };
}

export async function levelExamAttemptToday(studentId: string, level: number) {
  const today = todayKST();
  return prisma.levelExam.findUnique({
    where: { studentId_level_date: { studentId, level, date: today } },
  });
}

export async function studentHistory(studentId: string, limit = 20) {
  const [daily, levelExams, levelUps] = await Promise.all([
    prisma.dailyTest.findMany({ where: { studentId }, orderBy: { takenAt: "desc" }, take: limit }),
    prisma.levelExam.findMany({ where: { studentId }, orderBy: { takenAt: "desc" }, take: limit }),
    prisma.levelUp.findMany({ where: { studentId }, orderBy: { awardedAt: "desc" } }),
  ]);
  return { daily, levelExams, levelUps };
}

// 승급 시험 자격 기준: (1) 오늘의 테스트 연속 응시일수, (2) 최근 N회 평균 정답률.
// 둘 다 만족해야 시험 버튼이 열린다.
export async function computeReadiness(studentId: string, streak: number) {
  const { minStreakDays, minRecentTests, minAvgAccuracy } = READINESS_CONFIG;
  const recentTests = await prisma.dailyTest.findMany({
    where: { studentId },
    orderBy: { takenAt: "desc" },
    take: minRecentTests,
  });
  const haveEnough = recentTests.length >= minRecentTests;
  const avgAccuracy = recentTests.length
    ? recentTests.reduce((sum, t) => sum + t.score / t.total, 0) / recentTests.length
    : 0;
  const streakOk = streak >= minStreakDays;
  const accuracyOk = haveEnough && avgAccuracy >= minAvgAccuracy;
  return {
    eligible: streakOk && accuracyOk,
    streakOk,
    accuracyOk,
    streak,
    minStreakDays,
    recentCount: recentTests.length,
    minRecentTests,
    avgAccuracyPct: Math.round(avgAccuracy * 100),
    minAvgAccuracyPct: Math.round(minAvgAccuracy * 100),
  };
}

export async function studentSummary(s: Student) {
  const { today, dailyDone } = await todayStats(s.id);
  const levelDef = getLevelDef(s.level);
  const isMaster = s.level >= MASTER_LEVEL;
  const attemptToday = isMaster ? null : await levelExamAttemptToday(s.id, s.level);
  const readiness = isMaster ? null : await computeReadiness(s.id, s.streak);
  const history = await studentHistory(s.id, 10);

  return {
    student: publicStudent(s),
    today,
    masterLevel: MASTER_LEVEL,
    dailyTest: {
      taken: !!dailyDone,
      result: dailyDone,
      config: dailyTestConfigFor(tablesForStudent(s.level)),
    },
    levelExam: isMaster
      ? { available: false, reason: "모든 단계를 마스터했습니다!" }
      : {
          available: !attemptToday && !!readiness?.eligible,
          attemptedToday: !!attemptToday,
          lastAttemptToday: attemptToday,
          readiness,
          levelDef,
          config: levelDef!.examConfig,
        },
    history,
  };
}
