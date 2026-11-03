import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/apiAuth";
import { staleCutoff, type AdminQueueData, type AdminQueueItem, type QueueType } from "@/lib/queue";

// 오늘(KST) 0시의 UTC 시각
function startOfTodayKST(): Date {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - 9 * 60 * 60 * 1000);
}

// 선생님 대시보드 — 확인 대기 / 질문 대기 두 줄을 오래 기다린 순서대로 보여준다.
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "선생님 로그인이 필요합니다." }, { status: 401 });

  const rows = await prisma.queueRequest.findMany({
    where: { status: { in: ["waiting", "called"] }, createdAt: { gte: staleCutoff() } },
    orderBy: { createdAt: "asc" },
  });

  const toItem = (r: (typeof rows)[number]): AdminQueueItem => ({
    id: r.id,
    type: r.type as QueueType,
    name: r.name,
    status: r.status as "waiting" | "called",
    createdAt: r.createdAt.toISOString(),
    calledAt: r.calledAt ? r.calledAt.toISOString() : null,
  });

  const doneGroups = await prisma.queueRequest.groupBy({
    by: ["type"],
    where: { status: "done", doneAt: { gte: startOfTodayKST() } },
    _count: { _all: true },
  });
  const doneToday: Record<QueueType, number> = { check: 0, question: 0 };
  for (const g of doneGroups) {
    if (g.type === "check" || g.type === "question") doneToday[g.type] = g._count._all;
  }

  const data: AdminQueueData = {
    waiting: {
      check: rows.filter((r) => r.status === "waiting" && r.type === "check").map(toItem),
      question: rows.filter((r) => r.status === "waiting" && r.type === "question").map(toItem),
    },
    called: rows
      .filter((r) => r.status === "called")
      .sort((a, b) => (a.calledAt?.getTime() ?? 0) - (b.calledAt?.getTime() ?? 0))
      .map(toItem),
    doneToday,
    serverNow: new Date().toISOString(),
  };
  return NextResponse.json(data);
}

// 대기열 전체 비우기 (수업 끝났을 때 등)
export async function DELETE(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "선생님 로그인이 필요합니다." }, { status: 401 });
  const { count } = await prisma.queueRequest.updateMany({
    where: { status: { in: ["waiting", "called"] } },
    data: { status: "cancelled", doneAt: new Date() },
  });
  return NextResponse.json({ ok: true, cleared: count });
}
