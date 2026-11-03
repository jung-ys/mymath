"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/clientUtils";
import { ACADEMY_NAME, QUEUE_SYSTEM_NAME } from "@/lib/branding";
import { QUEUE_TYPE_EMOJI, QUEUE_TYPE_LABEL, QUEUE_TYPES, fmtAgo, type AdminQueueData, type AdminQueueItem, type QueueType } from "@/lib/queue";
import { playDingDong } from "@/lib/sound";

// 선생님 대시보드 — 확인 대기 / 질문 대기를 한눈에 보고, 오래 기다린 학생부터 호출한다.
// 처리 흐름: 호출 → 진행중 → 완료.

const POLL_MS = 3000;

export default function AdminQueuePage() {
  const [data, setData] = useState<AdminQueueData | null>(null);
  const [needsAdmin, setNeedsAdmin] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const knownIdsRef = useRef<Set<string> | null>(null);
  const soundOnRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const d = await api<AdminQueueData>("/api/admin/queue", { retries: 1 });
      // 새로 들어온 요청이 있으면 알림음 (첫 로딩 때는 울리지 않음)
      const ids = new Set([...d.waiting.check, ...d.waiting.question, ...d.called].map((r) => r.id));
      const known = knownIdsRef.current;
      if (known && soundOnRef.current && [...ids].some((id) => !known.has(id))) playDingDong();
      knownIdsRef.current = ids;
      setData(d);
      setNow(Date.now());
      setError("");
    } catch (ex) {
      if (ex instanceof ApiError && ex.status === 401) setNeedsAdmin(true);
      else setError("불러오지 못했어요. 인터넷 연결을 확인해 주세요.");
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  async function act(item: AdminQueueItem, action: "call" | "done" | "requeue" | "remove") {
    if (action === "remove" && !confirm(`${item.name} 학생의 ${QUEUE_TYPE_LABEL[item.type]}을 목록에서 지울까요?`)) return;
    setBusyId(item.id);
    try {
      await api(`/api/admin/queue/${item.id}`, { method: "POST", body: { action } });
    } catch (ex) {
      if (!(ex instanceof ApiError && ex.status === 409)) setError(ex instanceof ApiError ? ex.message : "처리하지 못했어요.");
    } finally {
      setBusyId(null);
      load();
    }
  }

  async function clearAll() {
    if (!confirm("대기 중·진행 중인 요청을 모두 지울까요? (수업이 끝났을 때 사용)")) return;
    await api("/api/admin/queue", { method: "DELETE" }).catch(() => {});
    load();
  }

  function toggleSound() {
    // 브라우저 자동재생 정책 때문에 소리는 사용자가 한 번 클릭해야만 켤 수 있다.
    // 그래서 저장해두지 않고, 대시보드를 열 때마다 이 버튼을 한 번 눌러 켠다.
    const next = !soundOn;
    soundOnRef.current = next;
    setSoundOn(next);
    if (next) playDingDong();
  }

  if (needsAdmin) {
    return (
      <div className="wrap narrow">
        <div className="card center" style={{ marginTop: 60 }}>
          <h2 className="mt0">🔒 선생님 로그인이 필요합니다</h2>
          <p className="muted">대기 대시보드는 선생님(관리자)으로 로그인한 브라우저에서만 볼 수 있어요.</p>
          <Link href="/admin" className="btn" style={{ display: "inline-block", marginTop: 12 }}>
            선생님 로그인하러 가기
          </Link>
        </div>
      </div>
    );
  }

  const waitingTotal = data ? data.waiting.check.length + data.waiting.question.length : 0;

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-title">
            <span className="dot">🙋</span> {QUEUE_SYSTEM_NAME} <span className="tag">선생님</span>
          </div>
          <div className="brand-academy">{ACADEMY_NAME}</div>
        </div>
        <nav>
          <Link href="/queue" target="_blank">
            학생 화면
          </Link>
          <Link href="/admin">관리자 홈</Link>
        </nav>
      </header>

      <div className="wrap wrap-wide">
        <div className="flex-between queue-toolbar">
          <div className="queue-summary">
            <span className="queue-chip check">
              {QUEUE_TYPE_EMOJI.check} 확인 대기 <b>{data?.waiting.check.length ?? "-"}</b>
            </span>
            <span className="queue-chip question">
              {QUEUE_TYPE_EMOJI.question} 질문 대기 <b>{data?.waiting.question.length ?? "-"}</b>
            </span>
            <span className="queue-chip called">
              🏃 진행 중 <b>{data?.called.length ?? "-"}</b>
            </span>
            <span className="queue-chip">
              오늘 완료 <b>{data ? data.doneToday.check + data.doneToday.question : "-"}</b>
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className={`btn small ${soundOn ? "" : "secondary"}`} onClick={toggleSound}>
              {soundOn ? "🔔 알림음 켜짐" : "🔕 알림음 켜기"}
            </button>
            <button className="btn small ghost" onClick={clearAll} disabled={!data || (waitingTotal === 0 && data.called.length === 0)}>
              전체 비우기
            </button>
          </div>
        </div>

        {error && <div className="error-box show">{error}</div>}
        {!data && !error && <div className="loading">불러오는 중...</div>}

        {data && (
          <>
            {data.called.length > 0 && (
              <div className="card queue-progress">
                <h3 className="mt0">🏃 진행 중</h3>
                <div className="queue-list">
                  {data.called.map((r) => (
                    <div className={`queue-row called ${r.type}`} key={r.id}>
                      <Avatar item={r} />
                      <div className="queue-row-main">
                        <div className="queue-row-name">
                          {r.name} <span className={`queue-type-tag ${r.type}`}>{QUEUE_TYPE_LABEL[r.type]}</span>
                        </div>
                        <div className="queue-row-sub">호출 {fmtAgo(r.calledAt, now)}</div>
                      </div>
                      <div className="queue-row-actions">
                        <button className="btn small ghost" disabled={busyId === r.id} onClick={() => act(r, "requeue")} title="대기열 원래 자리로">
                          ↩ 대기로
                        </button>
                        <button className="btn small queue-done-btn" disabled={busyId === r.id} onClick={() => act(r, "done")}>
                          ✔ 완료
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="queue-columns">
              {QUEUE_TYPES.map((t) => (
                <QueueColumn key={t} type={t} items={data.waiting[t]} now={now} busyId={busyId} onAct={act} />
              ))}
            </div>
          </>
        )}
      </div>
      <footer className="foot">3초마다 자동으로 갱신돼요 · 가장 오래 기다린 학생이 맨 위에 있어요.</footer>
    </>
  );
}

function Avatar({ item }: { item: AdminQueueItem }) {
  return <div className={`queue-avatar ${item.type}`}>{item.name.slice(0, 1)}</div>;
}

function QueueColumn({
  type,
  items,
  now,
  busyId,
  onAct,
}: {
  type: QueueType;
  items: AdminQueueItem[];
  now: number;
  busyId: string | null;
  onAct: (item: AdminQueueItem, action: "call" | "remove") => void;
}) {
  return (
    <div className={`card queue-col ${type}`}>
      <h3 className="mt0 queue-col-title">
        {QUEUE_TYPE_EMOJI[type]} {type === "check" ? "확인 대기 중" : "질문 대기 중"}
        <span className="queue-col-count">{items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className="muted center" style={{ padding: "24px 0" }}>
          기다리는 학생이 없어요 🙂
        </p>
      ) : (
        <div className="queue-list">
          {items.map((r, i) => (
            <div className={`queue-row ${i === 0 ? "first" : ""}`} key={r.id}>
              <div className="queue-order">{i + 1}</div>
              <Avatar item={r} />
              <div className="queue-row-main">
                <div className="queue-row-name">{r.name}</div>
                <div className="queue-row-sub">{fmtAgo(r.createdAt, now)} 요청</div>
              </div>
              <div className="queue-row-actions">
                <button className="link queue-remove" title="목록에서 지우기" disabled={busyId === r.id} onClick={() => onAct(r, "remove")}>
                  ✕
                </button>
                <button className={`btn small queue-call-btn ${type}`} disabled={busyId === r.id} onClick={() => onAct(r, "call")}>
                  호출
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
