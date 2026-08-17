"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, levelBadgeClass, fmtDate, fmtDateOnly } from "@/lib/clientUtils";
import type { studentSummary } from "@/lib/studentView";

type ReportData = Awaited<ReturnType<typeof studentSummary>>;
type Readiness = NonNullable<Extract<ReportData["levelExam"], { readiness: unknown }>["readiness"]>;

function ReadinessBlock({ r }: { r: Readiness }) {
  const streakPct = Math.min(100, Math.round((r.streak / r.minStreakDays) * 100));
  const accBase = r.recentCount > 0 ? r.avgAccuracyPct : 0;
  const accPct = Math.min(100, Math.round((accBase / r.minAvgAccuracyPct) * 100));
  const accLabel = r.recentCount < r.minRecentTests ? `기록 ${r.recentCount}/${r.minRecentTests}회` : `${r.avgAccuracyPct}%`;
  return (
    <div className="card">
      <h2 className="mt0">다음 승급 시험 자격 기준</h2>
      <div className={`callout ${r.eligible ? "go" : "wait"}`}>{r.eligible ? "자격 기준 충족 — 승급 시험 응시 가능" : "아직 자격 기준 미충족"}</div>
      <div className="readiness">
        <div className="readiness-row">
          <div className="row-label">
            <span>연속 출석</span>
            <span className={r.streakOk ? "ok" : ""}>{r.streak}/{r.minStreakDays}일</span>
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
    </div>
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

  const { student, history, levelExam, masterLevel } = summary;
  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  const readiness = "readiness" in levelExam ? levelExam.readiness : null;

  return (
    <>
      <div className="hero" style={{ padding: "20px 0" }}>
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
            <div className="label">연속 출석일</div>
          </div>
          <div className="stat">
            <div className="num">{history.levelUps.length}</div>
            <div className="label">누적 레벨업</div>
          </div>
          <div className="stat">
            <div className="num">{history.daily.length}</div>
            <div className="label">최근 테스트 기록 수</div>
          </div>
        </div>
      </div>

      {!student.isMaster && readiness && <ReadinessBlock r={readiness} />}

      <div className="card">
        <h2 className="mt0">최근 오늘의 테스트 성적 추이</h2>
        {history.daily.length ? (
          <table>
            <thead>
              <tr>
                <th>날짜</th>
                <th>점수</th>
              </tr>
            </thead>
            <tbody>
              {history.daily
                .slice()
                .reverse()
                .map((d) => (
                  <tr key={d.id}>
                    <td>{fmtDateOnly(d.date)}</td>
                    <td>
                      {d.score}/{d.total} ({Math.round((d.score / d.total) * 100)}%)
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">아직 기록이 없어요.</p>
        )}
      </div>

      <div className="card">
        <h2 className="mt0">레벨업 이력</h2>
        {history.levelUps.length ? (
          <table>
            <thead>
              <tr>
                <th>단계</th>
                <th>날짜</th>
                <th>보상</th>
              </tr>
            </thead>
            <tbody>
              {history.levelUps.map((u) => (
                <tr key={u.id}>
                  <td>{u.level}단계 통과</td>
                  <td>{fmtDate(u.awardedAt)}</td>
                  <td>{u.rewardGiven ? "지급 완료" : "지급 대기"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">아직 레벨업 기록이 없어요.</p>
        )}
      </div>

      <p className="muted center" style={{ fontSize: "0.8rem" }}>
        구구단 레벨업 시스템에서 자동 생성된 리포트입니다.
      </p>
    </>
  );
}

export default function ReportPage() {
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="dot">✕</span> 구구단 레벨업 <span className="tag">학부모 리포트</span>
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
