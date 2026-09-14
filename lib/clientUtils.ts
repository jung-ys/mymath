export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

interface ErrorPayload {
  error?: string;
}

function isErrorPayload(x: unknown): x is ErrorPayload {
  return typeof x === "object" && x !== null && "error" in x;
}

export async function api<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: "same-origin",
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = isErrorPayload(data) && typeof data.error === "string" ? data.error : `요청 실패 (${res.status})`;
    throw new ApiError(message, res.status, data);
  }
  return data as T;
}

export function levelBadgeClass(level: number, masterLevel: number): string {
  if (level >= masterLevel) return "lv5"; // 완전 마스터도 5단계(마스터 단계)와 같은 색상
  return "lv" + Math.min(level, 5);
}

// 동메달 → 은메달 → 금메달 → 실버 왕관(4단계) → 골드 왕관(마스터 단계).
const LEVEL_EMOJIS = ["🥉", "🥈", "🥇", "🥈👑", "🥇👑"];

// 현재 단계를 눈에 띄게 보여주는 메달/왕관 이모지. 완전 마스터(level >= masterLevel)도
// 마스터 단계와 같은 골드 왕관으로 표시한다.
export function levelEmoji(level: number, masterLevel: number): string {
  if (level >= masterLevel) return LEVEL_EMOJIS[LEVEL_EMOJIS.length - 1];
  return LEVEL_EMOJIS[level - 1] ?? LEVEL_EMOJIS[0];
}

export function fmtDate(ts: string | number | Date | null | undefined): string {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtDateOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const [, m, d] = dateStr.split("-");
  return `${m}/${d}`;
}
