import { prisma } from "@/lib/prisma";

// 로그인 성공, 테스트 제출 등 실제 행동이 확인되면 학부모가 "완료" 버튼을 누르지 않아도
// 온보딩 단계를 자동으로 완료 처리한다. 온보딩은 부가 기능이라 실패해도 본 기능(로그인,
// 테스트 제출)에는 영향을 주지 않도록 항상 조용히 무시한다.
export async function markOnboardingStepDone(studentId: string, step: number) {
  try {
    await prisma.onboardingStep.upsert({
      where: { studentId_step: { studentId, step } },
      update: {},
      create: { studentId, step },
    });
  } catch {
    // best-effort
  }
}
