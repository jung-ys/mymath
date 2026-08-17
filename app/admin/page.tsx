"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, levelBadgeClass, fmtDate, fmtDateOnly } from "@/lib/clientUtils";
import type { studentSummary } from "@/lib/studentView";
import { ACADEMY_NAME } from "@/lib/branding";

type StudentDetailData = Awaited<ReturnType<typeof studentSummary>>;

interface LevelDef {
  level: number;
  title: string;
  range: string;
}
interface StudentRow {
  id: string;
  name: string;
  level: number;
  levelTitle: string;
  isMaster: boolean;
  streak: number;
  todayDone: boolean;
}
interface LevelUpRow {
  id: string;
  studentId: string;
  studentName: string;
  level: number;
  levelTitle: string;
  awardedAt: string;
  rewardGiven: boolean;
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

function ReadinessBlock({ r }: { r: Readiness }) {
  const streakPct = Math.min(100, Math.round((r.streak / r.minStreakDays) * 100));
  const accBase = r.recentCount > 0 ? r.avgAccuracyPct : 0;
  const accPct = Math.min(100, Math.round((accBase / r.minAvgAccuracyPct) * 100));
  const accLabel = r.recentCount < r.minRecentTests ? `기록 ${r.recentCount}/${r.minRecentTests}회` : `${r.avgAccuracyPct}%`;
  return (
    <>
      <div className={`callout ${r.eligible ? "go" : "wait"}`}>{r.eligible ? "승급 시험 자격 충족" : "승급 시험 자격 미충족"}</div>
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
    </>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");

  useEffect(() => {
    api<{ authed: boolean; type?: string }>("/api/me")
      .then((me) => setAuthed(!!me.authed && me.type === "admin"))
      .catch(() => setAuthed(false));
  }, []);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginErr("");
    try {
      await api("/api/admin/login", { method: "POST", body: { password } });
      setAuthed(true);
    } catch (ex) {
      setLoginErr(ex instanceof ApiError ? ex.message : "로그인에 실패했습니다.");
    }
  }

  async function logout() {
    await api("/api/logout", { method: "POST" });
    setAuthed(false);
  }

  if (authed === null) return <div className="loading">불러오는 중...</div>;

  if (!authed) {
    return (
      <>
        <header className="topbar">
          <div className="brand">
            <div className="brand-title">
              <span className="dot">✕</span> 구구단 레벨업 <span className="tag">관리자</span>
            </div>
            <div className="brand-academy">{ACADEMY_NAME}</div>
          </div>
          <nav>
            <Link href="/board">게시판</Link>
            <Link href="/">학생 로그인</Link>
          </nav>
        </header>
        <div className="wrap narrow">
          <div className="card">
            <h2 className="mt0">관리자 로그인</h2>
            <form onSubmit={onLogin}>
              <label htmlFor="login-pw">비밀번호</label>
              <input type="password" id="login-pw" required value={password} onChange={(e) => setPassword(e.target.value)} />
              <button className="btn" type="submit" style={{ width: "100%" }}>
                로그인
              </button>
              {loginErr && <div className="error-box show">{loginErr}</div>}
            </form>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-title">
            <span className="dot">✕</span> 구구단 레벨업 <span className="tag">관리자</span>
          </div>
          <div className="brand-academy">{ACADEMY_NAME}</div>
        </div>
        <nav>
          <Link href="/board">게시판</Link>
          <Link href="/">학생 로그인</Link>
          <button className="link" onClick={logout}>
            로그아웃
          </button>
        </nav>
      </header>
      <div className="wrap">
        <AdminDashboard />
      </div>
      <footer className="foot">구구단 레벨업 · 관리자 페이지</footer>
    </>
  );
}

function AdminDashboard() {
  const [levels, setLevels] = useState<LevelDef[]>([]);
  const [masterLevel, setMasterLevel] = useState(5);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [levelUps, setLevelUps] = useState<LevelUpRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StudentDetailData | null>(null);
  const [detailErr, setDetailErr] = useState("");

  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newLevel, setNewLevel] = useState(1);
  const [addErr, setAddErr] = useState("");

  const load = useCallback(async () => {
    const [studentsData, levelUpsData] = await Promise.all([
      api<{ students: StudentRow[]; levels: LevelDef[]; masterLevel: number }>("/api/admin/students"),
      api<{ levelUps: LevelUpRow[] }>("/api/admin/level-ups"),
    ]);
    setLevels(studentsData.levels);
    setMasterLevel(studentsData.masterLevel);
    setStudents(studentsData.students);
    setLevelUps(levelUpsData.levelUps);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const fetchDetail = useCallback(async (id: string) => {
    setDetail(null);
    setDetailErr("");
    try {
      const summary = await api<StudentDetailData>(`/api/admin/students/${id}`);
      setDetail(summary);
    } catch (ex) {
      setDetailErr(ex instanceof ApiError ? ex.message : "불러오지 못했습니다.");
    }
  }, []);

  // 이름을 다시 누르면 열려있던 패널이 닫히도록 토글한다.
  const toggleDetail = useCallback(
    (id: string) => {
      if (selectedId === id) {
        setSelectedId(null);
        setDetail(null);
        setDetailErr("");
        return;
      }
      setSelectedId(id);
      fetchDetail(id);
    },
    [selectedId, fetchDetail]
  );

  async function onAddStudent(e: React.FormEvent) {
    e.preventDefault();
    setAddErr("");
    try {
      await api("/api/admin/students", { method: "POST", body: { name: newName.trim(), pin: newPin.trim(), startLevel: newLevel } });
      setNewName("");
      setNewPin("");
      setNewLevel(1);
      await load();
    } catch (ex) {
      setAddErr(ex instanceof ApiError ? ex.message : "등록에 실패했습니다.");
    }
  }

  async function onToggleReward(id: string, checked: boolean) {
    try {
      await api(`/api/admin/level-ups/${id}/reward`, { method: "POST", body: { rewardGiven: checked } });
      setLevelUps((prev) => prev.map((u) => (u.id === id ? { ...u, rewardGiven: checked } : u)));
    } catch (ex) {
      alert(ex instanceof ApiError ? ex.message : "실패했습니다.");
    }
  }

  async function onResetPin(id: string) {
    const pin = prompt("새 비밀번호 (숫자 4~6자리)를 입력하세요.");
    if (pin === null) return;
    try {
      await api(`/api/admin/students/${id}/reset-pin`, { method: "POST", body: { pin: pin.trim() } });
      alert("비밀번호가 변경되었습니다.");
    } catch (ex) {
      alert(ex instanceof ApiError ? ex.message : "실패했습니다.");
    }
  }

  async function onDeleteStudent(id: string, name: string) {
    if (!confirm(`정말 '${name}' 학생을 삭제할까요? 모든 기록이 함께 삭제됩니다.`)) return;
    try {
      await api(`/api/admin/students/${id}`, { method: "DELETE" });
      if (selectedId === id) {
        setSelectedId(null);
        setDetail(null);
      }
      await load();
    } catch (ex) {
      alert(ex instanceof ApiError ? ex.message : "실패했습니다.");
    }
  }

  async function onApplyLevel(id: string, level: number) {
    try {
      await api(`/api/admin/students/${id}/adjust-level`, { method: "POST", body: { level } });
      await load();
      await fetchDetail(id);
    } catch (ex) {
      alert(ex instanceof ApiError ? ex.message : "실패했습니다.");
    }
  }

  function levelOptions() {
    return (
      <>
        {levels.map((l) => (
          <option key={l.level} value={l.level}>
            {l.title} ({l.range})
          </option>
        ))}
        <option value={masterLevel}>마스터 (전체 완료)</option>
      </>
    );
  }

  return (
    <>
      <div className="card">
        <h2 className="mt0">학생 추가</h2>
        <form onSubmit={onAddStudent}>
          <div className="grid-2">
            <div>
              <label htmlFor="new-name">이름</label>
              <input type="text" id="new-name" required value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="new-pin">비밀번호 (숫자 4~6자리)</label>
              <input type="text" id="new-pin" inputMode="numeric" required value={newPin} onChange={(e) => setNewPin(e.target.value)} />
            </div>
          </div>
          <label htmlFor="new-level">시작 단계</label>
          <select id="new-level" value={newLevel} onChange={(e) => setNewLevel(Number(e.target.value))}>
            {levelOptions()}
          </select>
          <button className="btn" type="submit">
            학생 등록
          </button>
          {addErr && <div className="error-box show">{addErr}</div>}
        </form>
      </div>

      <div className="card">
        <h2 className="mt0">🎁 레벨업 보상 체크리스트</h2>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          승급 시험을 통과한 학생에게 셀레나 달러와 간식 쿠폰을 지급하면 체크해주세요.
        </p>
        <div className="board-list">
          {levelUps.length ? (
            levelUps.slice(0, 15).map((u) => (
              <div className="board-row" key={u.id}>
                <div>
                  <span className="name">{u.studentName}</span>
                  <span className="muted">
                    {" "}
                    · {u.levelTitle} 통과 · {fmtDate(u.awardedAt)}
                  </span>
                </div>
                <label className="reward-check">
                  <input type="checkbox" checked={u.rewardGiven} onChange={(e) => onToggleReward(u.id, e.target.checked)} />
                  셀레나 달러/간식 지급 완료
                </label>
              </div>
            ))
          ) : (
            <p className="muted">최근 레벨업 기록이 없어요.</p>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="mt0">학생 목록 ({students.length}명)</h2>
        {students.length ? (
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th>단계</th>
                <th>연속출석</th>
                <th>오늘</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>
                    <button
                      className="link"
                      style={{ color: "var(--brand)", fontWeight: 700, textDecoration: "underline" }}
                      onClick={() => toggleDetail(s.id)}
                    >
                      {s.name}
                    </button>
                  </td>
                  <td>
                    <span className={`badge ${levelBadgeClass(s.level, masterLevel)}`}>{s.levelTitle}</span>
                  </td>
                  <td>{s.streak}일</td>
                  <td>{s.todayDone ? "✅" : "—"}</td>
                  <td>
                    <button className="btn small ghost" onClick={() => onResetPin(s.id)}>
                      PIN 재설정
                    </button>{" "}
                    <button className="btn small ghost" onClick={() => onDeleteStudent(s.id, s.name)}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">등록된 학생이 없어요.</p>
        )}
      </div>

      {selectedId && (
        <div className="card">
          {detailErr && <p className="error-box show">{detailErr}</p>}
          {!detail && !detailErr && <p className="muted">불러오는 중...</p>}
          {detail && (
            <StudentDetail
              detail={detail}
              masterLevel={masterLevel}
              levelOptions={levelOptions}
              onApplyLevel={(level) => onApplyLevel(selectedId, level)}
              onConfigSaved={async () => {
                await load();
                await fetchDetail(selectedId);
              }}
            />
          )}
        </div>
      )}
    </>
  );
}

function StudentDetail({
  detail,
  masterLevel,
  levelOptions,
  onApplyLevel,
  onConfigSaved,
}: {
  detail: StudentDetailData;
  masterLevel: number;
  levelOptions: () => React.ReactNode;
  onApplyLevel: (level: number) => void;
  onConfigSaved: () => Promise<void>;
}) {
  const { student, history, levelExam, customConfig, wrongCount } = detail;
  const [levelSel, setLevelSel] = useState(student.level);

  return (
    <>
      <div className="flex-between">
        <h2 className="mt0">
          {student.name} 님 상세 기록 <span className={`badge ${levelBadgeClass(student.level, masterLevel)}`}>{student.levelTitle}</span>
        </h2>
        <div>
          <a className="btn small secondary" href={`/report?id=${student.id}`} target="_blank" rel="noopener noreferrer">
            학부모 리포트 보기
          </a>{" "}
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: 0 }}>
            단계 직접 조정:
            <select value={levelSel} onChange={(e) => setLevelSel(Number(e.target.value))}>
              {levelOptions()}
            </select>
          </label>{" "}
          <button className="btn small" onClick={() => onApplyLevel(levelSel)}>
            적용
          </button>
        </div>
      </div>

      <p className="muted" style={{ fontSize: "0.85rem" }}>
        현재 오답 노트: <strong style={{ color: wrongCount > 0 ? "var(--bad)" : "var(--good)" }}>{wrongCount}개</strong>
        {wrongCount > 0 ? " 남음 (학생 화면에서 '오답 다시 풀기'로 연습 가능)" : " — 깨끗해요!"}
      </p>

      {!student.isMaster && levelExam?.readiness && <ReadinessBlock r={levelExam.readiness} />}

      <CustomConfigEditor studentId={student.id} customConfig={customConfig} onSaved={onConfigSaved} />

      <div className="grid-2">
        <div>
          <h3>오늘의 테스트 이력</h3>
          {history.daily.length ? (
            <table>
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>점수</th>
                  <th>응시시각</th>
                </tr>
              </thead>
              <tbody>
                {history.daily.map((d: StudentDetailData["history"]["daily"][number]) => (
                  <tr key={d.id}>
                    <td>{fmtDateOnly(d.date)}</td>
                    <td>
                      {d.score}/{d.total}
                    </td>
                    <td>{fmtDate(d.takenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">기록 없음</p>
          )}
        </div>
        <div>
          <h3>승급 시험 이력</h3>
          {history.levelExams.length ? (
            <table>
              <thead>
                <tr>
                  <th>단계</th>
                  <th>점수</th>
                  <th>결과</th>
                  <th>응시시각</th>
                </tr>
              </thead>
              <tbody>
                {history.levelExams.map((e: StudentDetailData["history"]["levelExams"][number]) => (
                  <tr key={e.id}>
                    <td>{e.level}단계</td>
                    <td>
                      {e.score}/{e.total}
                    </td>
                    <td>
                      <span className={`pill ${e.passed ? "pass" : "fail"}`}>{e.passed ? "통과" : "미통과"}</span>
                    </td>
                    <td>{fmtDate(e.takenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">기록 없음</p>
          )}
        </div>
      </div>
    </>
  );
}

const ALL_TABLES = Array.from({ length: 18 }, (_, i) => i + 2); // 2~19

function CustomConfigEditor({
  studentId,
  customConfig,
  onSaved,
}: {
  studentId: string;
  customConfig: StudentDetailData["customConfig"];
  onSaved: () => Promise<void>;
}) {
  const [tables, setTables] = useState<Set<number>>(new Set(customConfig.tables));
  const [questionCount, setQuestionCount] = useState(customConfig.questionCount ? String(customConfig.questionCount) : "");
  const [allowDuplicates, setAllowDuplicates] = useState(customConfig.allowDuplicates);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const isCustom = customConfig.tables.length > 0;

  function toggleTable(t: number) {
    setTables((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  async function save(tablesToSave: number[]) {
    setSaving(true);
    setErr("");
    try {
      await api(`/api/admin/students/${studentId}/custom-config`, {
        method: "POST",
        body: {
          tables: tablesToSave,
          questionCount: tablesToSave.length && questionCount.trim() ? Number(questionCount) : null,
          allowDuplicates,
        },
      });
      await onSaved();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ background: "#f8f6ff" }}>
      <h3 className="mt0">🎯 출제 범위 직접 설정 (오늘의 테스트)</h3>
      <p className="muted" style={{ fontSize: "0.82rem" }}>
        {isCustom
          ? "현재 이 학생은 아래 커스텀 설정으로 오늘의 테스트가 출제되고 있어요."
          : "아직 커스텀 설정이 없어요. 단계(레벨) 기준 자동 범위로 출제 중이에요. 이제 막 시작한 학생이라면 원하는 단만 체크해서 범위를 좁혀줄 수 있어요."}
      </p>

      <label style={{ marginBottom: 6 }}>출제할 단 선택</label>
      <div className="tag-row">
        {ALL_TABLES.map((t) => (
          <label
            key={t}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: tables.has(t) ? "var(--brand)" : "#fff",
              color: tables.has(t) ? "#fff" : "var(--ink)",
              border: "1.5px solid var(--line)",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "0.85rem",
            }}
          >
            <input type="checkbox" checked={tables.has(t)} onChange={() => toggleTable(t)} style={{ display: "none" }} />
            {t}단
          </label>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: 14 }}>
        <div>
          <label htmlFor="custom-count">문항 수 (비워두면 자동 계산)</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            id="custom-count"
            placeholder="자동"
            value={questionCount}
            onChange={(e) => {
              // 숫자만 남기고, 최대 3자리(최대 200)까지만 허용 — 키가 눌린 채로 있어도
              // 입력이 끝없이 길어지지 않도록 방어한다.
              const digitsOnly = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
              setQuestionCount(digitsOnly);
            }}
            onBlur={() => {
              const n = Number(questionCount);
              if (questionCount && (!Number.isFinite(n) || n < 1)) setQuestionCount("1");
              else if (n > 200) setQuestionCount("200");
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 12 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: 0 }}>
            <input type="checkbox" checked={allowDuplicates} onChange={(e) => setAllowDuplicates(e.target.checked)} />
            문제 중복 가능 (선택한 단 조합보다 문항 수가 많을 때 반복 출제)
          </label>
        </div>
      </div>

      {err && <div className="error-box show">{err}</div>}

      <button className="btn small" disabled={saving} onClick={() => save(Array.from(tables))}>
        {saving ? "저장 중..." : "이 설정으로 저장"}
      </button>{" "}
      {isCustom && (
        <button
          className="btn small ghost"
          disabled={saving}
          onClick={() => {
            setTables(new Set());
            setQuestionCount("");
            save([]);
          }}
        >
          기본값(레벨 기준 자동)으로 되돌리기
        </button>
      )}
    </div>
  );
}
