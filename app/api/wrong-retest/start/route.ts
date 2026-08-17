import { NextRequest, NextResponse } from "next/server";
import { getAuthedStudent } from "@/lib/apiAuth";
import { computeCurrentWrongPairs } from "@/lib/retest";
import { encryptExamToken } from "@/lib/examToken";

const RETEST_SEC_PER_QUESTION = 12;

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function POST(req: NextRequest) {
  const student = await getAuthedStudent(req);
  if (!student) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const wrongPairs = await computeCurrentWrongPairs(student.id);
  if (wrongPairs.length === 0) {
    return NextResponse.json({ error: "지금은 틀린 문제가 없어요! 완벽해요 🎉", empty: true }, { status: 409 });
  }

  const problems = shuffle(wrongPairs).map(({ a, b }) => ({ a, b, answer: a * b }));
  const config = { questionCount: problems.length, timeLimitSec: Math.round(problems.length * RETEST_SEC_PER_QUESTION) };

  const examToken = encryptExamToken({
    studentId: student.id,
    kind: "retest",
    level: student.level,
    problems,
    config,
    createdAt: Date.now(),
  });

  return NextResponse.json({ examToken, problems: problems.map(({ a, b }) => ({ a, b })), config });
}
