-- CreateTable
CREATE TABLE "QueueRequest" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "QueueRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QueueRequest_status_type_createdAt_idx" ON "QueueRequest"("status", "type", "createdAt");

-- CreateIndex
CREATE INDEX "QueueRequest_clientId_status_idx" ON "QueueRequest"("clientId", "status");
