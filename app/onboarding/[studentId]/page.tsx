"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/clientUtils";
import { ACADEMY_NAME } from "@/lib/branding";
import { ONBOARDING_STEPS } from "@/lib/onboarding";

interface OnboardingData {
  studentName: string;
  completedSteps: number[];
}

export default function OnboardingPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = params.studentId;
  const [data, setData] = useState<OnboardingData | null>(null);
  const [error, setError] = useState("");
  const [savingStep, setSavingStep] = useState<number | null>(null);
  const siteUrl = typeof window !== "undefined" ? `${window.location.origin}/` : "/";
  // 이 기기에 다른 학생(테스트 계정 등)이 로그인된 상태로 남아있어도, 온보딩 링크로 열 때는
  // 항상 로그인 화면부터 보여주도록 강제한다.
  const loginUrl = `${siteUrl}?login=1`;

  function load() {
    api<OnboardingData>(`/api/onboarding/${studentId}`)
      .then(setData)
      .catch((ex) => setError(ex instanceof ApiError ? ex.message : "불러오지 못했습니다."));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    // 로그인/테스트를 다른 탭에서 마치고 이 화면으로 돌아왔을 때, 자동으로 완료 처리된
    // 단계가 있으면 새로고침 없이도 바로 반영되도록 한다.
    function onFocus() {
      load();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function complete(step: number) {
    setSavingStep(step);
    try {
      await api(`/api/onboarding/${studentId}/complete`, { method: "POST", body: { step } });
      setData((prev) => (prev ? { ...prev, completedSteps: [...new Set([...prev.completedSteps, step])] } : prev));
    } catch {
      alert("처리하지 못했어요. 다시 시도해주세요.");
    } finally {
      setSavingStep(null);
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

  const doneCount = data.completedSteps.length;
  const allDone = doneCount >= ONBOARDING_STEPS.length;

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
          <h1 style={{ fontSize: "1.6rem" }}>{data.studentName} 학생 학부모님, 안녕하세요 👋</h1>
          <p className="muted">아래 {ONBOARDING_STEPS.length}단계만 따라 하시면 집에서도 바로 학습을 시작할 수 있어요.</p>
        </div>

        <div className="card">
          <div className="flex-between" style={{ marginBottom: 4 }}>
            <strong>진행 상황</strong>
            <span className={doneCount > 0 ? "ok" : "muted"}>
              {doneCount} / {ONBOARDING_STEPS.length} 완료
            </span>
          </div>
          <div className="mini-track">
            <div
              className="mini-fill"
              style={{ width: `${(doneCount / ONBOARDING_STEPS.length) * 100}%`, background: allDone ? "var(--good)" : "var(--brand)" }}
            />
          </div>
          {allDone && <div className="callout go" style={{ marginTop: 12 }}>🎉 모든 준비가 끝났어요! 이제 집에서도 편하게 이용해주세요.</div>}
        </div>

        {ONBOARDING_STEPS.map((s) => {
          const done = data.completedSteps.includes(s.step);
          return (
            <div className="card" key={s.step} style={done ? { borderColor: "var(--good)" } : undefined}>
              <h2 className="mt0">{s.title}</h2>
              <p style={{ color: "var(--muted)" }}>{s.description}</p>

              {s.step === 1 && (
                <>
                  <a
                    className="btn"
                    href={loginUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ width: "100%", textAlign: "center" }}
                  >
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
                  <p className="muted" style={{ fontSize: "0.8rem", marginTop: 10, marginBottom: 0 }}>
                    형제자매가 같은 학원에 다니고 있어 이미 앱을 홈 화면에 추가하셨다면, 다시
                    추가하지 않으셔도 괜찮아요. 이 화면 아래 버튼만 눌러주세요.
                  </p>
                </>
              )}

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
                disabled={done || savingStep === s.step}
                onClick={() => complete(s.step)}
              >
                {done ? "완료됨 ✓" : savingStep === s.step ? "처리 중..." : "완료했어요"}
              </button>
            </div>
          );
        })}

        <p className="muted center" style={{ fontSize: "0.85rem" }}>
          궁금한 점이 있으시면 언제든 학원으로 편하게 연락 주세요. 😊
        </p>
      </div>

      <footer className="foot">{ACADEMY_NAME} · 구구단 레벨업 시스템</footer>
    </>
  );
}
