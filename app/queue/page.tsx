"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/clientUtils";
import { ACADEMY_NAME, QUEUE_SYSTEM_NAME } from "@/lib/branding";
import { QUEUE_NAME_MAX, QUEUE_TYPE_EMOJI, QUEUE_TYPE_LABEL, QUEUE_TYPES, type MyQueueRequest, type QueueType } from "@/lib/queue";
import { playCalled } from "@/lib/sound";

// 학생용 대기 화면. 번호표 대신 버튼 하나로 "확인요청" / "질문하기"를 하고, 내 순서를
// 실시간으로 확인한다. 회원가입·비밀번호 없이 처음 한 번 이름만 입력하면 이 기기에 기억된다.

const CLIENT_ID_KEY = "queue.clientId";
const NAME_KEY = "queue.name";
const POLL_MS = 3000;

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 사생활 보호 모드 등 저장이 막힌 경우 — 이번 접속 동안만 기억한다
  }
}

function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

export default function QueuePage() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [requests, setRequests] = useState<MyQueueRequest[]>([]);
  const [busy, setBusy] = useState<QueueType | null>(null);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");

  // 이전 폴링 결과 — 사라진 요청(=선생님이 완료 처리) / 새로 호출된 요청을 감지하는 데 쓴다.
  const prevRef = useRef<Map<string, MyQueueRequest>>(new Map());
  const selfCancelledRef = useRef<Set<string>>(new Set());

  // 처음 한 번: 기기 ID와 저장된 이름 불러오기. 이 기기에서 구구단 학생 로그인이 되어 있으면
  // 그 이름을 기본값으로 채워준다.
  useEffect(() => {
    // localStorage는 브라우저에서만 읽을 수 있으므로 화면이 뜬 직후에 읽는다.
    const t = setTimeout(() => {
      let id = safeGet(CLIENT_ID_KEY);
      if (!id || !/^[A-Za-z0-9-]{16,64}$/.test(id)) {
        id = newClientId();
        safeSet(CLIENT_ID_KEY, id);
      }
      setClientId(id);
      const saved = safeGet(NAME_KEY);
      if (saved) {
        setName(saved);
      } else {
        setName("");
        api<{ authed: boolean; type?: string; student?: { name: string } }>("/api/me")
          .then((me) => {
            if (me.authed && me.type === "student" && me.student?.name) setNameInput((v) => v || me.student!.name);
          })
          .catch(() => {});
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const applyRequests = useCallback((next: MyQueueRequest[]) => {
    const prev = prevRef.current;
    const nextMap = new Map(next.map((r) => [r.id, r]));

    for (const [id, old] of prev) {
      if (!nextMap.has(id) && !selfCancelledRef.current.has(id)) {
        setDoneMsg(`${QUEUE_TYPE_LABEL[old.type]} 완료! 잘했어요 👏`);
        setTimeout(() => setDoneMsg(""), 4000);
      }
    }
    for (const r of next) {
      const old = prev.get(r.id);
      if (r.status === "called" && old && old.status !== "called") {
        playCalled();
        try {
          navigator.vibrate?.([200, 100, 200]);
        } catch {}
      }
    }
    prevRef.current = nextMap;
    setRequests(next);
  }, []);

  const refresh = useCallback(async () => {
    if (!clientId) return;
    try {
      const d = await api<{ requests: MyQueueRequest[] }>(`/api/queue?clientId=${encodeURIComponent(clientId)}`, { retries: 1 });
      setOffline(false);
      applyRequests(d.requests);
    } catch {
      setOffline(true);
    }
  }, [clientId, applyRequests]);

  // 처음 들어왔을 때(새로고침 포함) 진행 중인 요청이 있는지 확인
  useEffect(() => {
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
  }, [refresh]);

  // 대기 중인 요청이 있을 때만 몇 초마다 내 순서를 갱신한다.
  const hasActive = requests.length > 0;
  useEffect(() => {
    if (!hasActive) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hasActive, refresh]);

  function saveName(e: React.FormEvent) {
    e.preventDefault();
    const v = nameInput.trim().slice(0, QUEUE_NAME_MAX);
    if (!v) return;
    safeSet(NAME_KEY, v);
    setName(v);
    setEditingName(false);
  }

  async function request(type: QueueType) {
    if (!clientId || !name) return;
    setBusy(type);
    setError("");
    try {
      const d = await api<{ requests: MyQueueRequest[] }>("/api/queue", { method: "POST", body: { clientId, name, type } });
      setDoneMsg("");
      applyRequests(d.requests);
    } catch (ex) {
      setError(ex instanceof ApiError ? ex.message : "요청하지 못했어요. 인터넷 연결을 확인해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  async function cancel(id: string) {
    if (!clientId) return;
    if (!confirm("요청을 취소할까요?")) return;
    selfCancelledRef.current.add(id);
    try {
      const d = await api<{ requests: MyQueueRequest[] }>("/api/queue", { method: "DELETE", body: { clientId, id } });
      applyRequests(d.requests);
    } catch {
      selfCancelledRef.current.delete(id);
      setError("취소하지 못했어요. 다시 시도해 주세요.");
    }
  }

  if (clientId === null || name === null) return <div className="loading">불러오는 중...</div>;

  const header = (
    <header className="topbar">
      <div className="brand">
        <div className="brand-title">
          <span className="dot">🙋</span> {QUEUE_SYSTEM_NAME}
        </div>
        <div className="brand-academy">{ACADEMY_NAME}</div>
      </div>
      <nav>
        <Link href="/">구구단 레벨업</Link>
      </nav>
    </header>
  );

  // 이름 입력 (처음 한 번만)
  if (!name || editingName) {
    return (
      <>
        {header}
        <div className="wrap narrow">
          <div className="card queue-card">
            <h2 className="mt0">👋 이름을 알려주세요</h2>
            <p className="muted">처음 한 번만 입력하면 이 기기에 기억돼요. 회원가입이나 비밀번호는 필요 없어요.</p>
            <form onSubmit={saveName}>
              <label htmlFor="queue-name">이름</label>
              <input
                id="queue-name"
                type="text"
                placeholder="예: 홍길동"
                maxLength={QUEUE_NAME_MAX}
                autoFocus
                required
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
              <button type="submit" className="btn" style={{ width: "100%" }}>
                시작하기
              </button>
              {editingName && (
                <button type="button" className="btn ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => setEditingName(false)}>
                  취소
                </button>
              )}
            </form>
          </div>
        </div>
      </>
    );
  }

  const byType = new Map(requests.map((r) => [r.type, r]));

  return (
    <>
      {header}
      <div className="wrap narrow">
        <div className="card queue-card">
          <div className="flex-between">
            <h2 className="mt0" style={{ marginBottom: 0 }}>
              {name} 님
            </h2>
            {!hasActive && (
              <button
                className="link"
                onClick={() => {
                  setNameInput(name);
                  setEditingName(true);
                }}
              >
                이름 바꾸기
              </button>
            )}
          </div>

          <div className="queue-buttons">
            {QUEUE_TYPES.map((t) => (
              <button
                key={t}
                className={`queue-btn ${t}`}
                disabled={busy !== null || byType.has(t)}
                onClick={() => request(t)}
              >
                <span className="queue-btn-emoji">{QUEUE_TYPE_EMOJI[t]}</span>
                {byType.has(t) ? `${QUEUE_TYPE_LABEL[t]} 중` : QUEUE_TYPE_LABEL[t]}
              </button>
            ))}
          </div>

          {doneMsg && <div className="queue-done">{doneMsg}</div>}
          {error && <div className="error-box show">{error}</div>}
          {offline && hasActive && <p className="muted center" style={{ fontSize: "0.85rem" }}>연결 확인 중... 순서는 그대로 유지돼요.</p>}

          {requests.map((r) =>
            r.status === "called" ? (
              <div key={r.id} className={`queue-status called ${r.type}`}>
                <div className="queue-status-label">{QUEUE_TYPE_LABEL[r.type]}</div>
                <div className="queue-called-big">🔔 내 차례예요!</div>
                <p>선생님이 호출했어요. 선생님께 가거나 자리에서 손을 들어주세요.</p>
              </div>
            ) : (
              <div key={r.id} className={`queue-status ${r.type}`}>
                <div className="queue-status-label">
                  {QUEUE_TYPE_EMOJI[r.type]} {QUEUE_TYPE_LABEL[r.type]}이 접수되었습니다!
                </div>
                <div className="queue-pos">
                  <span className="queue-pos-caption">내 순서</span>
                  <span className="queue-pos-num">{r.position}</span>
                </div>
                <p className="muted">
                  {r.position === 1 ? "곧 내 차례예요! 준비해 주세요." : `앞에 ${r.position - 1}명이 기다리고 있어요. 자리에서 공부하며 기다려요 ✏️`}
                </p>
                <button className="btn ghost small" onClick={() => cancel(r.id)}>
                  요청 취소
                </button>
              </div>
            )
          )}

          {!hasActive && !doneMsg && (
            <p className="muted center" style={{ marginTop: 18, fontSize: "0.9rem" }}>
              문제를 다 풀었으면 <b>확인요청</b>, 모르는 게 있으면 <b>질문하기</b>를 눌러요.
              <br />
              손 들고 기다리지 않아도 선생님이 순서대로 불러줄게요!
            </p>
          )}
        </div>
      </div>
      <footer className="foot">선생님이 완료하면 자동으로 버튼 화면으로 돌아와요.</footer>
    </>
  );
}
