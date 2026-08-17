-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastDailyTestDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "elapsedSec" INTEGER,
    "detail" JSONB NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelExam" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "timedOut" BOOLEAN NOT NULL DEFAULT false,
    "elapsedSec" INTEGER,
    "detail" JSONB NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LevelExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelUp" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rewardGiven" BOOLEAN NOT NULL DEFAULT false,
    "rewardNote" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "LevelUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_name_key" ON "Student"("name");

-- CreateIndex
CREATE INDEX "DailyTest_studentId_takenAt_idx" ON "DailyTest"("studentId", "takenAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTest_studentId_date_key" ON "DailyTest"("studentId", "date");

-- CreateIndex
CREATE INDEX "LevelExam_studentId_takenAt_idx" ON "LevelExam"("studentId", "takenAt");

-- CreateIndex
CREATE UNIQUE INDEX "LevelExam_studentId_level_date_key" ON "LevelExam"("studentId", "level", "date");

-- CreateIndex
CREATE INDEX "LevelUp_studentId_idx" ON "LevelUp"("studentId");

-- AddForeignKey
ALTER TABLE "DailyTest" ADD CONSTRAINT "DailyTest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelExam" ADD CONSTRAINT "LevelExam_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelUp" ADD CONSTRAINT "LevelUp_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
