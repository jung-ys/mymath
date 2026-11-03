import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/apiAuth";

type Ctx = { params: Promise<{ id: string }> };

// 요청 하나의 상태 변경: 호출(→ 진행중) / 완료 / 다시 대기로 / 삭제
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "선생님 로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const now = new Date();

  let result;
  if (action === "call") {
    result = await prisma.queueRequest.updateMany({
      where: { id, status: "waiting" },
      data: { status: "called", calledAt: now },
    });
  } else if (action === "done") {
    result = await prisma.queueRequest.updateMany({
      where: { id, status: { in: ["waiting", "called"] } },
      data: { status: "done", doneAt: now },
    });
  } else if (action === "requeue") {
    // 원래 요청 시각(createdAt)은 그대로 두므로 대기열의 원래 자리로 돌아간다.
    result = await prisma.queueRequest.updateMany({
      where: { id, status: "called" },
      data: { status: "waiting", calledAt: null },
    });
  } else if (action === "remove") {
    result = await prisma.queueRequest.updateMany({
      where: { id, status: { in: ["waiting", "called"] } },
      data: { status: "cancelled", doneAt: now },
    });
  } else {
    return NextResponse.json({ error: "알 수 없는 작업입니다." }, { status: 400 });
  }

  if (result.count === 0) {
    return NextResponse.json({ error: "이미 처리되었거나 없는 요청입니다." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
