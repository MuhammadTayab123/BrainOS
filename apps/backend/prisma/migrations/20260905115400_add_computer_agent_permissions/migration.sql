-- CreateTable
CREATE TABLE "ComputerAgentPermission" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ComputerAgentPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComputerAgentPermission_agentId_idx" ON "ComputerAgentPermission"("agentId");

-- CreateIndex
CREATE INDEX "ComputerAgentPermission_agentId_action_idx" ON "ComputerAgentPermission"("agentId", "action");

-- CreateIndex
CREATE INDEX "ComputerAgentPermission_agentId_deletedAt_idx" ON "ComputerAgentPermission"("agentId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ComputerAgentPermission_agentId_action_active_idx" ON "ComputerAgentPermission"("agentId", "action") WHERE "deletedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "ComputerAgentPermission" ADD CONSTRAINT "ComputerAgentPermission_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ComputerAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
