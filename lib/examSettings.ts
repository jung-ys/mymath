import { prisma } from "./prisma";
import { getLevelDef, examConfigWithTimeOverride, type ExamConfig } from "./levels";

// 관리자가 단계별로 전체 적용해둔 승급 시험 제한시간 설정을 level -> 초(seconds) 맵으로 반환한다.
export async function getLevelTimeSettingsMap(): Promise<Record<number, number>> {
  const rows = await prisma.levelTimeSetting.findMany();
  const map: Record<number, number> = {};
  rows.forEach((r) => {
    map[r.level] = r.timeLimitSec;
  });
  return map;
}

// 실제 적용할 승급 시험 제한시간을 우선순위대로 계산한다:
// 1) 이 학생만의 개별 설정(examTimeOverrideSec) > 2) 단계별 전체 설정(LevelTimeSetting)
// > 3) 자동 계산된 기본값(levelDef.examConfig).
export async function resolveExamConfig(level: number, studentOverrideSec?: number | null): Promise<ExamConfig | null> {
  const levelDef = getLevelDef(level);
  if (!levelDef) return null;
  if (studentOverrideSec && studentOverrideSec > 0) {
    return examConfigWithTimeOverride(levelDef.examConfig, studentOverrideSec);
  }
  const setting = await prisma.levelTimeSetting.findUnique({ where: { level } });
  return examConfigWithTimeOverride(levelDef.examConfig, setting?.timeLimitSec ?? null);
}
