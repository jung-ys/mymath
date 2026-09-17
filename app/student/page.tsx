"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { api, ApiError, levelEmoji, fmtDate, handleProblemGridKeyDown } from "@/lib/clientUtils";
import { ACADEMY_NAME } from "@/lib/branding";
import { rewardLabel } from "@/lib/rewards";
import { FINAL_LEVEL } from "@/lib/levels";
import { playStartChime, playTick, playExplosion, playPassFanfare, playFailTone } from "@/lib/sound";
import {
  CHEER_MESSAGES,
  LEVEL_PASS_MESSAGES,
  LEVEL_FAIL_MESSAGES,
  RETEST_CLEAR_MESSAGES,
  RETEST_PARTIAL_MESSAGES,
  pickRandom,
} from "@/lib/encouragement";

interface LevelDef {
  level: number;
  title: string;
  range: string;
}
interface ExamConfig {
  questionCount: number;
  timeLimitSec: number;
  passScore?: number;
  graceSec?: number;
}
interface Readiness {
  eligible: boolean;
  qualifyingStreak: number;
  requiredStreak: number;
  requiredAccuracyPct: number;
  totalTestsSoFar: number;
  coveredCount: number;
  requiredCoverageCount: number;
  fullyCovered: boolean;
}
interface Summary {
  student: {
    id: string;
    name: string;
    level: number;
    levelTitle: string;
    isMaster: boolean;
    streak: number;
  };
  masterLevel: number;
  wrongCount: number;
  dailyTest: {
    taken: boolean;
    result: { score: number; total: number } | null;
    config: ExamConfig;
  };
  levelExam:
    | { available: false; reason: string }
    | {
        available: boolean;
        attemptedToday: boolean;
        readiness: Readiness;
        levelDef: LevelDef;
        config: ExamConfig;
      };
  history: {
    daily: { date: string; score: number; total: number; takenAt: string }[];
    levelExams: { level: number; score: number; total: number; passed: boolean; takenAt: string }[];
    levelUps: unknown[];
  };
}

interface Problem {
  a: number;
  b: number;
}

interface ExamState {
  kind: "daily" | "level" | "retest";
  examToken: string;
  problems: Problem[];
  config: ExamConfig;
  levelDef?: LevelDef;
  startTs: number;
  forcedWrongCount?: number;
}

interface ProblemDetail {
  a: number;
  b: number;
  answer: number;
  given: number | null;
  correct: boolean;
}
interface DailyResultRecord {
  id: string;
  score: number;
  total: number;
  detail: ProblemDetail[];
}
interface LevelResultRecord extends DailyResultRecord {
  passed: boolean;
  level: number;
}
interface DailySubmitResponse {
  result: DailyResultRecord;
  streak: number;
}
interface LevelSubmitResponse {
  result: LevelResultRecord;
  leveledUp: boolean;
  confirmPending: boolean; // 이번엔 100%를 받았지만, 승급 확정을 위한 두 번째 100%가 아직 필요함
  isMaster: boolean;
  newLevel: number;
  newLevelDef: LevelDef | null;
}
interface RetestSubmitResponse {
  result: DailyResultRecord;
  stillWrong: number;
  allCleared: boolean;
}
type SubmitResponse = DailySubmitResponse | LevelSubmitResponse | RetestSubmitResponse;

