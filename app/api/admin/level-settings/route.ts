import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/apiAuth";
import { LEVELS } from "@/lib/levels";
import { getLevelTimeSettingsMap } from "@/lib/examSettings";

// 단계별 승급 시험 제한시간 "전체 적용" 설정을 조회/저장한다.
// 개별 학생 제한시간은 /api/admin/students/[id]/exam-time 에서 따로 다룬다.
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const overrides = await getLevelTimeSettingsMap();
  const levels = LEVELS.map((l) => ({
    level: l.level,
    title: l.title,
    defaultTimeLimitSec: l.examConfig.timeLimitSec,
    overrideTimeLimitSec: overrides[l.level] ?? null,
  }));
  return NextResponse.json({ levels });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const level = Number(body.level);
  if (!LEVELS.some((l) => l.level === level)) {
    return NextResponse.json({ error: "유효하지 않은 단계입니다." }, { status: 400 });
  }

  // timeLimitSec이 없거나 0 이하면 설정을 지워서 기본 계산값으로 되돌린다.
  const timeLimitSec = Number(body.timeLimitSec);
  if (!Number.isFinite(timeLimitSec) || timeLimitSec <= 0) {
    await prisma.levelTimeSetting.deleteMany({ where: { level } });
    return NextResponse.json({ level, overrideTimeLimitSec: null });
  }

  const clamped = Math.min(3600 * 3, Math.max(30, Math.round(timeLimitSec)));
  await prisma.levelTimeSetting.upsert({
    where: { level },
    create: { level, timeLimitSec: clamped },
    update: { timeLimitSec: clamped },
  });
  return NextResponse.json({ level, overrideTimeLimitSec: clamped });
}
