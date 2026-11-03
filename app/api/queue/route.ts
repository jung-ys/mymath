import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  QUEUE_MAX_ACTIVE,
  QUEUE_NAME_MAX,
  isQueueType,
  isValidClientId,
  staleCutoff,
  type MyQueueRequest,
  type QueueType,
} from "@/lib/queue";

// 학생용 대기 API. 로그인 없이 쓰는 화면이라(회원가입·비밀번호 없음) 기기마다 무작위로
// 만든 clientId로 "내 요청"을 구분한다. clientId를 모르는 사람은 남의 요청을 볼 수도,
// 취소할 수도 없다.

async function myRequests(clientId: string): Promise<MyQueueRequest[]> {
  const cutoff = staleCutoff();
  const mine = await prisma.queueRequest.findMany({
    where: { clientId, status: { in: ["waiting", "called"] }, createdAt: { gte: cutoff } },
    orderBy: { createdAt: "asc" },
  });
  return Promise.all(
    mine.map(async (r) => {
      let position = 0;
      if (r.status === "waiting") {
        // 같은 줄(확인요청/질문)에서 나보다 먼저 온 대기 학생 수 + 1 = 내 순서
        const ahead = await prisma.queueRequest.count({
          where: { type: r.type, status: "waiting", createdAt: { gte: cutoff, lt: r.createdAt } },
        });
        position = ahead + 1;
      }
      return {
        id: r.id,
        type: r.type as QueueType,
        name: r.name,
        status: r.status as "waiting" | "called",
        position,
        createdAt: r.createdAt.toISOString(),
      };
    })
  );
}

// 내 요청 상태(대기 순서 / 호출됨) 조회 — 학생 화면이 몇 초마다 부른다.
export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!isValidClientId(clientId)) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  return NextResponse.json({ requests: await myRequests(clientId) });
}

// 확인요청 / 질문하기 버튼
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { clientId, type } = body as { clientId?: unknown; type?: unknown };
  const name = typeof body.name === "string" ? body.name.trim().slice(0, QUEUE_NAME_MAX) : "";

  if (!isValidClientId(clientId) || !isQueueType(type)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });

  const cutoff = staleCutoff();

  // 같은 줄에 이미 서 있으면 새로 줄 서지 않고 기존 순서를 그대로 돌려준다(버튼 연타 방지).
  const existing = await prisma.queueRequest.findFirst({
    where: { clientId, type, status: { in: ["waiting", "called"] }, createdAt: { gte: cutoff } },
  });
  if (!existing) {
    const activeCount = await prisma.queueRequest.count({
      where: { status: { in: ["waiting", "called"] }, createdAt: { gte: cutoff } },
    });
    if (activeCount >= QUEUE_MAX_ACTIVE) {
      return NextResponse.json({ error: "대기 인원이 너무 많아요. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    }
    await prisma.queueRequest.create({ data: { clientId, type, name } });
  }

  return NextResponse.json({ requests: await myRequests(clientId) });
}

// 학생이 스스로 요청 취소 (예: 기다리다 혼자 해결했을 때)
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { clientId, id } = body as { clientId?: unknown; id?: unknown };
  if (!isValidClientId(clientId) || typeof id !== "string") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  await prisma.queueRequest.updateMany({
    where: { id, clientId, status: { in: ["waiting", "called"] } },
    data: { status: "cancelled", doneAt: new Date() },
  });
  return NextResponse.json({ requests: await myRequests(clientId) });
}
