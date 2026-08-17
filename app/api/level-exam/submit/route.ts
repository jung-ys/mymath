import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthedStudent } from "@/lib/apiAuth";
import { levelExamAttemptToday } from "@/lib/studentView";
import { decryptExamToken } from "@/lib/examToken";
import { todayKST, getLevelDef, MASTER_LEVEL } from "@/lib/levels";

export async function POST(req: NextRequest) {
  const student = await getAuthedStudent(req);
  if (!student) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { examToken, answers, elapsedSec } = body as { examToken?: string; answers?: unknown; elapsedSec?: number };

  const payload = examToken ? decryptExamToken(examToken) : null;
  if (!payload || payload.kind !== "level" || payload.studentId !== student.id) {
    return NextResponse.json({ error: "유효하지 않거나 만료된 시험입니다. 다시 시작해주세요." }, { status: 400 });
  }
  if (payload.level !== student.level) {
    return NextResponse.json({ error: "단계 정보가 일치하지 않습니다. 다시 시작해주세요." }, { status: 400 });
  }
  if (await levelExamAttemptToday(student.id, student.level)) {
    return NextResponse.json({ error: "오늘은 이미 이 단계 승급 시험에 응시했습니다." }, { status: 409 });
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

  const config = payload.config;
  const elapsed = Number(elapsedSec) || 0;
  const timedOut = elapsed > (config.timeLimitSec ?? Infinity) + (config.graceSec ?? 0);
  const passed = score >= (config.passScore ?? Infinity) && !timedOut;

  const today = todayKST();
  const completedLevel = student.level;
  const nextLevel = passed ? Math.min(completedLevel + 1, MASTER_LEVEL) : completedLevel;

  try {
    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.levelExam.create({
        data: {
          studentId: student.id,
          level: completedLevel,
          date: today,
          score,
          total,
          passed,
          timedOut,
          elapsedSec: elapsed,
          detail,
        },
      }),
    ];
    if (passed) {
      ops.push(
        prisma.student.update({ where: { id: student.id }, data: { level: nextLevel } }),
        prisma.levelUp.create({ data: { studentId: student.id, level: completedLevel } })
      );
    }
    const [record] = (await prisma.$transaction(ops)) as [Awaited<ReturnType<typeof prisma.levelExam.create>>, ...unknown[]];

    const newLevelDef = passed && nextLevel < MASTER_LEVEL ? getLevelDef(nextLevel) : null;
    return NextResponse.json({
      result: record,
      leveledUp: passed,
      isMaster: nextLevel >= MASTER_LEVEL,
      newLevel: nextLevel,
      newLevelDef,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "오늘은 이미 이 단계 승급 시험에 응시했습니다." }, { status: 409 });
    }
    throw err;
  }
}
