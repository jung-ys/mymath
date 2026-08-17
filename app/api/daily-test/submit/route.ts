import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthedStudent } from "@/lib/apiAuth";
import { decryptExamToken } from "@/lib/examToken";
import { todayKST } from "@/lib/levels";

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

  const today = todayKST();
  const yStr = todayKST(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const nextStreak = student.lastDailyTestDate === yStr ? student.streak + 1 : 1;

  try {
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
    return NextResponse.json({ result: record, streak: nextStreak });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.dailyTest.findUnique({ where: { studentId_date: { studentId: student.id, date: today } } });
      return NextResponse.json({ error: "오늘의 테스트는 이미 완료했습니다.", result: existing }, { status: 409 });
    }
    throw err;
  }
}
