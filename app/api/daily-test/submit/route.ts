import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedStudent } from "@/lib/apiAuth";
import { decryptExamToken } from "@/lib/examToken";
import { todayKST } from "@/lib/levels";
import { todayStats } from "@/lib/studentView";
import { markOnboardingStepDone } from "@/lib/onboardingServer";

export async function POST(req: NextRequest) {
  const student = await getAuthedStudent(req);
  if (!student) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { examToken, answers, elapsedSec } = body as { examToken?: string; answers?: unknown; elapsedSec?: number };

  const payload = examToken ? decryptExamToken(examToken) : null;
  if (!payload || payload.kind !== "daily" || payload.studentId !== student.id) {
    return NextResponse.json({ error: "유효하지 않거나 만료된 시험입니다. 다시 시작해주세요." }, { status: 400 });
  }

  const total = payload.problems.length;
  const ansArr = Array.isArray(answers) ? answers : [];
  let score = 0;
  const detail = payload.problems.map((p, i) => {
    const given = Number(ansArr[i]);
    const correct = given === p.answer;
    if (correct) score++;
    return { a: p.a, b: p.b, answer: p.answer, given: Number.isFinite(given) ? given : null, correct };
  });

  const stats = await todayStats(student.id, student.dailyTestLimit);
  if (!stats.canStartMore) {
    return NextResponse.json({ error: "오늘은 더 이상 테스트를 제출할 수 없어요.", result: stats.dailyDone }, { status: 409 });
  }

  const today = todayKST();
  // 오늘 이미 한 번 이상 봤다면(취미로 더 풀어보는 경우) 연속 출석일은 이미 오늘 자로
  // 올라가 있으니 또 올리지 않는다. 오늘 첫 응시일 때만 어제 기준으로 연속 여부를 계산한다.
  const alreadyCountedToday = student.lastDailyTestDate === today;
  const yStr = todayKST(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const nextStreak = alreadyCountedToday ? student.streak : student.lastDailyTestDate === yStr ? student.streak + 1 : 1;

  const [record] = await prisma.$transaction([
    prisma.dailyTest.create({
      data: {
        studentId: student.id,
        date: today,
        score,
        total,
        elapsedSec: Number(elapsedSec) || null,
        detail,
      },
    }),
    prisma.student.update({
      where: { id: student.id },
      data: { streak: nextStreak, lastDailyTestDate: today },
    }),
  ]);
  await markOnboardingStepDone(student.id, 3);
  return NextResponse.json({ result: record, streak: nextStreak });
}
