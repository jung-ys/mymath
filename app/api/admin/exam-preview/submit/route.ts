import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/apiAuth";
import { decryptExamToken } from "@/lib/examToken";

// 관리자 체험용 채점 — 학생 계정/기록과 무관하게 순수 채점만 하고 아무것도 저장하지 않는다.
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { examToken, answers, elapsedSec } = body as { examToken?: string; answers?: unknown; elapsedSec?: number };

  const payload = examToken ? decryptExamToken(examToken) : null;
  if (!payload || payload.kind !== "level_preview") {
    return NextResponse.json({ error: "유효하지 않거나 만료된 체험입니다. 다시 시작해주세요." }, { status: 400 });
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

  return NextResponse.json({ score, total, passed, timedOut, elapsedSec: elapsed, detail });
}
