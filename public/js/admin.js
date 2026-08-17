let levels = [];
let masterLevel = 5;
let students = [];

const elLoading = qs('#loading');
const elSetup = qs('#view-setup');
const elLogin = qs('#view-login');
const elDashboard = qs('#view-dashboard');
const logoutBtn = qs('#logout-btn');

function showOnly(el) {
  [elLoading, elSetup, elLogin, elDashboard].forEach((x) => (x.style.display = x === el ? '' : 'none'));
}

async function init() {
  try {
    const status = await api('/api/admin/status');
    if (!status.initialized) {
      showOnly(elSetup);
      return;
    }
    const me = await api('/api/me');
    if (me.authed && me.type === 'admin') {
      logoutBtn.style.display = '';
      await loadDashboard();
    } else {
      showOnly(elLogin);
    }
  } catch (ex) {
    showOnly(elLogin);
  }
}

qs('#setup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = qs('#setup-err');
  hideError(err);
  try {
    await api('/api/admin/setup', { method: 'POST', body: { password: qs('#setup-pw').value } });
    logoutBtn.style.display = '';
    await loadDashboard();
  } catch (ex) {
    showError(err, ex.message);
  }
});

qs('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = qs('#login-err');
  hideError(err);
  try {
    await api('/api/admin/login', { method: 'POST', body: { password: qs('#login-pw').value } });
    logoutBtn.style.display = '';
    await loadDashboard();
  } catch (ex) {
    showError(err, ex.message);
  }
});

logoutBtn.addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  location.reload();
});

async function loadDashboard() {
  const [studentsData, levelUpsData] = await Promise.all([
    api('/api/admin/students'),
    api('/api/admin/level-ups'),
  ]);
  levels = studentsData.levels;
  masterLevel = studentsData.masterLevel;
  students = studentsData.students;
  renderDashboard(levelUpsData.levelUps);
}

function levelOptionsHtml(selected) {
  const opts = levels.map((l) => `<option value="${l.level}" ${selected === l.level ? 'selected' : ''}>${l.title} (${l.range})</option>`);
  opts.push(`<option value="${masterLevel}" ${selected === masterLevel ? 'selected' : ''}>마스터 (전체 완료)</option>`);
  return opts.join('');
}

function renderDashboard(levelUps) {
  const studentRows = students
    .map(
      (s) => `
      <tr>
        <td><button class="link" style="color:var(--brand);font-weight:700;text-decoration:underline" data-detail="${s.id}">${s.name}</button></td>
        <td><span class="badge ${levelBadgeClass(s.level, masterLevel)}">${s.levelTitle}</span></td>
        <td>${s.streak}일</td>
        <td>${s.todayDone ? '✅' : '—'}</td>
        <td>
          <button class="btn small ghost" data-pin="${s.id}">PIN 재설정</button>
          <button class="btn small ghost" data-del="${s.id}">삭제</button>
        </td>
      </tr>`
    )
    .join('');

  const rewardRows = levelUps
    .slice(0, 15)
    .map(
      (u) => `
      <div class="board-row">
        <div>
          <span class="name">${u.studentName}</span>
          <span class="muted"> · ${u.levelTitle} 통과 · ${fmtDate(u.awardedAt)}</span>
        </div>
        <label class="reward-check">
          <input type="checkbox" data-reward="${u.id}" ${u.rewardGiven ? 'checked' : ''} />
          셀레나 달러/간식 지급 완료
        </label>
      </div>`
    )
    .join('');

  elDashboard.innerHTML = `
    <div class="card">
      <h2 class="mt0">학생 추가</h2>
      <form id="add-form">
        <div class="grid-2">
          <div>
            <label for="new-name">이름</label>
            <input type="text" id="new-name" required />
          </div>
          <div>
            <label for="new-pin">비밀번호 (숫자 4~6자리)</label>
            <input type="text" id="new-pin" inputmode="numeric" required />
          </div>
        </div>
        <label for="new-level">시작 단계</label>
        <select id="new-level">${levelOptionsHtml(1)}</select>
        <button class="btn" type="submit">학생 등록</button>
        <div class="error-box" id="add-err"></div>
      </form>
    </div>

    <div class="card">
      <h2 class="mt0">🎁 레벨업 보상 체크리스트</h2>
      <p class="muted" style="font-size:0.85rem">승급 시험을 통과한 학생에게 셀레나 달러와 간식 쿠폰을 지급하면 체크해주세요.</p>
      <div class="board-list">${rewardRows || '<p class="muted">최근 레벨업 기록이 없어요.</p>'}</div>
    </div>

    <div class="card">
      <h2 class="mt0">학생 목록 (${students.length}명)</h2>
      <table>
        <thead><tr><th>이름</th><th>단계</th><th>연속출석</th><th>오늘</th><th>관리</th></tr></thead>
        <tbody>${studentRows || ''}</tbody>
      </table>
      ${students.length ? '' : '<p class="muted">등록된 학생이 없어요.</p>'}
    </div>

    <div class="card" id="detail-card" style="display:none"></div>
  `;
  showOnly(elDashboard);

  qs('#add-form').addEventListener('submit', onAddStudent);
  qsa('[data-reward]').forEach((cb) => cb.addEventListener('change', onToggleReward));
  qsa('[data-detail]').forEach((btn) => btn.addEventListener('click', () => showDetail(btn.dataset.detail)));
  qsa('[data-pin]').forEach((btn) => btn.addEventListener('click', () => onResetPin(btn.dataset.pin)));
  qsa('[data-del]').forEach((btn) => btn.addEventListener('click', () => onDeleteStudent(btn.dataset.del)));
}

