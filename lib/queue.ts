// 교실 대기 시스템(번호표 대체) 공통 정의.
// "확인요청"과 "질문하기"는 서로 다른 두 개의 줄(큐)로 따로 관리한다.

export const QUEUE_TYPES = ["check", "question"] as const;
export type QueueType = (typeof QUEUE_TYPES)[number];

export const QUEUE_TYPE_LABEL: Record<QueueType, string> = {
  check: "확인요청",
  question: "질문하기",
};

export const QUEUE_TYPE_EMOJI: Record<QueueType, string> = {
  check: "✅",
  question: "❓",
};

export type QueueStatus = "waiting" | "called" | "done" | "cancelled";

// 이보다 오래된 미처리 요청은 지난 수업에서 남은 것으로 보고 무시한다
// (선생님이 완료를 깜빡해도 다음 수업 대기열이 꼬이지 않도록).
export const QUEUE_STALE_MS = 12 * 60 * 60 * 1000;

// 장난으로 대기열을 도배하지 못하게 하는 전체 상한.
export const QUEUE_MAX_ACTIVE = 200;

export const QUEUE_NAME_MAX = 20;

export function isQueueType(x: unknown): x is QueueType {
  return typeof x === "string" && (QUEUE_TYPES as readonly string[]).includes(x);
}

export function isValidClientId(x: unknown): x is string {
  return typeof x === "string" && /^[A-Za-z0-9-]{16,64}$/.test(x);
}

export function staleCutoff(): Date {
  return new Date(Date.now() - QUEUE_STALE_MS);
}

export interface MyQueueRequest {
  id: string;
  type: QueueType;
  name: string;
  status: "waiting" | "called";
  position: number; // 대기 중일 때 내 순서(1부터). 호출된 상태면 0
  createdAt: string;
}

export interface AdminQueueItem {
  id: string;
  type: QueueType;
  name: string;
  status: "waiting" | "called";
  createdAt: string;
  calledAt: string | null;
}

export interface AdminQueueData {
  waiting: Record<QueueType, AdminQueueItem[]>;
  called: AdminQueueItem[];
  doneToday: Record<QueueType, number>;
  serverNow: string;
}

// "방금 전" / "3분 전" 처럼 요청 후 지난 시간을 사람이 읽기 쉽게
export function fmtAgo(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return "";
  const min = Math.floor((nowMs - new Date(iso).getTime()) / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분 전`;
}
