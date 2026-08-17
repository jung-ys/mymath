-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "allowDuplicates" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "customCount" INTEGER,
ADD COLUMN     "customTables" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
CREATE TABLE "RetestAttempt" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "elapsedSec" INTEGER,
    "detail" JSONB NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetestAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RetestAttempt_studentId_takenAt_idx" ON "RetestAttempt"("studentId", "takenAt");

-- AddForeignKey
ALTER TABLE "RetestAttempt" ADD CONSTRAINT "RetestAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
