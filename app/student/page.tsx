"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, levelBadgeClass, fmtDateOnly } from "@/lib/clientUtils";

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
  streakOk: boolean;
  accuracyOk: boolean;
  streak: number;
  minStreakDays: number;
  recentCount: number;
  minRecentTests: number;
  avgAccuracyPct: number;
  minAvgAccuracyPct: number;
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
  const streakPct = Math.min(100, Math.round((r.streak / r.minStreakDays) * 100));
  const accBase = r.recentCount > 0 ? r.avgAccuracyPct : 0;
  const accPct = Math.min(100, Math.round((accBase / r.minAvgAccuracyPct) * 100));
  const accLabel = r.recentCount < r.minRecentTests ? `기록 ${r.recentCount}/${r.minRecentTests}회` : `${r.avgAccuracyPct}%`;
  return (
    <div className="readiness">
      <div className="readiness-row">
        <div className="row-label">
          <span>
            연속 출석 <span className={r.streakOk ? "ok" : ""}>{r.streak}/{r.minStreakDays}일</span>
          </span>
        </div>
        <div className="mini-track">
          <div className="mini-fill" style={{ width: `${streakPct}%`, background: r.streakOk ? "var(--good)" : "var(--brand)" }} />
        </div>
      </div>
      <div className="readiness-row">
        <div className="row-label">
          <span>최근 {r.minRecentTests}회 평균 정답률</span>
          <span className={r.accuracyOk ? "ok" : ""}>
            {accLabel} / {r.minAvgAccuracyPct}%
          </span>
        </div>
        <div className="mini-track">
          <div className="mini-fill" style={{ width: `${accPct}%`, background: r.accuracyOk ? "var(--good)" : "var(--brand)" }} />
        </div>
      </div>
    </div>
  );
}

