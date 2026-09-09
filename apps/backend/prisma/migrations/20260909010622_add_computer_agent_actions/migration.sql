-- CreateEnum
CREATE TYPE "ComputerAgentActionStatus" AS ENUM ('PENDING', 'CLAIMED', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT');

-- CreateTable
CREATE TABLE "ComputerAgentAction" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "actionName" TEXT NOT NULL,
    "params" JSONB,
    "status" "ComputerAgentActionStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "error" TEXT,
    "claimedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComputerAgentAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComputerAgentAction_correlationId_key" ON "ComputerAgentAction"("correlationId");

-- CreateIndex
CREATE INDEX "ComputerAgentAction_agentId_status_idx" ON "ComputerAgentAction"("agentId", "status");

-- CreateIndex
CREATE INDEX "ComputerAgentAction_userId_status_idx" ON "ComputerAgentAction"("userId", "status");

-- CreateIndex
CREATE INDEX "ComputerAgentAction_expiresAt_status_idx" ON "ComputerAgentAction"("expiresAt", "status");

-- CreateIndex
CREATE INDEX "ComputerAgentAction_agentId_expiresAt_status_idx" ON "ComputerAgentAction"("agentId", "expiresAt", "status");

-- AddForeignKey
ALTER TABLE "ComputerAgentAction" ADD CONSTRAINT "ComputerAgentAction_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ComputerAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComputerAgentAction" ADD CONSTRAINT "ComputerAgentAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
