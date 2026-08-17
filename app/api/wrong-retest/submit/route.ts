import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedStudent } from "@/lib/apiAuth";
import { decryptExamToken } from "@/lib/examToken";

export async function POST(req: NextRequest) {
  const student = await getAuthedStudent(req);
  if (!student) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { examToken, answers, elapsedSec } = body as { examToken?: string; answers?: unknown; elapsedSec?: number };

  const payload = examToken ? decryptExamToken(examToken) : null;
  if (!payload || payload.kind !== "retest" || payload.studentId !== student.id) {
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

  const record = await prisma.retestAttempt.create({
    data: {
      studentId: student.id,
      score,
      total,
      elapsedSec: Number(elapsedSec) || null,
      detail,
    },
  });

  const stillWrong = detail.filter((d) => !d.correct).length;
  return NextResponse.json({ result: record, stillWrong, allCleared: stillWrong === 0 });
}