function ReadinessBars({ r }: { r: Readiness }) {
  const streakPct = Math.min(100, Math.round((r.qualifyingStreak / r.requiredStreak) * 100));
  const coveragePct = r.requiredCoverageCount > 0 ? Math.min(100, Math.round((r.coveredCount / r.requiredCoverageCount) * 100)) : 0;
  return (
    <div className="readiness">
      <div className="readiness-row">
        <div className="row-label">
          <span>이 단계 문제 전체 연습 완료</span>
          <span className={r.fullyCovered ? "ok" : ""}>
            {r.coveredCount}/{r.requiredCoverageCount}개
          </span>
        </div>
        <div className="mini-track">
          <div className="mini-fill" style={{ width: `${coveragePct}%`, background: r.fullyCovered ? "var(--good)" : "var(--brand)" }} />
        </div>
      </div>
      <div className="readiness-row">
        <div className="row-label">
          <span>연속 {r.requiredAccuracyPct}% 이상 달성</span>
          <span className={r.qualifyingStreak >= r.requiredStreak ? "ok" : ""}>
            {r.qualifyingStreak}/{r.requiredStreak}회
          </span>
        </div>
        <div className="mini-track">
          <div
            className="mini-fill"
            style={{ width: `${streakPct}%`, background: r.qualifyingStreak >= r.requiredStreak ? "var(--good)" : "var(--brand)" }}
          />
        </div>
      </div>
    </div>
  );
}

