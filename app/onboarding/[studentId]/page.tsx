"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/clientUtils";
import { ACADEMY_NAME } from "@/lib/branding";
import { ONBOARDING_STEPS } from "@/lib/onboarding";

interface OnboardingStudent {
  id: string;
  studentName: string;
  completedSteps: number[];
}

interface OnboardingData {
  students: OnboardingStudent[];
}

export default function OnboardingPage() {
  const params = useParams<{ studentId: string }>();
  const pathParam = params.studentId;
  const [data, setData] = useState<OnboardingData | null>(null);
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const siteUrl = typeof window !== "undefined" ? `${window.location.origin}/` : "/";
  // 이 기기에 다른 학생(테스트 계정 등)이 로그인된 상태로 남아있어도, 온보딩 링크로 열 때는
  // 항상 로그인 화면부터 보여주도록 강제한다.
  const loginUrl = `${siteUrl}?login=1`;

  function load() {
    api<OnboardingData>(`/api/onboarding/${pathParam}`)
      .then(setData)
      .catch((ex) => setError(ex instanceof ApiError ? ex.message : "불러오지 못했습니다."));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathParam]);

  useEffect(() => {
    // 로그인/테스트를 다른 탭에서 마치고 이 화면으로 돌아왔을 때, 자동으로 완료 처리된
    // 단계가 있으면 새로고침 없이도 바로 반영되도록 한다.
    function onFocus() {
      load();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathParam]);

  // studentId를 생략하면(공통 단계) 링크에 묶인 모든 학생에게 한 번에 체크한다.
  async function complete(step: number, studentId?: string) {
    const key = studentId ? `${step}:${studentId}` : `${step}:all`;
    setSavingKey(key);
    try {
      await api(`/api/onboarding/${pathParam}/complete`, { method: "POST", body: studentId ? { step, studentId } : { step } });
      setData((prev) => {
        if (!prev) return prev;
        const targets = studentId ? [studentId] : prev.students.map((s) => s.id);
        return {
          students: prev.students.map((s) =>
            targets.includes(s.id) ? { ...s, completedSteps: [...new Set([...s.completedSteps, step])] } : s
          ),
        };
      });
    } catch {
      alert("처리하지 못했어요. 다시 시도해주세요.");
    } finally {
      setSavingKey(null);
    }
  }

  if (error) {
    return (
      <div className="wrap narrow">
        <p className="error-box show">{error}</p>
      </div>
    );
  }
  if (!data) return <div className="loading">불러오는 중...</div>;

  const students = data.students;
  const isGroup = students.length > 1;
  const step1Done = students.every((s) => s.completedSteps.includes(1));
  const totalCount = 1 + students.length * 2;
  const doneCount =
    (step1Done ? 1 : 0) +
    students.reduce((n, s) => n + (s.completedSteps.includes(2) ? 1 : 0) + (s.completedSteps.includes(3) ? 1 : 0), 0);
  const allDone = doneCount >= totalCount;
  const namesLabel = students.map((s) => s.studentName).join(" · ");

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-title">
            <span className="dot">✕</span> 구구단 레벨업 시작 안내
          </div>
          <div className="brand-academy">{ACADEMY_NAME}</div>
        </div>
      </header>

      <div className="wrap narrow">
        <div className="hero" style={{ padding: "28px 0 20px" }}>
          <p className="academy-name">{ACADEMY_NAME}</p>
          <h1 style={{ fontSize: "1.6rem" }}>{namesLabel} 학생 학부모님, 안녕하세요 👋</h1>
          <p className="muted">
            {isGroup
              ? "형제자매 두 분(또는 그 이상)을 한 번에 안내해드려요. 홈 화면 추가는 한 번만, 로그인과 오늘의 테스트는 아이마다 각각 진행해주세요."
              : `아래 ${ONBOARDING_STEPS.length}단계만 따라 하시면 집에서도 바로 학습을 시작할 수 있어요.`}
          </p>
        </div>

        <div className="card">
          <div className="flex-between" style={{ marginBottom: 4 }}>
            <strong>진행 상황</strong>
            <span className={doneCount > 0 ? "ok" : "muted"}>
              {doneCount} / {totalCount} 완료
            </span>
          </div>
          <div className="mini-track">
            <div
              className="mini-fill"
              style={{ width: `${(doneCount / totalCount) * 100}%`, background: allDone ? "var(--good)" : "var(--brand)" }}
            />
          </div>
          {allDone && <div className="callout go" style={{ marginTop: 12 }}>🎉 모든 준비가 끝났어요! 이제 집에서도 편하게 이용해주세요.</div>}
        </div>

        {/* ①단계: 홈 화면 추가 — 여러 학생이어도 사이트 주소는 같아서 한 번만 하면 된다 */}
        <div className="card" style={step1Done ? { borderColor: "var(--good)" } : undefined}>
          <h2 className="mt0">{ONBOARDING_STEPS[0].title}</h2>
          <p style={{ color: "var(--muted)" }}>{ONBOARDING_STEPS[0].description}</p>

          <a className="btn" href={loginUrl} target="_blank" rel="noopener noreferrer" style={{ width: "100%", textAlign: "center" }}>
            사이트 열기
          </a>
          <div className="tag-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 12, marginTop: 12 }}>
            <div>
              <strong>📱 안드로이드(갤럭시 등, 크롬 브라우저)</strong>
              <ol style={{ margin: "6px 0 0", paddingLeft: 20, color: "var(--muted)", fontSize: "0.9rem" }}>
                <li>위 버튼으로 연 화면에서</li>
                <li>화면 오른쪽 위 점 3개(⋮) 메뉴 누르기</li>
                <li>&quot;홈 화면에 추가&quot; 선택 → 추가</li>
              </ol>
            </div>
            <div>
              <strong>🍎 아이폰(사파리 브라우저)</strong>
              <ol style={{ margin: "6px 0 0", paddingLeft: 20, color: "var(--muted)", fontSize: "0.9rem" }}>
                <li>위 버튼으로 연 화면에서</li>
                <li>하단 공유 버튼(□ 위에 화살표) 누르기</li>
                <li>&quot;홈 화면에 추가&quot; 선택 → 추가</li>
              </ol>
            </div>
          </div>
          {isGroup ? (
            <p className="muted" style={{ fontSize: "0.8rem", marginTop: 10, marginBottom: 0 }}>
              {namesLabel} 모두를 위한 공통 단계예요. 홈 화면에 한 번만 추가하시면 아래 버튼 하나로 두 아이 모두 체크돼요.
            </p>
          ) : (
            <p className="muted" style={{ fontSize: "0.8rem", marginTop: 10, marginBottom: 0 }}>
              형제자매가 같은 학원에 다니고 있어 이미 앱을 홈 화면에 추가하셨다면, 다시
              추가하지 않으셔도 괜찮아요. 이 화면 아래 버튼만 눌러주세요.
            </p>
          )}

          <button
            className="btn"
            style={{ width: "100%", marginTop: 14, background: step1Done ? "var(--good)" : undefined }}
            disabled={step1Done || savingKey === "1:all"}
            onClick={() => complete(1)}
          >
            {step1Done ? "완료됨 ✓" : savingKey === "1:all" ? "처리 중..." : "완료했어요"}
          </button>
        </div>

        {/* ②③단계: 로그인/오늘의 테스트 — 아이마다 계정이 달라 각자 진행해야 한다 */}
        {ONBOARDING_STEPS.slice(1).map((s) => (
          <div className="card" key={s.step}>
            <h2 className="mt0">{s.title}</h2>
            <p style={{ color: "var(--muted)" }}>{s.description}</p>

            {students.map((st, i) => {
              const done = st.completedSteps.includes(s.step);
              const key = `${s.step}:${st.id}`;
              return (
                <div key={st.id} style={i > 0 ? { marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border, #e5e5e5)" } : undefined}>
                  {isGroup && <div style={{ fontWeight: 700, marginBottom: 8 }}>{st.studentName} 학생</div>}

                  {s.step === 2 && (
                    <>
                      <p className="muted" style={{ fontSize: "0.8rem", marginTop: 0 }}>
                        ①에서 홈 화면에 추가한 아이콘이 안 보이면, 아래 버튼으로도 접속할 수 있어요.
                      </p>
                      <a
                        className="btn secondary"
                        href={loginUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ width: "100%", textAlign: "center" }}
                      >
                        접속하기
                      </a>
                      <p className="muted" style={{ fontSize: "0.8rem", marginTop: 8, marginBottom: 0 }}>
                        로그인에 성공하면 이 단계는 자동으로 완료 처리돼요. 아래 버튼은 누르지 않아도 괜찮아요.
                      </p>
                    </>
                  )}

                  {s.step === 3 && (
                    <p className="muted" style={{ fontSize: "0.8rem", marginBottom: 0 }}>
                      테스트를 한 번 제출하면 이 단계는 자동으로 완료 처리돼요. 아래 버튼은 누르지 않아도 괜찮아요.
                    </p>
                  )}

                  <button
                    className="btn"
                    style={{ width: "100%", marginTop: 14, background: done ? "var(--good)" : undefined }}
                    disabled={done || savingKey === key}
                    onClick={() => complete(s.step, st.id)}
                  >
                    {done ? "완료됨 ✓" : savingKey === key ? "처리 중..." : "완료했어요"}
                  </button>
                </div>
              );
            })}
          </div>
        ))}

        <p className="muted center" style={{ fontSize: "0.85rem" }}>
          궁금한 점이 있으시면 언제든 학원으로 편하게 연락 주세요. 😊
        </p>
      </div>

      <footer className="foot">{ACADEMY_NAME} · 구구단 레벨업 시스템</footer>
    </>
  );
}
