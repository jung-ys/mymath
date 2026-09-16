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
    title: "① 접속하고 로그인하기",
    description: "아래 버튼을 눌러 사이트에 접속한 뒤, 아이 이름과 선생님이 알려주신 비밀번호(숫자 4~6자리)로 로그인해보세요.",
  },
  {
    step: 2,
    title: "② 홈 화면에 바로가기 추가하기",
    description: "로그인된 지금 이 화면을 다음부터 앱처럼 바로 열 수 있도록 휴대폰(또는 태블릿) 홈 화면에 추가해주세요.",
  },
  {
    step: 3,
    title: "③ 오늘의 테스트 풀어보기",
    description: "'오늘의 테스트'를 한 번 풀어보면 준비 끝이에요!",
  },
];

export const ONBOARDING_TOTAL_STEPS = ONBOARDING_STEPS.length;
