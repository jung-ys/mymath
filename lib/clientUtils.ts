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

export function fmtDuration(sec: number | null | undefined): string {
  if (sec == null || sec < 0) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

export function fmtDateOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const [, m, d] = dateStr.split("-");
  return `${m}/${d}`;
}

// 시험 문제 그리드(.problem input)에서 마우스 없이 방향키만으로 자유롭게 칸을 옮겨다닐 수
// 있게 하는 핸들러. 몇 열짜리 그리드인지 몰라도(화면 크기에 따라 열 수가 바뀌어도) 실제
// 화면에 렌더링된 위치(위/아래/왼쪽/오른쪽에서 가장 가까운 칸)를 기준으로 이동한다.
// Enter는 다음 칸으로 이동하고, 마지막 칸에서 Enter를 누르면 onLastEnter(보통 제출)를 부른다.
export function handleProblemGridKeyDown(
  e: { key: string; preventDefault: () => void },
  index: number,
  onLastEnter: () => void
) {
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(".problem input"));
  const cur = inputs[index];

  if (e.key === "Enter") {
    e.preventDefault();
    const next = inputs[index + 1];
    if (next) next.focus();
    else onLastEnter();
    return;
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    inputs[index + 1]?.focus();
    return;
  }
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    inputs[index - 1]?.focus();
    return;
  }
  if ((e.key === "ArrowDown" || e.key === "ArrowUp") && cur) {
    e.preventDefault();
    const curRect = cur.getBoundingClientRect();
    const dir = e.key === "ArrowDown" ? 1 : -1;
    const others = inputs
      .map((el, idx) => ({ el, idx, rect: el.getBoundingClientRect() }))
      .filter((c) => (dir === 1 ? c.rect.top > curRect.top + 4 : c.rect.top < curRect.top - 4));
    if (!others.length) return;
    const targetTop = dir === 1 ? Math.min(...others.map((c) => c.rect.top)) : Math.max(...others.map((c) => c.rect.top));
    const rowCandidates = others.filter((c) => Math.abs(c.rect.top - targetTop) < 4);
    let best = rowCandidates[0];
    let bestDist = Math.abs(best.rect.left - curRect.left);
    for (const c of rowCandidates) {
      const d = Math.abs(c.rect.left - curRect.left);
      if (d < bestDist) {
        best = c;
        bestDist = d;
      }
    }
    best.el.focus();
  }
}
