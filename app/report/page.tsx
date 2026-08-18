"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, levelBadgeClass, fmtDate, fmtDateOnly } from "@/lib/clientUtils";
import type { studentSummary } from "@/lib/studentView";
import type { RangeReportStats } from "@/lib/reportStats";
import { ACADEMY_NAME } from "@/lib/branding";

type ReportData = Awaited<ReturnType<typeof studentSummary>>;
type Readiness = NonNullable<Extract<ReportData["levelExam"], { readiness: unknown }>["readiness"]>;

function ReadinessBlock({ r }: { r: Readiness }) {
  const pct = Math.min(100, Math.round((r.qualifyingStreak / r.requiredStreak) * 100));
  return (
    <div className="card">
      <h2 className="mt0">다음 승급 시험 자격 기준</h2>
      <div className={`callout ${r.eligible ? "go" : "wait"}`}>{r.eligible ? "자격 기준 충족 — 승급 시험 응시 가능" : "아직 자격 기준 미충족"}</div>
      <div className="readiness">
        <div className="readiness-row">
          <div className="row-label">
            <span>연속 {r.requiredAccuracyPct}% 이상 달성</span>
            <span className={r.eligible ? "ok" : ""}>
              {r.qualifyingStreak}/{r.requiredStreak}회
            </span>
          </div>
          <div className="mini-track">
            <div className="mini-fill" style={{ width: `${pct}%`, background: r.eligible ? "var(--good)" : "var(--brand)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function trendLabel(trend: string, kind: "accuracy" | "speed"): { text: string; cls: string } {
  if (kind === "accuracy") {
    if (trend === "up") return { text: "▲ 상승", cls: "ok" };
    if (trend === "down") return { text: "▼ 하락", cls: "" };
    if (trend === "same") return { text: "▬ 유지", cls: "" };
  } else {
    if (trend === "faster") return { text: "▲ 빨라짐", cls: "ok" };
    if (trend === "slower") return { text: "▼ 느려짐", cls: "" };
    if (trend === "same") return { text: "▬ 유지", cls: "" };
  }
  return { text: "자료 부족", cls: "" };
}

function toISODateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function RangeReport({ studentId }: { studentId: string }) {
  const today = new Date();
  const defaultTo = toISODateInput(today);
  const defaultFrom = toISODateInput(new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000));

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [data, setData] = useState<{ stats: RangeReportStats; narrative: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const generate = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const result = await api<{ stats: RangeReportStats; narrative: string[] }>(
        `/api/admin/students/${studentId}/report?from=${from}&to=${to}`
      );
      setData(result);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "리포트를 생성하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [studentId, from, to]);

  useEffect(() => {
    void (async () => {
      await generate();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accTrend = data ? trendLabel(data.stats.accuracyTrend, "accuracy") : null;
  const speedTrend = data ? trendLabel(data.stats.speedTrend, "speed") : null;

  return (
    <>
      <div className="card no-print">
        <h2 className="mt0">📆 기간별 리포트 생성</h2>
        <div className="grid-2">
          <div>
            <label htmlFor="from-date">시작일</label>
            <input type="date" id="from-date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label htmlFor="to-date">종료일</label>
            <input type="date" id="to-date" value={to} min={from} max={defaultTo} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <button className="btn" onClick={generate} disabled={loading}>
          {loading ? "생성 중..." : "이 기간으로 리포트 생성"}
        </button>
        {err && <div className="error-box show">{err}</div>}
      </div>

      {data && (
        <>
          <div className="card report-letter">
            <h2 className="mt0">✉️ 학습 리포트 ({data.stats.from} ~ {data.stats.to})</h2>
            {data.narrative.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          <div className="card">
            <h2 className="mt0">📊 기간 요약</h2>
            <div className="stat-row">
              <div className="stat">
                <div className="num">{data.stats.attendanceRate}%</div>
                <div className="label">출석률 ({data.stats.daysAttended}/{data.stats.totalDaysInRange}일)</div>
              </div>
              <div className="stat">
                <div className="num">{data.stats.overallAccuracyPct}%</div>
                <div className="label">평균 정답률</div>
              </div>
              <div className="stat">
                <div className="num">{data.stats.longestStreakInRange}일</div>
                <div className="label">기간 내 최장 연속출석</div>
              </div>
              <div className="stat">
                <div className="num">{data.stats.currentWrongCount}개</div>
                <div className="label">현재 남은 오답</div>
              </div>
            </div>
            <div className="tag-row" style={{ marginTop: 14 }}>
              {accTrend && (
                <span className={`pill ${accTrend.cls === "ok" ? "pass" : ""}`}>
                  정답률 추이: {accTrend.text}
                  {data.stats.earlyAccuracyPct !== null && (
                    <> ({data.stats.earlyAccuracyPct}% → {data.stats.lateAccuracyPct}%)</>
                  )}
                </span>
              )}
              {speedTrend && (
                <span className={`pill ${speedTrend.cls === "ok" ? "pass" : ""}`}>
                  풀이 속도 추이: {speedTrend.text}
                  {data.stats.avgElapsedSecPerQEarly !== null && (
                    <>
                      {" "}
                      (문제당 {data.stats.avgElapsedSecPerQEarly}초 → {data.stats.avgElapsedSecPerQLate}초)
                    </>
                  )}
                </span>
              )}
              <span className="pill">오답 재테스트 {data.stats.retestAttempts}회 (완전정리 {data.stats.retestFullClears}회)</span>
              <span className="pill">승급 시험 {data.stats.levelExamAttempts}회 응시 · {data.stats.levelExamPasses}회 통과</span>
            </div>
          </div>

          <div className="card">
            <h2 className="mt0">기간 내 오늘의 테스트 기록</h2>
            {data.stats.dailyByDate.length ? (
              <table>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>점수</th>
                    <th>소요시간</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stats.dailyByDate.map((d, i) => (
                    <tr key={i}>
                      <td>{fmtDateOnly(d.date)}</td>
                      <td>
                        {d.score}/{d.total} ({Math.round((d.score / d.total) * 100)}%)
                      </td>
                      <td>{d.elapsedSec != null ? `${d.elapsedSec}초` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">이 기간에는 기록이 없어요.</p>
            )}
          </div>

          {data.stats.levelUpsInRange.length > 0 && (
            <div className="card">
              <h2 className="mt0">기간 내 레벨업 이력</h2>
              <table>
                <thead>
                  <tr>
                    <th>단계</th>
                    <th>날짜</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stats.levelUpsInRange.map((u, i) => (
                    <tr key={i}>
                      <td>{u.levelTitle} 통과</td>
                      <td>{fmtDate(u.awardedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

function ReportContent() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const [summary, setSummary] = useState<ReportData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    api<ReportData>(`/api/admin/students/${id}`)
      .then(setSummary)
      .catch((ex) => {
        if (ex instanceof ApiError && ex.status === 401) {
          router.replace("/admin");
          return;
        }
        setError(ex instanceof ApiError ? ex.message : "불러오지 못했습니다.");
      });
  }, [id, router]);

  if (!id) return <p className="error-box show">학생 정보가 없습니다.</p>;
  if (error) return <p className="error-box show">{error}</p>;
  if (!summary) return <div className="loading">불러오는 중...</div>;

  const { student, levelExam, masterLevel } = summary;
  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  const readiness = "readiness" in levelExam ? levelExam.readiness : null;

  return (
    <>
      <div className="hero" style={{ padding: "20px 0" }}>
        <p className="academy-name">{ACADEMY_NAME}</p>
        <h1>{student.name} 학생 학습 리포트</h1>
        <p className="muted">발행일: {today}</p>
      </div>

      <div className="card">
        <div className="flex-between">
          <span className={`badge ${levelBadgeClass(student.level, masterLevel)}`}>{student.levelTitle}</span>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            등록일 {fmtDateOnly(new Date(student.createdAt).toISOString().slice(0, 10))}
          </span>
        </div>
        <div className="stat-row">
          <div className="stat">
            <div className="num">{student.streak}</div>
            <div className="label">현재 연속 출석일</div>
          </div>
        </div>
      </div>

      {!student.isMaster && readiness && <ReadinessBlock r={readiness} />}

      <RangeReport studentId={student.id} />

      <p className="muted center" style={{ fontSize: "0.8rem" }}>
        {ACADEMY_NAME} · 구구단 레벨업 시스템에서 자동 생성된 리포트입니다.
      </p>
    </>
  );
}

export default function ReportPage() {
  return (
    <>
      <header className="topbar no-print">
        <div className="brand">
          <div className="brand-title">
            <span className="dot">✕</span> 구구단 레벨업 <span className="tag">학부모 리포트</span>
          </div>
          <div className="brand-academy">{ACADEMY_NAME}</div>
        </div>
        <nav>
          <button className="btn small" onClick={() => window.print()}>
            인쇄 / PDF 저장
          </button>
          <Link href="/admin">관리자로</Link>
        </nav>
      </header>
      <div className="wrap narrow">
        <Suspense fallback={<div className="loading">불러오는 중...</div>}>
          <ReportContent />
        </Suspense>
      </div>
    </>
  );
}
