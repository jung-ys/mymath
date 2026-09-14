"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, handleProblemGridKeyDown } from "@/lib/clientUtils";
import { ACADEMY_NAME } from "@/lib/branding";
import { playStartChime, playTick, playExplosion, playPassFanfare, playFailTone } from "@/lib/sound";

interface LevelOpt {
  level: number;
  title: string;
  defaultTimeLimitSec: number;
  overrideTimeLimitSec: number | null;
}
interface Problem {
  a: number;
  b: number;
}
interface ExamConfig {
  questionCount: number;
  timeLimitSec: number;
  passScore?: number;
  graceSec?: number;
}
interface ProblemDetail {
  a: number;
  b: number;
  answer: number;
  given: number | null;
  correct: boolean;
}
interface PreviewResult {
  score: number;
  total: number;
  passed: boolean;
  timedOut: boolean;
  detail: ProblemDetail[];
}

// 선생님이 "감"을 잡기 위해 승급 시험을 직접 체험해보는 화면. 학생 기록과 무관하게
// 순수 체험용이라 몇 번이든 다시 해볼 수 있고, 어떤 결과도 저장되지 않는다.
export default function TryExamPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [levels, setLevels] = useState<LevelOpt[]>([]);
  const [level, setLevel] = useState(1);
  const [phase, setPhase] = useState<"pick" | "exam" | "result">("pick");
  const [examToken, setExamToken] = useState("");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [config, setConfig] = useState<ExamConfig | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [startTs, setStartTs] = useState(0);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [err, setErr] = useState("");
  const submittedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickSlotRef = useRef<number | null>(null);

  useEffect(() => {
    api<{ authed: boolean; type?: string }>("/api/me")
      .then((me) => setAuthed(!!me.authed && me.type === "admin"))
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (!authed) return;
    api<{ levels: LevelOpt[] }>("/api/admin/level-settings")
      .then((d) => setLevels(d.levels))
      .catch(() => {});
  }, [authed]);

  async function start() {
    setErr("");
    try {
      const data = await api<{ examToken: string; problems: Problem[]; config: ExamConfig }>("/api/admin/exam-preview/start", {
        method: "POST",
        body: { level },
      });
      submittedRef.current = false;
      setExamToken(data.examToken);
      setProblems(data.problems);
      setConfig(data.config);
      setAnswers(new Array(data.problems.length).fill(""));
      setRemaining(data.config.timeLimitSec);
      setStartTs(Date.now());
      setResult(null);
      setPhase("exam");
      playStartChime();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "시작하지 못했습니다.");
    }
  }

  async function submit(timedOut: boolean) {
    if (submittedRef.current) return;
    submittedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    void timedOut;
    const elapsedSec = Math.round((Date.now() - startTs) / 1000);
    const parsedAnswers = answers.map((v) => (v.trim() === "" ? null : Number(v)));
    try {
      const data = await api<PreviewResult>("/api/admin/exam-preview/submit", {
        method: "POST",
        body: { examToken, answers: parsedAnswers, elapsedSec },
      });
      setResult(data);
      setPhase("result");
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "제출에 실패했습니다.");
    }
  }

  // 타이머 + 효과음 — 학생 승급 시험 화면과 동일한 연출을 그대로 체험한다.
  useEffect(() => {
    if (phase !== "exam" || !config) return;
    lastTickSlotRef.current = null;
    timerRef.current = setInterval(() => {
      const elapsedMs = Date.now() - startTs;
      const left = Math.max(0, config.timeLimitSec - Math.floor(elapsedMs / 1000));
      setRemaining(left);
      if (left > 0) {
        const tickIntervalMs = left <= 3 ? 250 : left <= 7 ? 500 : left <= 15 ? 1000 : null;
        if (tickIntervalMs) {
          const slot = Math.floor(elapsedMs / tickIntervalMs);
          if (lastTickSlotRef.current !== slot) {
            lastTickSlotRef.current = slot;
            playTick(left <= 7);
          }
        }
      }
      if (left <= 0) {
        if (!submittedRef.current) playExplosion();
        void submit(true);
      }
    }, 250);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, config]);

  useEffect(() => {
    if (phase !== "result" || !result) return;
    if (result.passed) playPassFanfare();
    else playFailTone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (authed === null) return <div className="loading">불러오는 중...</div>;
  if (!authed) {
    return (
      <div className="wrap narrow">
        <p className="error-box show">
          관리자 로그인이 필요합니다. <Link href="/admin">관리자 로그인으로 이동</Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-title">
            <span className="dot">✕</span> 승급 시험 체험 <span className="tag">관리자</span>
          </div>
          <div className="brand-academy">{ACADEMY_NAME}</div>
        </div>
        <nav>
          <Link href="/admin">관리자로</Link>
        </nav>
      </header>

      <div className={`wrap${phase !== "pick" ? " wrap-wide" : " narrow"}`}>
        {phase === "pick" && (
          <div className="card">
            <h2 className="mt0">🧪 승급 시험 미리 체험해보기</h2>
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              학생이 실제로 겪는 것과 똑같은 문제 수/제한시간/효과음으로 체험해볼 수 있어요. 여기서 본
              시험은 <strong>어떤 학생 기록에도 저장되지 않으니</strong> 몇 번이든 편하게 다시 해보세요.
            </p>
            <label htmlFor="preview-level">체험할 단계</label>
            <select id="preview-level" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
              {levels.map((l) => (
                <option key={l.level} value={l.level}>
                  {l.title} ({Math.round((l.overrideTimeLimitSec ?? l.defaultTimeLimitSec) / 60)}분)
                </option>
              ))}
            </select>
            <button className="btn" onClick={start}>
              시작하기
            </button>
            {err && <div className="error-box show">{err}</div>}
          </div>
        )}

        {phase === "exam" && config && (
          <div className="card exam-box level-exam">
            <h2 className="mt0">🏆 {levels.find((l) => l.level === level)?.title ?? ""} 승급 시험 체험</h2>
            <div
              className={`timer timer-level${remaining <= 15 ? " timer-urgent" : ""}`}
              style={{ color: remaining <= 30 ? "var(--bad)" : undefined }}
            >
              {String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${(remaining / config.timeLimitSec) * 100}%` }} />
            </div>
            <div className="problem-grid">
              {problems.map((p, i) => (
                <div className="problem" key={i}>
                  <span className="idx">{i + 1}</span>
                  <span className="eq">
                    {p.a} × {p.b} =
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={answers[i] ?? ""}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                      const next = answers.slice();
                      next[i] = digitsOnly;
                      setAnswers(next);
                    }}
                    onKeyDown={(e) => handleProblemGridKeyDown(e, i, () => void submit(false))}
                  />
                </div>
              ))}
            </div>
            <button className="btn" style={{ width: "100%" }} onClick={() => submit(false)}>
              제출하기
            </button>
          </div>
        )}

        {phase === "result" && result && (
          <>
            <div className={`result-banner ${result.passed ? "pass" : "fail"}`}>
              <div className="confetti">{result.passed ? "🎉🏆🎉" : "💪"}</div>
              <h2>{result.passed ? "통과!" : "미통과"}</h2>
              <div className="score">
                {result.score} / {result.total}
              </div>
              {result.timedOut && <p className="muted">시간 초과로 자동 제출되었어요.</p>}
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                (이 결과는 저장되지 않았어요)
              </p>
            </div>
            <div className="card">
              <h2 className="mt0">채점 결과</h2>
              <div className="problem-grid">
                {result.detail.map((d, i) => (
                  <div className={`problem ${d.correct ? "correct" : "wrong"}`} key={i}>
                    <span className="idx">{i + 1}</span>
                    <span className="eq">
                      {d.a} × {d.b} = {d.answer}
                    </span>
                    {!d.correct && <span className="ans-key">내 답: {d.given === null ? "(공백)" : d.given}</span>}
                  </div>
                ))}
              </div>
              <button className="btn" style={{ width: "100%" }} onClick={() => setPhase("pick")}>
                다시 체험하기
              </button>
            </div>
          </>
        )}
      </div>

      <footer className="foot">관리자 체험 모드 · 결과는 어디에도 저장되지 않습니다.</footer>
    </>
  );
}
