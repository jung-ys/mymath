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
  if (level >= masterLevel) return "lv5";
  return "lv" + level;
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
