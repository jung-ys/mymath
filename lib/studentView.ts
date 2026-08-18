import type { Student } from "@prisma/client";
import { prisma } from "./prisma";
import {
  getLevelDef,
  MASTER_LEVEL,
  dailyTestConfigFor,
  dailyTestConfigForCustom,
  tablesForStudent,
  READINESS_CONFIG,
  todayKST,
} from "./levels";
import { computeCurrentWrongPairs } from "./retest";

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

// 승급 시험 자격 기준: 오늘의 테스트를 최근 것부터 거슬러 올라가며 정답률이
// requiredAccuracy(90%) 이상인 기록이 연속으로 requiredStreak(10)회 이어져야 한다.
// (예전의 "연속 출석일" 조건은 제외하고, 정답률 연속 달성 하나로 단순화)
export async function computeReadiness(studentId: string) {
  const { requiredStreak, requiredAccuracy } = READINESS_CONFIG;
  // 연속 기록이 끊기는 지점까지만 확인하면 되므로 필요한 것보다 조금 더 넉넉히 가져온다.
  const recentTests = await prisma.dailyTest.findMany({
    where: { studentId },
    orderBy: { takenAt: "desc" },
    take: requiredStreak + 10,
  });

  let qualifyingStreak = 0;
  for (const t of recentTests) {
    if (t.total > 0 && t.score / t.total >= requiredAccuracy) qualifyingStreak++;
    else break;
  }

  return {
    eligible: qualifyingStreak >= requiredStreak,
    qualifyingStreak: Math.min(qualifyingStreak, requiredStreak),
    requiredStreak,
    requiredAccuracyPct: Math.round(requiredAccuracy * 100),
    totalTestsSoFar: recentTests.length,
  };
}

export async function studentSummary(s: Student) {
  const { today, dailyDone } = await todayStats(s.id);
  const levelDef = getLevelDef(s.level);
  const isMaster = s.level >= MASTER_LEVEL;
  const attemptToday = isMaster ? null : await levelExamAttemptToday(s.id, s.level);
  const readiness = isMaster ? null : await computeReadiness(s.id);
  const history = await studentHistory(s.id, 10);
  const wrongPairs = await computeCurrentWrongPairs(s.id);

  const hasCustom = s.customTables.length > 0;
  const dailyTables = hasCustom ? s.customTables : tablesForStudent(s.level);
  const dailyConfig = hasCustom ? dailyTestConfigForCustom(dailyTables, s.customCount) : dailyTestConfigFor(dailyTables);

  return {
    student: publicStudent(s),
    today,
    masterLevel: MASTER_LEVEL,
    dailyTest: {
      taken: !!dailyDone,
      result: dailyDone,
      config: dailyConfig,
    },
    customConfig: {
      tables: s.customTables,
      questionCount: s.customCount,
      allowDuplicates: s.allowDuplicates,
      problemOrder: s.problemOrder,
    },
    wrongCount: wrongPairs.length,
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
