"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/clientUtils";
import { ACADEMY_NAME } from "@/lib/branding";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="loading">불러오는 중...</div>}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 학부모 온보딩 링크(?login=1)로 들어온 경우: 같은 기기에 다른 학생의 로그인이
  // 남아있어도 그대로 넘어가지 말고 항상 로그인 화면부터 보여준다. (예: 선생님이 테스트
  // 계정으로 로그인해둔 채 부모에게 링크를 전달하면, 자동으로 그 계정으로 들어가버리는 문제 방지)
  const forceLogin = searchParams.get("login") === "1";
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(!forceLogin);

  useEffect(() => {
    if (forceLogin) return;
    api<{ authed: boolean; type?: string }>("/api/me")
      .then((me) => {
        if (me.authed && me.type === "student") router.replace("/student");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router, forceLogin]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/login", { method: "POST", body: { name: name.trim(), pin: pin.trim() } });
      router.push("/student");
    } catch (ex) {
      setError(ex instanceof ApiError ? ex.message : "로그인에 실패했습니다.");
    }
  }

  if (checking) return <div className="loading">불러오는 중...</div>;

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
          <Link href="/admin">선생님 로그인</Link>
        </nav>
      </header>

      <div className="wrap narrow">
        <div className="hero">
          <p className="academy-name">{ACADEMY_NAME}</p>
          <h1>구구단 레벨업 시험</h1>
          <p>
            2단부터 19단까지, 4단계로 나누어 승급 시험을 봐요.
            <br />
            이름과 비밀번호로 로그인하고 오늘의 테스트를 시작하세요!
          </p>
        </div>

        <div className="card">
          <h2 className="mt0">학생 로그인</h2>
          <form onSubmit={onSubmit}>
            <label htmlFor="name">이름</label>
            <input
              type="text"
              id="name"
              placeholder="예: 홍길동"
              autoComplete="username"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <label htmlFor="pin">비밀번호 (숫자 4~6자리)</label>
            <input
              type="password"
              id="pin"
              inputMode="numeric"
              placeholder="선생님이 알려준 번호"
              autoComplete="current-password"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
            <button type="submit" className="btn" style={{ width: "100%" }}>
              로그인
            </button>
            {error && <div className="error-box show">{error}</div>}
          </form>
        </div>

        <div className="card center muted" style={{ fontSize: "0.85rem" }}>
          계정이 없나요? 선생님께 등록을 요청하세요.
        </div>
      </div>

      <footer className="foot">구구단 레벨업 · 매일 조금씩, 꾸준히!</footer>
    </>
  );
}
