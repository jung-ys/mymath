"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/clientUtils";

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api<{ authed: boolean; type?: string }>("/api/me")
      .then((me) => {
        if (me.authed && me.type === "student") router.replace("/student");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

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
          <span className="dot">✕</span> 구구단 레벨업
        </div>
        <nav>
          <Link href="/board">레벨업 게시판</Link>
          <Link href="/admin">선생님 로그인</Link>
        </nav>
      </header>

      <div className="wrap narrow">
        <div className="hero">
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
