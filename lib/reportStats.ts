import { prisma } from "./prisma";
import { getLevelDef, MASTER_LEVEL, kstDayBoundsUtc, daysBetween } from "./levels";
import { computeCurrentWrongPairs } from "./retest";

export interface RangeReportStats {
  studentName: string;
  currentLevelTitle: string;
  from: string;
  to: string;
  totalDaysInRange: number;
  daysAttended: number;
  attendanceRate: number;
  longestStreakInRange: number;
  dailyTestCount: number;
  totalQuestions: number;
  totalCorrect: number;
  overallAccuracyPct: number;
  earlyAccuracyPct: number | null;
  lateAccuracyPct: number | null;
  accuracyTrend: "up" | "down" | "same" | "insufficient";
  avgElapsedSecPerQEarly: number | null;
  avgElapsedSecPerQLate: number | null;
  speedTrend: "faster" | "slower" | "same" | "insufficient";
  levelExamAttempts: number;
  levelExamPasses: number;
  levelUpsInRange: { level: number; levelTitle: string; awardedAt: Date }[];
  retestAttempts: number;
  retestFullClears: number;
  currentWrongCount: number;
  dailyByDate: { date: string; score: number; total: number; elapsedSec: number | null }[];
}

function pct(numer: number, denom: number): number {
  return denom > 0 ? Math.round((numer / denom) * 100) : 0;
}

export async function computeRangeReport(studentId: string, from: string, to: string): Promise<RangeReportStats> {
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });
  const { start: fromStart } = kstDayBoundsUtc(from);
  const { end: toEnd } = kstDayBoundsUtc(to);

  const [dailyTests, levelExams, retestAttempts, levelUps] = await Promise.all([
    prisma.dailyTest.findMany({ where: { studentId, date: { gte: from, lte: to } }, orderBy: { takenAt: "asc" } }),
    prisma.levelExam.findMany({ where: { studentId, date: { gte: from, lte: to } }, orderBy: { takenAt: "asc" } }),
    prisma.retestAttempt.findMany({ where: { studentId, takenAt: { gte: fromStart, lte: toEnd } }, orderBy: { takenAt: "asc" } }),
    prisma.levelUp.findMany({ where: { studentId, awardedAt: { gte: fromStart, lte: toEnd } }, orderBy: { awardedAt: "asc" } }),
  ]);

  const totalDaysInRange = Math.max(1, daysBetween(from, to) + 1);
  const attendedDates = Array.from(new Set(dailyTests.map((d) => d.date))).sort();
  const daysAttended = attendedDates.length;

  // 기간 내 최대 연속 응시일 계산 (달력일 기준 하루 간격이 연속이면 이어짐)
  let longestStreakInRange = 0;
  let running = 0;
  let prevDate: string | null = null;
  for (const date of attendedDates) {
    if (prevDate && daysBetween(prevDate, date) === 1) running += 1;
    else running = 1;
    longestStreakInRange = Math.max(longestStreakInRange, running);
    prevDate = date;
  }

  const totalQuestions = dailyTests.reduce((sum, d) => sum + d.total, 0);
  const totalCorrect = dailyTests.reduce((sum, d) => sum + d.score, 0);

  const half = Math.floor(dailyTests.length / 2);
  const earlyTests = dailyTests.slice(0, half);
  const lateTests = dailyTests.slice(dailyTests.length - half);
  const enoughForTrend = half >= 2;

  const earlyAccuracyPct = enoughForTrend
    ? pct(earlyTests.reduce((s, d) => s + d.score, 0), earlyTests.reduce((s, d) => s + d.total, 0))
    : null;
  const lateAccuracyPct = enoughForTrend
    ? pct(lateTests.reduce((s, d) => s + d.score, 0), lateTests.reduce((s, d) => s + d.total, 0))
    : null;

  let accuracyTrend: RangeReportStats["accuracyTrend"] = "insufficient";
  if (earlyAccuracyPct !== null && lateAccuracyPct !== null) {
    const diff = lateAccuracyPct - earlyAccuracyPct;
    accuracyTrend = diff >= 5 ? "up" : diff <= -5 ? "down" : "same";
  }

  function avgSecPerQ(tests: typeof dailyTests): number | null {
    const withTime = tests.filter((t) => t.elapsedSec != null && t.total > 0);
    if (!withTime.length) return null;
    const total = withTime.reduce((s, t) => s + (t.elapsedSec as number) / t.total, 0);
    return Math.round((total / withTime.length) * 10) / 10;
  }
  const avgElapsedSecPerQEarly = enoughForTrend ? avgSecPerQ(earlyTests) : null;
  const avgElapsedSecPerQLate = enoughForTrend ? avgSecPerQ(lateTests) : null;

  let speedTrend: RangeReportStats["speedTrend"] = "insufficient";
  if (avgElapsedSecPerQEarly !== null && avgElapsedSecPerQLate !== null) {
    const diff = avgElapsedSecPerQLate - avgElapsedSecPerQEarly;
    speedTrend = diff <= -1 ? "faster" : diff >= 1 ? "slower" : "same";
  }

  const levelUpsInRange = levelUps.map((u) => {
    const levelDef = getLevelDef(u.level);
    return {
      level: u.level,
      levelTitle: levelDef ? `${levelDef.title} (${levelDef.range})` : `${u.level}단계`,
      awardedAt: u.awardedAt,
    };
  });

  const retestFullClears = retestAttempts.filter((r) => r.score === r.total).length;
  const currentWrongPairs = await computeCurrentWrongPairs(studentId);

  const levelDef = getLevelDef(student.level);
  const currentLevelTitle = student.level >= MASTER_LEVEL ? "마스터" : levelDef ? `${levelDef.title} (${levelDef.range})` : "-";

  return {
    studentName: student.name,
    currentLevelTitle,
    from,
    to,
    totalDaysInRange,
    daysAttended,
    attendanceRate: pct(daysAttended, totalDaysInRange),
    longestStreakInRange,
    dailyTestCount: dailyTests.length,
    totalQuestions,
    totalCorrect,
    overallAccuracyPct: pct(totalCorrect, totalQuestions),
    earlyAccuracyPct,
    lateAccuracyPct,
    accuracyTrend,
    avgElapsedSecPerQEarly,
    avgElapsedSecPerQLate,
    speedTrend,
    levelExamAttempts: levelExams.length,
    levelExamPasses: levelExams.filter((e) => e.passed).length,
    levelUpsInRange,
    retestAttempts: retestAttempts.length,
    retestFullClears,
    currentWrongCount: currentWrongPairs.length,
    dailyByDate: dailyTests.map((d) => ({ date: d.date, score: d.score, total: d.total, elapsedSec: d.elapsedSec })),
  };
}

