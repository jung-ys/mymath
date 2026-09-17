// 학부모 온보딩 체크리스트에서 쓰는 단계 정의. 학생별 개인 링크(/onboarding/[studentId])와
// 관리자 화면의 진행 현황 표가 이 목록을 공유한다.

export interface OnboardingStepDef {
  step: number;
  title: string;
  description: string;
}

export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  {
    step: 1,
    title: "① 홈 화면에 바로가기 추가하기",
    description: "아래 버튼으로 사이트를 먼저 열어보고, 앱처럼 바로 열 수 있도록 휴대폰(또는 태블릿) 홈 화면에 바로가기를 추가해주세요.",
  },
  {
    step: 2,
    title: "② 로그인하기",
    description: "①에서 추가한 홈 화면 아이콘을 눌러 앱을 연 뒤, 아이 이름과 선생님이 알려주신 비밀번호(숫자 4~6자리)로 로그인해보세요.",
  },
  {
    step: 3,
    title: "③ 오늘의 테스트 풀어보기",
    description: "'오늘의 테스트'를 한 번 풀어보면 준비 끝이에요!",
  },
];

export const ONBOARDING_TOTAL_STEPS = ONBOARDING_STEPS.length;

// 형제자매가 같은 학원에 다닐 때, 링크 하나로 두 아이를 모두 안내할 수 있도록
// URL 경로에 학생 ID를 "-"로 이어붙여 넣는다(cuid는 "-"를 쓰지 않아 구분자로 안전함).
export function parseOnboardingIds(param: string): string[] {
  return Array.from(new Set(param.split("-").map((s) => s.trim()).filter(Boolean)));
}

export function buildOnboardingPath(ids: string[]): string {
  return `/onboarding/${ids.join("-")}`;
}
