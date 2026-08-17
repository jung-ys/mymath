async function load() {
  try {
    const data = await api('/api/board');
    render(data);
  } catch (ex) {
    qs('#content').innerHTML = `<p class="error-box show">불러오지 못했습니다: ${ex.message}</p>`;
  }
}

function render(data) {
  const { levels, students, recentLevelUps, todayDailyCount, masterLevel } = data;
  qs('#today-line').textContent = `오늘 ${todayDailyCount}명이 오늘의 테스트를 완료했어요!`;

  const cols = levels
    .map((l) => {
      const members = students.filter((s) => s.level === l.level);
      const chips = members.map((s) => `<div class="member-chip">${s.name}<br/><span class="muted" style="font-weight:600;font-size:0.75rem">🔥${s.streak}일</span></div>`).join('');
      return `
        <div class="lvl-col">
          <h3><span class="badge lv${l.level}">${l.title}</span></h3>
          <p class="center muted" style="font-size:0.8rem">${l.range}</p>
          <div class="members">${chips || '<p class="center muted" style="font-size:0.8rem">-</p>'}</div>
        </div>`;
    })
    .join('');

  const masterMembers = students.filter((s) => s.level >= masterLevel);
  const masterChips = masterMembers.map((s) => `<div class="member-chip">🌟 ${s.name}</div>`).join('');
  const masterCol = `
    <div class="lvl-col">
      <h3><span class="badge lv5">마스터</span></h3>
      <p class="center muted" style="font-size:0.8rem">2~19단 전체</p>
      <div class="members">${masterChips || '<p class="center muted" style="font-size:0.8rem">-</p>'}</div>
    </div>`;

  const recentHtml = recentLevelUps
    .slice(0, 10)
    .map(
      (u) => `
      <div class="board-row">
        <div><span class="name">${u.studentName}</span> <span class="muted">· ${u.levelTitle} 통과!</span></div>
        <div>${u.rewardGiven ? '🎁 보상 지급 완료' : '⏳ 보상 대기중'}</div>
      </div>`
    )
    .join('');

  qs('#content').innerHTML = `
    <div class="card">
      <div class="columns">${cols}${masterCol}</div>
    </div>
    <div class="card">
      <h2 class="mt0">🎉 최근 레벨업 소식</h2>
      <div class="board-list">${recentHtml || '<p class="muted">아직 레벨업 기록이 없어요.</p>'}</div>
    </div>
  `;
}

load();
setInterval(load, 10000);