async function onAddStudent(e) {
  e.preventDefault();
  const err = qs('#add-err');
  hideError(err);
  try {
    await api('/api/admin/students', {
      method: 'POST',
      body: {
        name: qs('#new-name').value.trim(),
        pin: qs('#new-pin').value.trim(),
        startLevel: Number(qs('#new-level').value),
      },
    });
    await loadDashboard();
  } catch (ex) {
    showError(err, ex.message);
  }
}

async function onToggleReward(e) {
  const id = e.target.dataset.reward;
  try {
    await api(`/api/admin/level-ups/${id}/reward`, { method: 'POST', body: { rewardGiven: e.target.checked } });
  } catch (ex) {
    alert(ex.message);
    e.target.checked = !e.target.checked;
  }
}

async function onResetPin(studentId) {
  const pin = prompt('새 비밀번호 (숫자 4~6자리)를 입력하세요.');
  if (pin === null) return;
  try {
    await api(`/api/admin/students/${studentId}/reset-pin`, { method: 'POST', body: { pin: pin.trim() } });
    alert('비밀번호가 변경되었습니다.');
  } catch (ex) {
    alert(ex.message);
  }
}

async function onDeleteStudent(studentId) {
  const student = students.find((s) => s.id === studentId);
  if (!confirm(`정말 '${student ? student.name : ''}' 학생을 삭제할까요? 모든 기록이 함께 삭제됩니다.`)) return;
  try {
    await api(`/api/admin/students/${studentId}`, { method: 'DELETE' });
    await loadDashboard();
  } catch (ex) {
    alert(ex.message);
  }
}

async function showDetail(studentId) {
  const card = qs('#detail-card');
  card.style.display = '';
  card.innerHTML = '<p class="muted">불러오는 중...</p>';
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  try {
    const summary = await api(`/api/admin/students/${studentId}`);
    renderDetail(card, summary);
  } catch (ex) {
    card.innerHTML = `<p class="error-box show">${ex.message}</p>`;
  }
}

function renderDetail(card, summary) {
  const { student, history } = summary;
  const dailyRows = history.daily
    .map((d) => `<tr><td>${fmtDateOnly(d.date)}</td><td>${d.score}/${d.total}</td><td>${fmtDate(d.takenAt)}</td></tr>`)
    .join('');
  const levelRows = history.levelExams
    .map(
      (e) =>
        `<tr><td>${e.level}단계</td><td>${e.score}/${e.total}</td><td><span class="pill ${e.passed ? 'pass' : 'fail'}">${e.passed ? '통과' : '미통과'}</span></td><td>${fmtDate(e.takenAt)}</td></tr>`
    )
    .join('');

  card.innerHTML = `
    <div class="flex-between">
      <h2 class="mt0">${student.name} 님 상세 기록 <span class="badge ${levelBadgeClass(student.level, masterLevel)}">${student.levelTitle}</span></h2>
      <div>
        <label style="display:inline-flex;align-items:center;gap:6px;margin:0">
          단계 직접 조정:
          <select id="detail-level">${levelOptionsHtml(student.level)}</select>
        </label>
        <button class="btn small" id="apply-level">적용</button>
      </div>
    </div>
    <div class="grid-2">
      <div>
        <h3>오늘의 테스트 이력</h3>
        ${dailyRows ? `<table><thead><tr><th>날짜</th><th>점수</th><th>응시시각</th></tr></thead><tbody>${dailyRows}</tbody></table>` : '<p class="muted">기록 없음</p>'}
      </div>
      <div>
        <h3>승급 시험 이력</h3>
        ${levelRows ? `<table><thead><tr><th>단계</th><th>점수</th><th>결과</th><th>응시시각</th></tr></thead><tbody>${levelRows}</tbody></table>` : '<p class="muted">기록 없음</p>'}
      </div>
    </div>
  `;

  qs('#apply-level').addEventListener('click', async () => {
    const level = Number(qs('#detail-level').value);
    try {
      await api(`/api/admin/students/${student.id}/adjust-level`, { method: 'POST', body: { level } });
      await loadDashboard();
      showDetail(student.id);
    } catch (ex) {
      alert(ex.message);
    }
  });
}

init();
