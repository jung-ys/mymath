"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/clientUtils";
import { ACADEMY_NAME } from "@/lib/branding";

interface LevelDef {
  level: number;
  title: string;
  range: string;
}
interface StudentRow {
  id: string;
  name: string;
  level: number;
  streak: number;
}
interface LevelUpRow {
  studentName: string;
  level: number;
  levelTitle: string;
  rewardGiven: boolean;
}
interface BoardData {
  levels: LevelDef[];
  students: StudentRow[];
  recentLevelUps: LevelUpRow[];
  todayDailyCount: number;
  masterLevel: number;
}

export default function BoardPage() {
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stopped = false;
    async function load() {
      try {
        const d = await api<BoardData>("/api/board");
        if (!stopped) setData(d);
      } catch {
        if (!stopped) setError("불러오지 못했습니다.");
      }
    }
    load();
    const id = setInterval(load, 10000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, []);

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-title">
            <span className="dot">✕</span> 구구단 레벨업 게시판
          </div>
          <div className="brand-academy">{ACADEMY_NAME}</div>
        </div>
        <nav>
          <Link href="/">학생 로그인</Link>
        </nav>
      </header>

      <div className="wrap">
        <div className="hero">
          <p className="academy-name">{ACADEMY_NAME}</p>
          <h1>🏆 우리반 구구단 레벨업 현황</h1>
          {data && <p className="muted">오늘 {data.todayDailyCount}명이 오늘의 테스트를 완료했어요!</p>}
        </div>

        {error && <p className="error-box show">{error}</p>}
        {!data && !error && <div className="loading">불러오는 중...</div>}

        {data && (
          <>
            <div className="card">
              <div className="columns">
                {data.levels.map((l, i) => {
                  // 마지막 단계(4단계) 칸에는 그 단계를 도전 중인 학생과 이미 마스터한
                  // 학생을 함께 보여준다 (마스터를 별도 칸으로 분리하지 않고 합침).
                  const isLastLevel = i === data.levels.length - 1;
                  const members = data.students.filter(
                    (s) => s.level === l.level || (isLastLevel && s.level >= data.masterLevel)
                  );
                  return (
                    <div className="lvl-col" key={l.level}>
                      <h3>
                        <span className={`badge lv${l.level}`}>{l.title}</span>
                      </h3>
                      <p className="center muted" style={{ fontSize: "0.8rem" }}>
                        {isLastLevel ? `${l.range} (마스터 포함)` : l.range}
                      </p>
                      <div className="members">
                        {members.length ? (
                          members.map((s) => {
                            const isMaster = s.level >= data.masterLevel;
                            return (
                              <div className="member-chip" key={s.id}>
                                {isMaster ? "👑 " : ""}
                                {s.name}
                                <br />
                                <span className="muted" style={{ fontWeight: 600, fontSize: "0.75rem" }}>
                                  {isMaster ? "마스터" : `🔥${s.streak}일`}
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <p className="center muted" style={{ fontSize: "0.8rem" }}>
                            -
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <h2 className="mt0">🎉 최근 레벨업 소식</h2>
              <div className="board-list">
                {data.recentLevelUps.length ? (
                  data.recentLevelUps.slice(0, 10).map((u, i) => (
                    <div className="board-row" key={i}>
                      <div>
                        <span className="name">{u.studentName}</span> <span className="muted">· {u.levelTitle} 통과!</span>
                      </div>
                      <div>{u.rewardGiven ? "🎁 보상 지급 완료" : "⏳ 보상 대기중"}</div>
                    </div>
                  ))
                ) : (
                  <p className="muted">아직 레벨업 기록이 없어요.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <footer className="foot">10초마다 자동 새로고침 됩니다.</footer>
    </>
  );
}
