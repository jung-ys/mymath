-- DropIndex
DROP INDEX "DailyTest_studentId_date_key";

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "dailyTestLimit" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "DailyTest_studentId_date_idx" ON "DailyTest"("studentId", "date");