export default function StudentPage() {
  const router = useRouter();
  const [view, setView] = useState<"loading" | "error" | "dashboard" | "exam" | "result">("loading");
  const [name, setName] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [examState, setExamState] = useState<ExamState | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [resultData, setResultData] = useState<SubmitResponse | null>(null);
  const [timedOutFlag, setTimedOutFlag] = useState(false);
  const submittedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickSlotRef = useRef<number | null>(null);

  const loadSummary = useCallback(async () => {
    const s = await api<Summary>("/api/student/summary", { retries: 2 });
    setSummary(s);
    setView("dashboard");
  }, []);

  const checkAuthAndLoad = useCallback(async () => {
    try {
      // retries: 모바일에서 앱 아이콘을 눌러 막 켰을 때 네트워크가 잠깐 불안정한 경우가
      // 흔해서, 그걸 "로그아웃됨"으로 착각해 로그인 화면으로 튕기지 않도록 몇 번 재시도한다.
      const me = await api<{ authed: boolean; type?: string; student?: { name: string } }>("/api/me", { retries: 2 });
      if (!me.authed || me.type !== "student") {
        router.replace("/");
        return;
      }
      setName(me.student!.name);
      await loadSummary();
    } catch {
      // 서버가 "로그인 안 됨"이라고 명확히 답한 게 아니라 재시도까지 다 실패한 네트워크
      // 문제이므로, 로그인 화면으로 보내는 대신 다시 시도할 수 있는 화면을 보여준다.
      setView("error");
    }
  }, [router, loadSummary]);

  useEffect(() => {
    void (async () => {
      await checkAuthAndLoad();
    })();
  }, [checkAuthAndLoad]);

  async function logout() {
    await api("/api/logout", { method: "POST" });
    router.push("/");
  }

  async function startExam(kind: "daily" | "level" | "retest") {
    const startEndpoint =
      kind === "daily" ? "/api/daily-test/start" : kind === "level" ? "/api/level-exam/start" : "/api/wrong-retest/start";
    try {
      const data = await api<{
        examToken: string;
        problems: Problem[];
        config: ExamConfig;
        levelDef?: LevelDef;
        forcedWrongCount?: number;
      }>(startEndpoint, { method: "POST" });
      submittedRef.current = false;
      setTimedOutFlag(false);
      setExamState({
        kind,
        examToken: data.examToken,
        problems: data.problems,
        config: data.config,
        levelDef: data.levelDef,
        startTs: Date.now(),
        forcedWrongCount: data.forcedWrongCount,
      });
      setAnswers(new Array(data.problems.length).fill(""));
      setRemaining(data.config.timeLimitSec);
      setView("exam");
      if (kind === "level") playStartChime();
    } catch (ex) {
      alert(ex instanceof ApiError ? ex.message : "시작하지 못했습니다.");
      if (ex instanceof ApiError && (ex.status === 409 || ex.status === 403)) await loadSummary();
    }
  }

  const submitExam = useCallback(
    async (timedOut: boolean) => {
      if (!examState || submittedRef.current) return;
      submittedRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      setTimedOutFlag(timedOut);

      const elapsedSec = Math.round((Date.now() - examState.startTs) / 1000);
      const parsedAnswers = answers.map((v) => (v.trim() === "" ? null : Number(v)));

      try {
        const endpoint =
          examState.kind === "daily"
            ? "/api/daily-test/submit"
            : examState.kind === "level"
              ? "/api/level-exam/submit"
              : "/api/wrong-retest/submit";
        const data = await api<SubmitResponse>(endpoint, {
          method: "POST",
          body: { examToken: examState.examToken, answers: parsedAnswers, elapsedSec },
        });
        setResultData(data);
        setView("result");
      } catch (ex) {
        alert(ex instanceof ApiError ? ex.message : "제출에 실패했습니다.");
        await loadSummary();
      }
    },
    [examState, answers, loadSummary]
  );

  // 타이머 — 승급 시험(kind === "level")에서는 시간이 얼마 안 남았을 때 "똑딱" 소리가
  // 점점 빨라지고(막판엔 거의 심장박동처럼), 시간 초과되면 폭탄 터지는 효과음이 난다.
  useEffect(() => {
    if (view !== "exam" || !examState) return;
    lastTickSlotRef.current = null;
    timerRef.current = setInterval(() => {
      const elapsedMs = Date.now() - examState.startTs;
      const left = Math.max(0, examState.config.timeLimitSec - Math.floor(elapsedMs / 1000));
      setRemaining(left);

      if (examState.kind === "level" && left > 0) {
        // 남은 시간에 따라 "똑" 소리 간격을 점점 좁혀서 조바심 나는 효과를 준다.
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
        if (examState.kind === "level" && !submittedRef.current) playExplosion();
        submitExam(true);
      }
    }, 250);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [view, examState, submitExam]);

  if (view === "loading") {
    return <div className="loading">불러오는 중...</div>;
  }

  if (view === "error") {
    return (
      <div className="wrap narrow">
        <div className="card center" style={{ marginTop: 60 }}>
          <h2 className="mt0">📶 연결이 불안정해요</h2>
          <p className="muted">로그인은 유지되어 있어요. 인터넷 연결을 확인하고 다시 시도해주세요.</p>
          <button
            className="btn"
            style={{ marginTop: 8 }}
            onClick={() => {
              setView("loading");
              void checkAuthAndLoad();
            }}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-title">
            <span className="dot">✕</span> 구구단 레벨업
          </div>
          <div className="brand-academy">{ACADEMY_NAME}</div>
        </div>
        <nav>
          <span className="muted">{name} 님</span>
          <button className="link" onClick={logout}>
            로그아웃
          </button>
        </nav>
      </header>

      <div className={`wrap${(view === "exam" || view === "result") && examState?.kind === "level" ? " wrap-wide" : ""}`}>
        {view === "dashboard" && summary && (
          <Dashboard
            summary={summary}
            onStartDaily={() => startExam("daily")}
            onStartLevel={() => startExam("level")}
            onStartRetest={() => startExam("retest")}
          />
        )}

        {view === "exam" && examState && (
          <div
            className={`card exam-box${examState.kind === "level" ? " level-exam" : ""}${examState.kind === "daily" ? " daily-exam" : ""}`}
          >
            {examState.kind === "daily" ? (
              <div className="exam-head-fun">
                <span className="emoji">📅</span> 오늘의 테스트, 화이팅!
              </div>
            ) : (
              <h2 className="mt0">
                {examState.kind === "retest" ? "🔁 오답 다시 풀기" : `🏆 ${examState.levelDef?.title ?? ""} 승급 시험`}
              </h2>
            )}
            {examState.kind === "daily" && !!examState.forcedWrongCount && (
              <p className="muted center" style={{ fontSize: "0.85rem", marginTop: -4 }}>
                이 중 {examState.forcedWrongCount}문제는 예전에 틀렸던 문제 복습이에요 🔁
              </p>
            )}
            <div
              className={`timer${examState.kind === "level" ? " timer-level" : ""}${remaining <= 15 && examState.kind === "level" ? " timer-urgent" : ""}`}
              style={{ color: remaining <= 30 ? "var(--bad)" : undefined }}
            >
              {String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${(remaining / examState.config.timeLimitSec) * 100}%` }} />
            </div>
            <div className="problem-grid">
              {examState.problems.map((p, i) => (
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
                    onKeyDown={(e) => handleProblemGridKeyDown(e, i, () => submitExam(false))}
                  />
                </div>
              ))}
            </div>
            <button className="btn" style={{ width: "100%" }} onClick={() => submitExam(false)}>
              제출하기
            </button>
          </div>
        )}

        {view === "result" && resultData && (
          <ResultView
            data={resultData}
            timedOut={timedOutFlag}
            onDone={async () => {
              setExamState(null);
              setResultData(null);
              await loadSummary();
            }}
          />
        )}
      </div>

      <footer className="foot">구구단 레벨업 · 매일 조금씩, 꾸준히!</footer>
    </>
  );
}

function Dashboard({
  summary,
  onStartDaily,
  onStartLevel,
  onStartRetest,
}: {
  summary: Summary;
  onStartDaily: () => void;
  onStartLevel: () => void;
  onStartRetest: () => void;
}) {
  const { student, dailyTest, levelExam, history, wrongCount } = summary;

  const dailyCard = dailyTest.taken ? (
    <div className="card">
      <h2 className="mt0">📅 오늘의 테스트</h2>
      <div className="result-banner" style={{ padding: 16 }}>
        <div className="score">
          {dailyTest.result!.score} / {dailyTest.result!.total}
        </div>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          오늘 테스트를 완료했어요. 내일 또 도전하세요!
        </p>
      </div>
    </div>
  ) : (
    <div className="card">
      <h2 className="mt0">📅 오늘의 테스트</h2>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        {dailyTest.config.questionCount}문제, 제한시간 {Math.floor(dailyTest.config.timeLimitSec / 60)}분. 지금까지 배운 단을
        복습해요.
      </p>
      <button className="btn" onClick={onStartDaily}>
        오늘의 테스트 시작
      </button>
    </div>
  );

  let levelExamCard: React.ReactNode;
  if (!("levelDef" in levelExam)) {
    levelExamCard = (
      <div className="card">
        <h2 className="mt0">🏆 승급 시험</h2>
        <p>{student.isMaster ? "모든 단계(2단~19단)를 마스터했어요! 대단해요!" : levelExam.reason}</p>
      </div>
    );
  } else {
    const r = levelExam.readiness;
    let callout: React.ReactNode;
    let disabled = true;
    if (!r.eligible) {
      callout = (
        <div className="callout wait">
          아직 승급 시험 자격 기준을 채우지 못했어요. 이 단계의 문제({r.requiredCoverageCount}개)를 전부{" "}
          한 번씩 풀어보고, 오늘의 테스트에서 연속 {r.requiredAccuracyPct}% 이상을 {r.requiredStreak}회
          달성하면 시험을 볼 수 있어요!
        </div>
      );
    } else if (levelExam.attemptedToday) {
      callout = <div className="callout go">자격을 갖췄어요! 오늘은 이미 응시했으니 내일 다시 도전하세요.</div>;
    } else {
      callout = <div className="callout go">🎉 자격 기준을 모두 채웠어요! 지금 승급 시험을 볼 수 있어요.</div>;
      disabled = false;
    }
    levelExamCard = (
      <div className="card">
        <h2 className="mt0">
          🏆 {levelExam.levelDef.title} 승급 시험 <span className="tag">{levelExam.levelDef.range}</span>
        </h2>
        {callout}
        <ReadinessBars r={r} />
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          {levelExam.config.questionCount}문제 <strong>전부 정답(100점)</strong>, 제한시간{" "}
          {Math.floor(levelExam.config.timeLimitSec / 60)}분 안에 풀어야 통과예요.
          {levelExam.levelDef.level === FINAL_LEVEL && (
            <>
              {" "}
              그리고 <strong>두 번 연속 100점</strong>을 받아야 최종 마스터가 확정돼요!
            </>
          )}
        </p>
        <button className="btn" disabled={disabled} onClick={onStartLevel}>
          승급 시험 시작
        </button>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          승급 시험을 통과하면 다음 단계로 올라가요. 선생님께 알려서 <strong>{rewardLabel(levelExam.levelDef.level)}</strong>을
          받으세요! 🎉
        </p>
      </div>
    );
  }

  const historyRows = [
    ...history.daily.map((d) => ({
      typeLabel: "오늘의 테스트",
      score: d.score,
      total: d.total,
      passed: null as boolean | null,
      ts: d.takenAt,
    })),
    ...history.levelExams.map((e) => ({
      typeLabel: `${e.level}단계 승급시험`,
      score: e.score,
      total: e.total,
      passed: e.passed,
      ts: e.takenAt,
    })),
  ]
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, 12);

  return (
    <>
      <div className="hero-fun">
        <span className="op-deco" style={{ top: 8, left: 12, fontSize: "2rem", transform: "rotate(-10deg)" }}>
          +
        </span>
        <span className="op-deco" style={{ top: 6, right: 14, fontSize: "2.3rem", transform: "rotate(10deg)" }}>
          ×
        </span>
        <Image src="/icon.png" alt="" width={64} height={64} className="icon-badge" priority />
        <h1 className="fun-title" style={{ fontSize: "1.5rem" }}>
          {levelEmoji(student.level, summary.masterLevel)} {student.levelTitle}
        </h1>
        <p>오늘도 조금씩, 꾸준히 화이팅! 💪</p>
        <div className="stat-fun-row">
          <div className="chip">
            <span className="num">🔥 {student.streak}</span>
            <span className="label">연속 출석일</span>
          </div>
          <div className="chip">
            <span className="num">🏅 {history.levelUps.length}</span>
            <span className="label">누적 레벨업</span>
          </div>
        </div>
      </div>
      {wrongCount > 0 && (
        <div className="card">
          <h2 className="mt0">🔁 오답 다시 풀기</h2>
          <div className="callout wait">그동안 틀렸던 문제가 {wrongCount}개 남아있어요. 다 맞힐 때까지 몇 번이든 다시 풀 수 있어요!</div>
          <button className="btn" onClick={onStartRetest}>
            오답 {wrongCount}개 다시 풀기
          </button>
        </div>
      )}
      <div className="grid-2">
        {dailyCard}
        {levelExamCard}
      </div>
      <div className="card">
        <h2 className="mt0">최근 기록</h2>
        {historyRows.length ? (
          <table>
            <thead>
              <tr>
                <th>종류</th>
                <th>날짜/시각</th>
                <th>점수</th>
                <th>결과</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.map((h, i) => (
                <tr key={i}>
                  <td>{h.typeLabel}</td>
                  <td>{fmtDate(h.ts)}</td>
                  <td>
                    {h.score}/{h.total}
                  </td>
                  <td>
                    {h.passed === null ? (
                      "-"
                    ) : (
                      <span className={`pill ${h.passed ? "pass" : "fail"}`}>{h.passed ? "통과" : "미통과"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">아직 기록이 없어요. 오늘의 테스트부터 시작해보세요!</p>
        )}
      </div>
    </>
  );
}

function Mascot({ mood, message }: { mood: "cheer" | "strong" | "soft"; message: string }) {
  const face = mood === "strong" ? "🐻👏" : mood === "soft" ? "🐻" : "🐻🎉";
  return (
    <div className={`mascot mascot-${mood}`}>
      <div className="mascot-face">{face}</div>
      <div className="mascot-bubble">{message}</div>
    </div>
  );
}

function ResultView({ data, timedOut, onDone }: { data: SubmitResponse; timedOut: boolean; onDone: () => void }) {
  const isLevel = "leveledUp" in data;
  const isRetest = "stillWrong" in data;
  const result = data.result;
  const detail = result.detail;

  // 결과 화면이 다시 렌더링돼도 멘트가 계속 바뀌지 않도록 결과 id에 묶어 한 번만 고른다.
  const mascotMessage = useMemo(() => {
    if (isLevel) return pickRandom(data.result.passed ? LEVEL_PASS_MESSAGES : LEVEL_FAIL_MESSAGES);
    if (isRetest) return pickRandom(data.allCleared ? RETEST_CLEAR_MESSAGES : RETEST_PARTIAL_MESSAGES);
    return pickRandom(CHEER_MESSAGES);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.id]);

  // 승급 시험 결과 효과음 — 결과 id당 한 번만 재생한다.
  useEffect(() => {
    if (!isLevel) return;
    if (data.result.passed) playPassFanfare();
    else playFailTone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.id]);

  let banner: React.ReactNode;
  let mascotMood: "cheer" | "strong" | "soft";
  if (isLevel) {
    const passed = data.result.passed; // 이번 응시 100% 여부
    const { leveledUp, confirmPending } = data;
    mascotMood = leveledUp ? "strong" : confirmPending ? "cheer" : "soft";
    banner = (
      <div className={`result-banner ${passed ? "pass" : "fail"}`}>
        <div className="confetti">{leveledUp ? "🎉🏆🎉" : confirmPending ? "✅" : "💪"}</div>
        <h2>
          {leveledUp
            ? "축하해요! 승급 성공!"
            : confirmPending
              ? "100점이에요! 한 번만 더 확인할게요"
              : "아쉬워요, 다음에 다시 도전!"}
        </h2>
        <div className="score">
          {result.score} / {result.total}
        </div>
        {timedOut && <p className="muted">시간 초과로 자동 제출되었어요.</p>}
        {leveledUp ? (
          <p>
            선생님께 말씀드리고 <strong>{rewardLabel(data.result.level)}</strong>을 받아가세요! 🍬
          </p>
        ) : confirmPending ? (
          <p className="muted">
            우연이 아닌지 한 번 더 확인해요. <strong>다음 번 응시에서도 100점</strong>을 받으면 그때 승급이 확정돼요!
          </p>
        ) : (
          <p className="muted">내일 다시 응시할 수 있어요. 오늘의 테스트로 연습해봐요!</p>
        )}
      </div>
    );
  } else if (isRetest) {
    mascotMood = data.allCleared ? "strong" : "cheer";
    banner = (
      <div className={`result-banner ${data.allCleared ? "pass" : ""}`}>
        <div className="confetti">{data.allCleared ? "🎉✏️🎉" : "🔁"}</div>
        <h2>{data.allCleared ? "오답을 전부 다 맞혔어요!" : "오답 다시 풀기 완료"}</h2>
        <div className="score">
          {result.score} / {result.total}
        </div>
        {data.allCleared ? (
          <p className="muted">이제 남은 오답이 없어요. 완벽해요!</p>
        ) : (
          <p className="muted">아직 {data.stillWrong}개 남았어요. 대시보드로 돌아가면 다시 도전할 수 있어요.</p>
        )}
      </div>
    );
  } else {
    mascotMood = "cheer";
    banner = (
      <div className="result-banner pass">
        <div className="confetti">✏️</div>
        <h2>오늘의 테스트 완료!</h2>
        <div className="score">
          {result.score} / {result.total}
        </div>
        <p>
          연속 출석 <strong>{data.streak}일째</strong> 🔥
        </p>
      </div>
    );
  }

  return (
    <>
      {banner}
      <Mascot mood={mascotMood} message={mascotMessage} />
      <div className="card">
        <h2 className="mt0">채점 결과</h2>
        <div className="problem-grid">
          {detail.map((d, i) => (
            <div className={`problem ${d.correct ? "correct" : "wrong"}`} key={i}>
              <span className="idx">{i + 1}</span>
              <span className="eq">
                {d.a} × {d.b} = {d.answer}
              </span>
              {!d.correct && <span className="ans-key">내 답: {d.given === null ? "(공백)" : d.given}</span>}
            </div>
          ))}
        </div>
        <button className="btn" style={{ width: "100%" }} onClick={onDone}>
          확인
        </button>
      </div>
    </>
  );
}
