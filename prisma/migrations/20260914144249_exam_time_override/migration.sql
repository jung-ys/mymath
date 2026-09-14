-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "examTimeOverrideSec" INTEGER;

-- CreateTable
CREATE TABLE "LevelTimeSetting" (
    "level" INTEGER NOT NULL,
    "timeLimitSec" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LevelTimeSetting_pkey" PRIMARY KEY ("level")
);