export default function StudentPage() {
  const router = useRouter();
  const [view, setView] = useState<"loading" | "dashboard" | "exam" | "result">("loading");
  const [name, setName] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [examState, setExamState] = useState<ExamState | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [resultData, setResultData] = useState<SubmitResponse | null>(null);
  const [timedOutFlag, setTimedOutFlag] = useState(false);
  const submittedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSummary = useCallback(async () => {
    const s = await api<Summary>("/api/student/summary");
    setSummary(s);
    setView("dashboard");
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const me = await api<{ authed: boolean; type?: string; student?: { name: string } }>("/api/me");
        if (!me.authed || me.type !== "student") {
          router.replace("/");
          return;
        }
        setName(me.student!.name);
        await loadSummary();
      } catch {
        router.replace("/");
      }
    })();
  }, [router, loadSummary]);

  async function logout() {
    await api("/api/logout", { method: "POST" });
    router.push("/");
  }

  async function startExam(kind: "daily" | "level" | "retest") {
    const startEndpoint =
      kind === "daily" ? "/api/daily-test/start" : kind === "level" ? "/api/level-exam/start" : "/api/wrong-retest/start";
    try {
      const data = await api<{ examToken: string; problems: Problem[]; config: ExamConfig; levelDef?: LevelDef }>(startEndpoint, {
        method: "POST",
      });
      submittedRef.current = false;
      setTimedOutFlag(false);
      setExamState({
        kind,
        examToken: data.examToken,
        problems: data.problems,
        config: data.config,
        levelDef: data.levelDef,
        startTs: Date.now(),
      });
      setAnswers(new Array(data.problems.length).fill(""));
      setRemaining(data.config.timeLimitSec);
      setView("exam");
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

  // 타이머
  useEffect(() => {
    if (view !== "exam" || !examState) return;
    timerRef.current = setInterval(() => {
      const elapsedMs = Date.now() - examState.startTs;
      const left = Math.max(0, examState.config.timeLimitSec - Math.floor(elapsedMs / 1000));
      setRemaining(left);
      if (left <= 0) submitExam(true);
    }, 250);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [view, examState, submitExam]);

  if (view === "loading") {
    return <div className="loading">불러오는 중...</div>;
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="dot">✕</span> 구구단 레벨업
        </div>
        <nav>
          <span className="muted">{name} 님</span>
          <Link href="/board">게시판</Link>
          <button className="link" onClick={logout}>
            로그아웃
          </button>
        </nav>
      </header>

      <div className="wrap">
        {view === "dashboard" && summary && (
          <Dashboard
            summary={summary}
            onStartDaily={() => startExam("daily")}
            onStartLevel={() => startExam("level")}
            onStartRetest={() => startExam("retest")}
          />
        )}

        {view === "exam" && examState && (
          <div className="card exam-box">
            <h2 className="mt0">
              {examState.kind === "daily"
                ? "📅 오늘의 테스트"
                : examState.kind === "retest"
                  ? "🔁 오답 다시 풀기"
                  : `🏆 ${examState.levelDef?.title ?? ""} 승급 시험`}
            </h2>
            <div className="timer" style={{ color: remaining <= 30 ? "var(--bad)" : undefined }}>
              {String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${(remaining / examState.config.timeLimitSec) * 100}%` }} />
            </div>
            <div className="problem-grid">
              {examState.problems.map((p, i) => (
                <div className="problem" key={i}>
                  <span className="idx">{i + 1}</span>
                  <span>
                    {p.a} × {p.b} =
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={answers[i] ?? ""}
                    onChange={(e) => {
                      const next = answers.slice();
                      next[i] = e.target.value;
                      setAnswers(next);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const nextInput = document.querySelectorAll<HTMLInputElement>(".problem input")[i + 1];
                        if (nextInput) nextInput.focus();
                        else submitExam(false);
                      }
                    }}
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
  const badgeClass = levelBadgeClass(student.level, summary.masterLevel);

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
      callout = <div className="callout wait">아직 승급 시험 자격 기준을 채우지 못했어요. 아래 두 가지를 모두 채우면 시험을 볼 수 있어요!</div>;
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
          {levelExam.config.questionCount}문제 중 {levelExam.config.passScore}개 이상, 제한시간{" "}
          {Math.floor(levelExam.config.timeLimitSec / 60)}분 안에 풀면 통과!
        </p>
        <button className="btn" disabled={disabled} onClick={onStartLevel}>
          승급 시험 시작
        </button>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          승급 시험을 통과하면 다음 단계로 올라가요. 선생님께 알려서 셀레나 달러와 간식 쿠폰을 받으세요! 🎉
        </p>
      </div>
    );
  }

  const historyRows = [
    ...history.daily.map((d) => ({
      typeLabel: "오늘의 테스트",
      dateLabel: fmtDateOnly(d.date),
      score: d.score,
      total: d.total,
      passed: null as boolean | null,
      ts: d.takenAt,
    })),
    ...history.levelExams.map((e) => ({
      typeLabel: `${e.level}단계 승급시험`,
      dateLabel: "",
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
      <div className="card flex-between">
        <div>
          <span className={`badge ${badgeClass}`}>{student.levelTitle}</span>
          <div className="stat-row">
            <div className="stat">
              <div className="num">{student.streak}</div>
              <div className="label">연속 출석일</div>
            </div>
            <div className="stat">
              <div className="num">{history.levelUps.length}</div>
              <div className="label">누적 레벨업</div>
            </div>
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
                <th>점수</th>
                <th>결과</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.map((h, i) => (
                <tr key={i}>
                  <td>{h.typeLabel}</td>
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

function ResultView({ data, timedOut, onDone }: { data: SubmitResponse; timedOut: boolean; onDone: () => void }) {
  const isLevel = "leveledUp" in data;
  const isRetest = "stillWrong" in data;
  const result = data.result;
  const detail = result.detail;

  let banner: React.ReactNode;
  if (isLevel) {
    const passed = data.result.passed;
    banner = (
      <div className={`result-banner ${passed ? "pass" : "fail"}`}>
        <div className="confetti">{passed ? "🎉🏆🎉" : "💪"}</div>
        <h2>{passed ? "축하해요! 승급 성공!" : "아쉬워요, 다음에 다시 도전!"}</h2>
        <div className="score">
          {result.score} / {result.total}
        </div>
        {timedOut && <p className="muted">시간 초과로 자동 제출되었어요.</p>}
        {passed ? (
          <p>
            선생님께 말씀드리고 <strong>셀레나 달러</strong>와 <strong>간식 쿠폰</strong>을 받아가세요! 🍬
          </p>
        ) : (
          <p className="muted">내일 다시 응시할 수 있어요. 오늘의 테스트로 연습해봐요!</p>
        )}
      </div>
    );
  } else if (isRetest) {
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
      <div className="card">
        <h2 className="mt0">채점 결과</h2>
        <div className="problem-grid">
          {detail.map((d, i) => (
            <div className={`problem ${d.correct ? "correct" : "wrong"}`} key={i}>
              <span className="idx">{i + 1}</span>
              <span>
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
