// 승급 시험을 통과한 단계별 보상 정의 (셀레나 달러 + 4단계 통과 시 간식 추가).
// 영어 프로그램의 "셀레나 달러 + 간식쿠폰" 보상 체계를 그대로 구구단 승급에도 적용한다.

export interface RewardInfo {
  dollars: number;
  treat: string | null;
}

const REWARDS: Record<number, RewardInfo> = {
  1: { dollars: 40, treat: null },
  2: { dollars: 60, treat: null },
  3: { dollars: 80, treat: null },
  4: { dollars: 100, treat: "베스킨라빈스 더블콘" },
};

export function rewardForLevel(level: number): RewardInfo {
  return REWARDS[level] || { dollars: 0, treat: null };
}

// "셀레나 달러 40개" / "셀레나 달러 100개 + 베스킨라빈스 더블콘" 같은 사람이 읽는 문구.
export function rewardLabel(level: number): string {
  const r = rewardForLevel(level);
  if (!r.dollars && !r.treat) return "";
  const parts = [`셀레나 달러 ${r.dollars}개`];
  if (r.treat) parts.push(r.treat);
  return parts.join(" + ");
}
