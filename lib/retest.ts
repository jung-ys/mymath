import { prisma } from "./prisma";

interface DetailEntry {
  a: number;
  b: number;
  correct: boolean;
}

// 학생의 모든 응시 기록(오늘의 테스트 / 승급시험 / 오답 재테스트)을 시간순으로 훑어서
// 각 문제(a×b)의 "가장 최근 결과"를 계산한다. 가장 최근 결과가 오답인 문제만 모으면
// "지금 다시 풀어야 할 오답 목록"이 된다 (한 번 맞히면 그 뒤로 다시 틀리지 않는 한 목록에서 빠진다).
export async function computeCurrentWrongPairs(studentId: string): Promise<{ a: number; b: number }[]> {
  const [daily, level, retest] = await Promise.all([
    prisma.dailyTest.findMany({ where: { studentId }, select: { detail: true, takenAt: true } }),
    prisma.levelExam.findMany({ where: { studentId }, select: { detail: true, takenAt: true } }),
    prisma.retestAttempt.findMany({ where: { studentId }, select: { detail: true, takenAt: true } }),
  ]);

  const events = [...daily, ...level, ...retest].sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime());

  const latest = new Map<string, DetailEntry>();
  for (const ev of events) {
    const detail = (ev.detail as unknown as DetailEntry[]) || [];
    for (const d of detail) {
      latest.set(`${d.a}x${d.b}`, { a: d.a, b: d.b, correct: d.correct });
    }
  }

  return Array.from(latest.values())
    .filter((v) => !v.correct)
    .map(({ a, b }) => ({ a, b }));
}
