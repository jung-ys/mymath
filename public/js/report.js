function paramId() {
  return new URLSearchParams(location.search).get('id');
}

qs('#print-btn').addEventListener('click', () => window.print());

function readinessBlock(r) {
  if (!r) return '';
  const streakPct = Math.min(100, Math.round((r.streak / r.minStreakDays) * 100));
  const accBase = r.recentCount > 0 ? r.avgAccuracyPct : 0;
  const accPct = Math.min(100, Math.round((accBase / r.minAvgAccuracyPct) * 100));
  const accLabel = r.recentCount < r.minRecentTests ? `기록 ${r.recentCount}/${r.minRecentTests}회` : `${r.avgAccuracyPct}%`;
  return `
    <div class="card">
      <h2 class="mt0">다음 승급 시험 자격 기준</h2>
      <div class="callout ${r.eligible ? 'go' : 'wait'}">${r.eligible ? '자격 기준 충족 — 승급 시험 응시 가능' : '아직 자격 기준 미충족'}</div>
      <div class="readiness">
        <div class="readiness-row">
          <div class="row-label"><span>연속 출석</span><span class="${r.streakOk ? 'ok' : ''}">${r.streak}/${r.minStreakDays}일</span></div>
          <div class="mini-track"><div class="mini-fill" style="width:${streakPct}%;background:${r.streakOk ? 'var(--good)' : 'var(--brand)'}"></div></div>
        </div>
        <div class="readiness-row">
          <div class="row-label"><span>최근 ${r.minRecentTests}회 평균 정답률</span><span class="${r.accuracyOk ? 'ok' : ''}">${accLabel} / ${r.minAvgAccuracyPct}%</span></div>
          <div class="mini-track"><div class="mini-fill" style="width:${accPct}%;background:${r.accuracyOk ? 'var(--good)' : 'var(--brand)'}"></div></div>
        </div>
      </div>
    </div>`;
}

async function load() {
  const id = paramId();
  if (!id) {
    qs('#content').innerHTML = '<p class="error-box show">학생 정보가 없습니다.</p>';
    return;
  }
  let summary;
  try {
    summary = await api(`/api/admin/students/${id}`);
  } catch (ex) {
    if (ex.status === 401) {
      location.href = '/admin.html';
      return;
    }
    qs('#content').innerHTML = `<p class="error-box show">${ex.message}</p>`;
    return;
  }
  render(summary);
}

function render(summary) {
  const { student, history, dailyTest, levelExam, masterLevel } = summary;
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  const dailyRows = history.daily
    .slice()
    .reverse()
    .map((d) => `<tr><td>${fmtDateOnly(d.date)}</td><td>${d.score}/${d.total} (${Math.round((d.score / d.total) * 100)}%)</td></tr>`)
    .join('');

  const levelUpRows = history.levelUps
    .map((u) => `<tr><td>${u.level}단계 통과</td><td>${fmtDate(u.awardedAt)}</td><td>${u.rewardGiven ? '지급 완료' : '지급 대기'}</td></tr>`)
    .join('');

  qs('#content').innerHTML = `
    <div class="hero" style="padding:20px 0">
      <h1>${student.name} 학생 학습 리포트</h1>
      <p class="muted">발행일: ${today}</p>
    </div>

    <div class="card">
      <div class="flex-between">
        <span class="badge ${levelBadgeClass(student.level, masterLevel)}">${student.levelTitle}</span>
        <span class="muted" style="font-size:0.85rem">등록일 ${fmtDateOnly((student.createdAt && new Date(student.createdAt).toISOString().slice(0,10)) || '')}</span>
      </div>
      <div class="stat-row">
        <div class="stat"><div class="num">${student.streak}</div><div class="label">연속 출석일</div></div>
        <div class="stat"><div class="num">${history.levelUps.length}</div><div class="label">누적 레벨업</div></div>
        <div class="stat"><div class="num">${history.daily.length}</div><div class="label">최근 테스트 기록 수</div></div>
      </div>
    </div>

    ${student.isMaster ? '' : readinessBlock(levelExam.readiness)}

    <div class="card">
      <h2 class="mt0">최근 오늘의 테스트 성적 추이</h2>
      ${dailyRows ? `<table><thead><tr><th>날짜</th><th>점수</th></tr></thead><tbody>${dailyRows}</tbody></table>` : '<p class="muted">아직 기록이 없어요.</p>'}
    </div>

    <div class="card">
      <h2 class="mt0">레벨업 이력</h2>
      ${levelUpRows ? `<table><thead><tr><th>단계</th><th>날짜</th><th>보상</th></tr></thead><tbody>${levelUpRows}</tbody></table>` : '<p class="muted">아직 레벨업 기록이 없어요.</p>'}
    </div>

    <p class="muted center" style="font-size:0.8rem">구구단 레벨업 시스템에서 자동 생성된 리포트입니다.</p>
  `;
}

load();