// 기간 통계를 바탕으로 부드러운 말투의 학부모용 리포트 문단을 생성한다.
export function buildNarrative(s: RangeReportStats): string[] {
  const paras: string[] = [];
  const periodLabel = `${s.from} ~ ${s.to}`;

  if (s.dailyTestCount === 0) {
    paras.push(
      `${s.studentName} 학생은 이 기간(${periodLabel}) 동안 아직 "오늘의 테스트"에 응시하지 않았어요. 집에서 조금씩이라도 꾸준히 시작해보면 좋을 것 같아요.`
    );
  } else {
    const streakMsg =
      s.longestStreakInRange >= 3
        ? `이 기간 중 최대 ${s.longestStreakInRange}일 연속으로 꾸준히 학습한 기록도 있어요, 정말 대견해요!`
        : `앞으로 좀 더 자주, 연속으로 참여하는 습관을 만들어가면 더 좋을 것 같아요.`;
    paras.push(
      `${s.studentName} 학생은 ${periodLabel} 기간 동안 총 ${s.totalDaysInRange}일 중 ${s.daysAttended}일 오늘의 테스트에 참여했어요 (출석률 ${s.attendanceRate}%). ${streakMsg}`
    );

    let accuracyMsg = "";
    if (s.accuracyTrend === "up") accuracyMsg = " 특히 기간 초반보다 후반의 정답률이 올라간 걸 보면, 점점 실력이 늘고 있다는 뜻이에요! 🎉";
    else if (s.accuracyTrend === "down")
      accuracyMsg = " 다만 최근 들어 정답률이 조금 떨어진 편이라, 컨디션이나 새로 배운 단이 어렵진 않은지 한번 살펴봐주시면 좋을 것 같아요.";
    else if (s.accuracyTrend === "same") accuracyMsg = " 정답률이 기간 내내 안정적으로 유지되고 있어요.";
    paras.push(
      `이 기간 평균 정답률은 ${s.overallAccuracyPct}%였어요 (총 ${s.totalQuestions}문제 중 ${s.totalCorrect}문제 정답).${accuracyMsg}`
    );

    if (s.speedTrend !== "insufficient") {
      let speedMsg = "";
      if (s.speedTrend === "faster") speedMsg = "문제를 푸는 속도도 점점 빨라지고 있어요 — 계산이 손에 익어가고 있다는 좋은 신호예요.";
      else if (s.speedTrend === "slower")
        speedMsg = "다만 문제를 푸는 데 걸리는 시간이 예전보다 조금 늘었어요. 더 어려운 단을 새로 배우고 있어서 그럴 수도 있으니 자연스러운 과정으로 봐주시면 좋겠어요.";
      else speedMsg = "문제를 푸는 속도는 기간 내내 비슷하게 유지되고 있어요.";
      paras.push(speedMsg);
    }
  }

  if (s.retestAttempts > 0) {
    const clearMsg =
      s.currentWrongCount > 0
        ? `지금은 아직 ${s.currentWrongCount}개의 오답이 남아있으니, 조금만 더 연습하면 완전히 해결될 것 같아요.`
        : "지금은 남아있는 오답이 하나도 없어요, 완벽해요!";
    paras.push(
      `오답을 다시 풀어보는 연습도 ${s.retestAttempts}번 시도했고, 그중 ${s.retestFullClears}번은 그 자리에서 오답을 전부 맞혀서 깔끔하게 정리했어요. ${clearMsg}`
    );
  } else if (s.currentWrongCount > 0) {
    paras.push(`지금 ${s.currentWrongCount}개의 오답이 쌓여있어요. "오답 다시 풀기"로 한 번씩 정리해주면 더 탄탄해질 거예요.`);
  }

  if (s.levelUpsInRange.length > 0) {
    const names = s.levelUpsInRange.map((u) => u.levelTitle).join(", ");
    paras.push(`이 기간 동안 ${s.levelUpsInRange.length}번 레벨업에 성공했어요 (${names})! 정말 축하할 일이에요 🎉`);
  } else if (s.levelExamAttempts > 0) {
    paras.push(`승급 시험에 ${s.levelExamAttempts}번 도전했어요. 아직 통과하지는 못했지만, 계속 도전하다 보면 곧 좋은 결과가 있을 거예요.`);
  }

  paras.push(`현재는 ${s.currentLevelTitle} 단계이고, 앞으로도 꾸준히 함께 응원하겠습니다. 궁금한 점이나 상담이 필요하시면 언제든 학원으로 연락 주세요. 😊`);

  return paras;
}
