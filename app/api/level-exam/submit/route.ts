import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthedStudent } from "@/lib/apiAuth";
import { levelExamAttemptToday } from "@/lib/studentView";
import { decryptExamToken } from "@/lib/examToken";
import { todayKST, getLevelDef, MASTER_LEVEL, FINAL_LEVEL } from "@/lib/levels";

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
  const passed = score >= (config.passScore ?? Infinity) && !timedOut; // 이번 응시에서 100%를 받았는가

  const today = todayKST();
  const completedLevel = student.level;

  // 1~4단계는 100%를 한 번만 받으면 바로 승급된다. 마지막 "마스터 단계"만 100%를
  // "연속 2회" 받아야 최종 확정된다 (한 번의 만점이 우연이 아님을 재확인하기 위함).
  // 하루 1회 제한이 있어 두 번째 응시는 자연히 다른 날이 된다 — 바로 직전 응시(이 단계
  // 기준 가장 최근 기록)가 100%였고, 이번에도 100%면 확정.
  let promote = passed;
  let confirmPending = false;
  if (passed && completedLevel === FINAL_LEVEL) {
    const priorAttempt = await prisma.levelExam.findFirst({
      where: { studentId: student.id, level: completedLevel },
      orderBy: { takenAt: "desc" },
    });
    promote = !!priorAttempt?.passed;
    confirmPending = !promote; // 이번엔 100%지만 아직 두 번째 확인이 필요함
  }
  const nextLevel = promote ? Math.min(completedLevel + 1, MASTER_LEVEL) : completedLevel;

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
    if (promote) {
      ops.push(
        prisma.student.update({ where: { id: student.id }, data: { level: nextLevel } }),
        prisma.levelUp.create({ data: { studentId: student.id, level: completedLevel } })
      );
    }
    const [record] = (await prisma.$transaction(ops)) as [Awaited<ReturnType<typeof prisma.levelExam.create>>, ...unknown[]];

    const newLevelDef = promote && nextLevel < MASTER_LEVEL ? getLevelDef(nextLevel) : null;
    return NextResponse.json({
      result: record,
      leveledUp: promote,
      confirmPending,
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
