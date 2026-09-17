"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { api, ApiError, levelBadgeClass, fmtDate, fmtDateOnly, fmtDuration } from "@/lib/clientUtils";
import type { studentSummary } from "@/lib/studentView";
import { ACADEMY_NAME } from "@/lib/branding";
import { ONBOARDING_STEPS, buildOnboardingPath } from "@/lib/onboarding";

type StudentDetailData = Awaited<ReturnType<typeof studentSummary>>;

// 주변 학교 프리셋 — 매번 타이핑하지 않도록 선택지로 제공하고, 목록에 없으면 "직접 입력"으로 처리.
const SCHOOL_OPTIONS = ["삼양초", "도련초", "동중", "오름중"];
const GRADE_OPTIONS = ["1학년", "2학년", "3학년", "4학년", "5학년", "6학년", "중1", "중2", "중3"];
const CUSTOM_OPTION = "__custom__";

// 프리셋 목록에서 고르거나, 목록에 없으면 "직접 입력"을 선택해 텍스트로 입력할 수 있는 select.
// 학교/학년 둘 다 같은 방식으로 쓴다.
function PresetSelect({
  id,
  presets,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  presets: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const isCustom = value !== "" && !presets.includes(value);
  const selectValue = value === "" ? "" : isCustom ? CUSTOM_OPTION : value;

  return (
    <>
      <select
        id={id}
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === CUSTOM_OPTION ? "" : v);
        }}
      >
        <option value="">선택 안 함</option>
        {presets.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
        <option value={CUSTOM_OPTION}>직접 입력...</option>
      </select>
      {selectValue === CUSTOM_OPTION && (
        <input
          type="text"
          style={{ marginTop: 8 }}
          placeholder={placeholder}
          value={isCustom ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </>
  );
}

interface LevelDef {
  level: number;
  title: string;
  range: string;
}
interface StudentRow {
  id: string;
  name: string;
  school: string | null;
  grade: string | null;
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
  rewardLabel: string;
  awardedAt: string;
  rewardGiven: boolean;
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

function ReadinessBlock({ r }: { r: Readiness }) {
  const streakPct = Math.min(100, Math.round((r.qualifyingStreak / r.requiredStreak) * 100));
  const coveragePct = r.requiredCoverageCount > 0 ? Math.min(100, Math.round((r.coveredCount / r.requiredCoverageCount) * 100)) : 0;
  return (
    <>
      <div className={`callout ${r.eligible ? "go" : "wait"}`}>{r.eligible ? "승급 시험 자격 충족" : "승급 시험 자격 미충족"}</div>
      <div className="readiness">
        <div className="readiness-row">
          <div className="row-label">
            <span>전체 범위 연습 완료 (단마다 나눠서 풀어도 누적으로 계산돼요)</span>
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
          <Link href="/admin/try-exam">🧪 승급시험 체험</Link>
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
  const [newSchool, setNewSchool] = useState("");
  const [newGrade, setNewGrade] = useState("");
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
      await api("/api/admin/students", {
        method: "POST",
        body: {
          name: newName.trim(),
          school: newSchool.trim(),
          grade: newGrade.trim(),
          pin: newPin.trim(),
          startLevel: newLevel,
        },
      });
      setNewName("");
      setNewSchool("");
      setNewGrade("");
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
    let currentPinNote = "기존 비밀번호를 확인하는 중...";
    try {
      const { pin: currentPin } = await api<{ pin: string | null }>(`/api/admin/students/${id}/pin`);
      currentPinNote = currentPin
        ? `현재 등록된 비밀번호는 "${currentPin}" 입니다.`
        : "이 학생은 이 기능이 생기기 전에 등록되어 기존 비밀번호를 확인할 수 없어요. 아래에서 새로 설정하면 그다음부터는 확인할 수 있어요.";
    } catch (ex) {
      alert(ex instanceof ApiError ? ex.message : "기존 비밀번호를 불러오지 못했습니다.");
      return;
    }
    const pin = prompt(`${currentPinNote}\n\n새 비밀번호(숫자 4~6자리)를 입력하세요. 그대로 두려면 취소를 누르세요.`);
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

  async function onResetProgress(id: string, name: string) {
    if (
      !confirm(
        `'${name}' 학생의 진행 상황을 초기화할까요?\n\n1단계로 되돌아가고, 연속기록·오늘의테스트·승급시험·오답·레벨업 기록이 모두 삭제됩니다.\n(이름과 비밀번호는 그대로 유지돼요.) 되돌릴 수 없어요.`
      )
    )
      return;
    try {
      await api(`/api/admin/students/${id}/reset-progress`, { method: "POST" });
      await load();
      if (selectedId === id) await fetchDetail(id);
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
          <div className="grid-2">
            <div>
              <label htmlFor="new-school">학교 (선택)</label>
              <PresetSelect id="new-school" presets={SCHOOL_OPTIONS} value={newSchool} onChange={setNewSchool} placeholder="학교 이름 입력" />
            </div>
            <div>
              <label htmlFor="new-grade">학년 (선택)</label>
              <PresetSelect id="new-grade" presets={GRADE_OPTIONS} value={newGrade} onChange={setNewGrade} placeholder="학년 입력" />
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

      <LevelTimeSettingsCard />

      <OnboardingStatusCard />

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
                  {u.rewardLabel && (
                    <div className="muted" style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--brand)" }}>
                      🎁 {u.rewardLabel}
                    </div>
                  )}
                </div>
                <label className="reward-check">
                  <input type="checkbox" checked={u.rewardGiven} onChange={(e) => onToggleReward(u.id, e.target.checked)} />
                  지급 완료
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
                <th>번호</th>
                <th>이름</th>
                <th>단계</th>
                <th>연속출석</th>
                <th>오늘</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <Fragment key={s.id}>
                  <tr>
                    <td className="muted">{i + 1}</td>
                    <td>
                      <button
                        className="link"
                        style={{ color: "var(--brand)", fontWeight: 700, textDecoration: "underline" }}
                        onClick={() => toggleDetail(s.id)}
                      >
                        {s.name}
                      </button>
                      {(s.school || s.grade) && (
                        <div className="muted" style={{ fontSize: "0.75rem" }}>
                          {[s.school, s.grade].filter(Boolean).join(" · ")}
                        </div>
                      )}
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
                      <button className="btn small ghost" onClick={() => onResetProgress(s.id, s.name)}>
                        진행 초기화
                      </button>{" "}
                      <button className="btn small ghost" onClick={() => onDeleteStudent(s.id, s.name)}>
                        삭제
                      </button>
                    </td>
                  </tr>
                  {/* 이름을 누르면 그 학생 바로 아래에 상세 내용이 펼쳐진다 (목록 끝까지 안 내려가도 됨) */}
                  {selectedId === s.id && (
                    <tr>
                      <td colSpan={6} style={{ background: "var(--brand-light)", padding: 16 }}>
                        {detailErr && <p className="error-box show">{detailErr}</p>}
                        {!detail && !detailErr && <p className="muted">불러오는 중...</p>}
                        {detail && (
                          <div className="card" style={{ margin: 0 }}>
                            <StudentDetail
                              detail={detail}
                              masterLevel={masterLevel}
                              levelOptions={levelOptions}
                              onApplyLevel={(level) => onApplyLevel(s.id, level)}
                              onConfigSaved={async () => {
                                await load();
                                await fetchDetail(s.id);
                              }}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">등록된 학생이 없어요.</p>
        )}
      </div>
    </>
  );
}

interface LevelTimeSetting {
  level: number;
  title: string;
  defaultTimeLimitSec: number;
  overrideTimeLimitSec: number | null;
}

function LevelTimeSettingsCard() {
  const [rows, setRows] = useState<LevelTimeSetting[] | null>(null);
  const [minutes, setMinutes] = useState<Record<number, string>>({});
  const [savingLevel, setSavingLevel] = useState<number | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api<{ levels: LevelTimeSetting[] }>("/api/admin/level-settings");
      setRows(data.levels);
      const next: Record<number, string> = {};
      data.levels.forEach((l) => {
        next[l.level] = l.overrideTimeLimitSec ? String(Math.round(l.overrideTimeLimitSec / 60)) : "";
      });
      setMinutes(next);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function save(level: number) {
    setSavingLevel(level);
    setErr("");
    try {
      const raw = minutes[level]?.trim();
      const timeLimitSec = raw ? Number(raw) * 60 : 0;
      await api("/api/admin/level-settings", { method: "POST", body: { level, timeLimitSec } });
      await load();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "저장에 실패했습니다.");
    } finally {
      setSavingLevel(null);
    }
  }

  if (!rows) return null;

  return (
    <div className="card">
      <h2 className="mt0">⏱ 단계별 승급 시험 제한시간</h2>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        비워두면 문항 수 기준 자동 계산값을 씁니다. 분 단위로 입력하면 그 단계를 보는{" "}
        <strong>모든 학생</strong>에게 적용돼요. 특정 학생만 다르게 주려면 그 학생 상세 화면에서 따로
        설정하세요(그게 우선 적용됩니다).
      </p>
      <table>
        <thead>
          <tr>
            <th>단계</th>
            <th>현재 적용 중</th>
            <th>자동 계산 기본값</th>
            <th>전체 적용(분)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.level}>
              <td>{r.title}</td>
              <td>
                <strong style={{ color: r.overrideTimeLimitSec ? "var(--brand)" : "var(--ink)" }}>
                  {Math.round((r.overrideTimeLimitSec ?? r.defaultTimeLimitSec) / 60)}분
                </strong>{" "}
                <span className="muted" style={{ fontSize: "0.78rem" }}>
                  {r.overrideTimeLimitSec ? "(전체 적용)" : "(자동)"}
                </span>
              </td>
              <td className="muted">{Math.round(r.defaultTimeLimitSec / 60)}분</td>
              <td>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  style={{ width: 80 }}
                  placeholder="자동"
                  value={minutes[r.level] ?? ""}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
                    setMinutes((prev) => ({ ...prev, [r.level]: digitsOnly }));
                  }}
                />
              </td>
              <td>
                <button className="btn small" disabled={savingLevel === r.level} onClick={() => save(r.level)}>
                  {savingLevel === r.level ? "저장 중..." : "저장"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {err && <div className="error-box show">{err}</div>}
    </div>
  );
}

interface OnboardingStudentRow {
  id: string;
  name: string;
  school: string | null;
  grade: string | null;
  completedSteps: number[];
}

function OnboardingStatusCard() {
  const [rows, setRows] = useState<OnboardingStudentRow[] | null>(null);
  const [err, setErr] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupCopied, setGroupCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ students: OnboardingStudentRow[] }>("/api/admin/onboarding");
      setRows(data.students);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function copyUrl(ids: string[]) {
    const url = `${window.location.origin}${buildOnboardingPath(ids)}`;
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      prompt("아래 주소를 복사해서 카카오톡으로 보내주세요:", url);
      return false;
    }
  }

  async function copyLink(id: string) {
    const ok = await copyUrl([id]);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyGroupLink() {
    const ok = await copyUrl(Array.from(selected));
    if (ok) {
      setGroupCopied(true);
      setTimeout(() => setGroupCopied(false), 2000);
    }
  }

  async function resetOnboarding(id: string, name: string) {
    if (!confirm(`${name} 학생의 온보딩 체크(홈 화면 추가/로그인/테스트)를 모두 초기화할까요?`)) return;
    try {
      await api(`/api/admin/students/${id}/reset-onboarding`, { method: "POST" });
      await load();
    } catch (ex) {
      alert(ex instanceof ApiError ? ex.message : "초기화하지 못했습니다.");
    }
  }

  if (!rows) return null;

  return (
    <div className="card">
      <h2 className="mt0">📱 학부모 시작 안내 (온보딩) 현황</h2>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        학생마다 &ldquo;링크 복사&rdquo;를 눌러 그 학부모님께 카카오톡으로 보내주세요. 부모님이
        홈 화면 추가 → 로그인 → 오늘의 테스트까지 {ONBOARDING_STEPS.length}단계를 진행하면
        아래 표에 바로 반영됩니다(②·③단계는 자동 체크, ①단계(홈 화면 추가)만 부모님이 직접 체크).
        형제자매가 있으면 왼쪽 체크박스로 두 명 이상 선택해서 <b>통합 링크</b> 하나로 보낼 수도
        있어요 — 홈 화면 추가는 한 번만, 로그인·테스트는 아이마다 각자 하게 안내돼요.
      </p>
      {selected.size >= 2 && (
        <div className="callout" style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span>{selected.size}명 선택됨</span>
          <button className="btn small" onClick={copyGroupLink}>
            {groupCopied ? "복사됨!" : "🔗 통합 링크 복사"}
          </button>
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>이름</th>
              {ONBOARDING_STEPS.map((s) => (
                <th key={s.step} style={{ textAlign: "center" }}>
                  {s.step}
                </th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
                </td>
                <td>
                  {r.name}
                  {(r.school || r.grade) && (
                    <div className="muted" style={{ fontSize: "0.75rem" }}>
                      {[r.school, r.grade].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </td>
                {ONBOARDING_STEPS.map((s) => (
                  <td key={s.step} style={{ textAlign: "center" }}>
                    {r.completedSteps.includes(s.step) ? "✅" : "—"}
                  </td>
                ))}
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn small ghost" onClick={() => copyLink(r.id)}>
                    {copiedId === r.id ? "복사됨!" : "🔗 링크 복사"}
                  </button>
                  {r.completedSteps.length > 0 && (
                    <button
                      className="btn small ghost"
                      style={{ marginLeft: 6 }}
                      onClick={() => resetOnboarding(r.id, r.name)}
                    >
                      🔄 초기화
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {err && <div className="error-box show">{err}</div>}
    </div>
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

      <SchoolGradeEditor studentId={student.id} school={student.school} grade={student.grade} onSaved={onConfigSaved} />

      {!student.isMaster && levelExam?.readiness && <ReadinessBlock r={levelExam.readiness} />}

      <CustomConfigEditor studentId={student.id} customConfig={customConfig} onSaved={onConfigSaved} />

      {!student.isMaster && "config" in levelExam && levelExam.config && (
        <ExamTimeEditor
          studentId={student.id}
          overrideSec={customConfig.examTimeOverrideSec}
          effectiveSec={levelExam.config.timeLimitSec}
          onSaved={onConfigSaved}
        />
      )}

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
                  <th>소요시간</th>
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
                    <td>{fmtDuration(d.elapsedSec)}</td>
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
          <p className="muted" style={{ fontSize: "0.78rem", marginTop: -6 }}>
            &ldquo;통과&rdquo;는 그 응시에서 100점을 받았다는 뜻이에요. 1~4단계는 통과하면 바로
            승급되고, <strong>마스터 단계만</strong> 같은 단계에서 <strong>바로 다음 응시도 연속으로
            통과</strong>해야 최종 마스터가 확정됩니다.
          </p>
          {history.levelExams.length ? (
            <table>
              <thead>
                <tr>
                  <th>단계</th>
                  <th>점수</th>
                  <th>결과</th>
                  <th>응시시각</th>
                  <th>소요시간</th>
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
                    <td>{fmtDuration(e.elapsedSec)}</td>
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

function SchoolGradeEditor({
  studentId,
  school,
  grade,
  onSaved,
}: {
  studentId: string;
  school: string | null;
  grade: string | null;
  onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [schoolVal, setSchoolVal] = useState(school || "");
  const [gradeVal, setGradeVal] = useState(grade || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setSaving(true);
    setErr("");
    try {
      await api(`/api/admin/students/${studentId}/info`, {
        method: "POST",
        body: { school: schoolVal.trim(), grade: gradeVal.trim() },
      });
      await onSaved();
      setEditing(false);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        {school || grade ? [school, grade].filter(Boolean).join(" · ") : "학교/학년 정보 없음"}{" "}
        <button
          className="link"
          onClick={() => {
            setSchoolVal(school || "");
            setGradeVal(grade || "");
            setErr("");
            setEditing(true);
          }}
        >
          수정
        </button>
      </p>
    );
  }

  return (
    <div className="grid-2" style={{ marginBottom: 10 }}>
      <div>
        <label htmlFor="edit-school">학교</label>
        <PresetSelect id="edit-school" presets={SCHOOL_OPTIONS} value={schoolVal} onChange={setSchoolVal} placeholder="학교 이름 입력" />
      </div>
      <div>
        <label htmlFor="edit-grade">학년</label>
        <PresetSelect id="edit-grade" presets={GRADE_OPTIONS} value={gradeVal} onChange={setGradeVal} placeholder="학년 입력" />
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <button className="btn small" disabled={saving} onClick={save}>
          {saving ? "저장 중..." : "저장"}
        </button>{" "}
        <button className="btn small ghost" disabled={saving} onClick={() => setEditing(false)}>
          취소
        </button>
        {err && <div className="error-box show">{err}</div>}
      </div>
    </div>
  );
}

function ExamTimeEditor({
  studentId,
  overrideSec,
  effectiveSec,
  onSaved,
}: {
  studentId: string;
  overrideSec: number | null;
  effectiveSec: number;
  onSaved: () => Promise<void>;
}) {
  const [minutes, setMinutes] = useState(overrideSec ? String(Math.round(overrideSec / 60)) : "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save(clear = false) {
    setSaving(true);
    setErr("");
    try {
      const timeLimitSec = clear ? 0 : minutes.trim() ? Number(minutes.trim()) * 60 : 0;
      await api(`/api/admin/students/${studentId}/exam-time`, { method: "POST", body: { timeLimitSec } });
      if (clear) setMinutes("");
      await onSaved();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ background: "#f8f6ff" }}>
      <h3 className="mt0">⏱ 이 학생만 승급 시험 시간 다르게 주기</h3>
      <p className="muted" style={{ fontSize: "0.82rem" }}>
        현재 적용 중인 제한시간: <strong>{Math.round(effectiveSec / 60)}분</strong>{" "}
        {overrideSec ? "(이 학생 개별 설정)" : "(단계별 기본/전체 설정 따름)"}
      </p>
      <div className="grid-2">
        <div>
          <label htmlFor="exam-time-minutes">개별 제한시간 (분, 비워두면 해제)</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            id="exam-time-minutes"
            placeholder="예: 15"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
          />
        </div>
      </div>
      <button className="btn small" disabled={saving} onClick={() => save(false)}>
        {saving ? "저장 중..." : "저장"}
      </button>{" "}
      {overrideSec && (
        <button className="btn small ghost" disabled={saving} onClick={() => save(true)}>
          개별 설정 해제
        </button>
      )}
      {err && <div className="error-box show">{err}</div>}
    </div>
  );
}

const ALL_TABLES = Array.from({ length: 18 }, (_, i) => i + 2); // 2~19

// 커스텀 설정에서 선택한 단(段)에 적용할 배수 범위. 단마다 따로 지정하지 않고, 선택한
// 단 전체에 공통으로 적용되는 3가지 프리셋만 제공해 화면을 단순하게 유지한다.
const MULT_RANGE_OPTIONS: { value: string; label: string; range: [number, number] }[] = [
  { value: "1-10", label: "×1~10배", range: [1, 10] },
  { value: "11-20", label: "×11~20배", range: [11, 20] },
  { value: "1-20", label: "전체(×1~20배)", range: [1, 20] },
];

function multRangeKeyFor(min: number, max: number): string {
  const found = MULT_RANGE_OPTIONS.find((o) => o.range[0] === min && o.range[1] === max);
  return found ? found.value : "1-20";
}

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
  const [multRange, setMultRange] = useState(multRangeKeyFor(customConfig.multMin, customConfig.multMax));
  const [allowDuplicates, setAllowDuplicates] = useState(customConfig.allowDuplicates);
  const [problemOrder, setProblemOrder] = useState(customConfig.problemOrder || "random");
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

  async function save(tablesToSave: number[], overrides?: { order?: string; multRange?: string }) {
    setSaving(true);
    setErr("");
    const [multMin, multMax] = MULT_RANGE_OPTIONS.find((o) => o.value === (overrides?.multRange ?? multRange))!.range;
    try {
      await api(`/api/admin/students/${studentId}/custom-config`, {
        method: "POST",
        body: {
          tables: tablesToSave,
          questionCount: tablesToSave.length && questionCount.trim() ? Number(questionCount) : null,
          multMin,
          multMax,
          allowDuplicates,
          problemOrder: overrides?.order ?? problemOrder,
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

      <label style={{ marginTop: 14 }}>배수 범위 (선택한 단 전체에 공통 적용)</label>
      <div className="tag-row">
        {MULT_RANGE_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: multRange === opt.value ? "var(--brand)" : "#fff",
              color: multRange === opt.value ? "#fff" : "var(--ink)",
              border: "1.5px solid var(--line)",
              borderRadius: 8,
              padding: "6px 12px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "0.85rem",
            }}
          >
            <input
              type="radio"
              name="mult-range"
              value={opt.value}
              checked={multRange === opt.value}
              onChange={() => setMultRange(opt.value)}
              style={{ display: "none" }}
            />
            {opt.label}
          </label>
        ))}
      </div>
      <p className="muted" style={{ fontSize: "0.78rem", marginTop: 6 }}>
        예: 2, 3단을 체크하고 ×1~10배를 고르면 2×1~2×10, 3×1~3×10 범위에서만 출제돼요.
      </p>

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

      <label style={{ marginTop: 14 }}>출제 순서</label>
      <div className="tag-row">
        {[
          { value: "random", label: "🎲 랜덤" },
          { value: "sequential", label: "➡️ 순서대로" },
          { value: "reverse", label: "⬅️ 거꾸로" },
        ].map((opt) => (
          <label
            key={opt.value}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: problemOrder === opt.value ? "var(--brand)" : "#fff",
              color: problemOrder === opt.value ? "#fff" : "var(--ink)",
              border: "1.5px solid var(--line)",
              borderRadius: 8,
              padding: "6px 12px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "0.85rem",
            }}
          >
            <input
              type="radio"
              name="problem-order"
              value={opt.value}
              checked={problemOrder === opt.value}
              onChange={() => setProblemOrder(opt.value)}
              style={{ display: "none" }}
            />
            {opt.label}
          </label>
        ))}
      </div>
      <p className="muted" style={{ fontSize: "0.78rem", marginTop: 6 }}>
        순서대로/거꾸로를 선택하면 단이 작은 것(또는 큰 것)부터 곱수 순서대로 출제돼요. (예전에 틀린 문제가
        강제로 섞여 들어가도 이 순서를 따릅니다)
      </p>

      {err && <div className="error-box show">{err}</div>}

      <button className="btn small" disabled={saving} onClick={() => save(Array.from(tables))}>
        {saving ? "저장 중..." : "이 설정으로 저장"}
      </button>{" "}
      {(isCustom || problemOrder !== "random" || multRange !== "1-20") && (
        <button
          className="btn small ghost"
          disabled={saving}
          onClick={() => {
            setTables(new Set());
            setQuestionCount("");
            setProblemOrder("random");
            setMultRange("1-20");
            save([], { order: "random", multRange: "1-20" });
          }}
        >
          기본값(레벨 기준 자동)으로 되돌리기
        </button>
      )}
    </div>
  );
}
