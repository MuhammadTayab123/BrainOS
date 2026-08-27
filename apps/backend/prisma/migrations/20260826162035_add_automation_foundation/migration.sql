-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AutomationTriggerType" AS ENUM ('SCHEDULE', 'TASK_DUE', 'REMINDER_DUE');

-- CreateEnum
CREATE TYPE "AutomationActionType" AS ENUM ('CREATE_TASK', 'CREATE_REMINDER');

-- CreateEnum
CREATE TYPE "AutomationExecutionStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AutomationStatus" NOT NULL DEFAULT 'ACTIVE',
    "triggerType" "AutomationTriggerType" NOT NULL,
    "actionType" "AutomationActionType" NOT NULL,
    "config" JSONB NOT NULL,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExecution" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "status" "AutomationExecutionStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Automation_userId_idx" ON "Automation"("userId");

-- CreateIndex
CREATE INDEX "Automation_userId_status_idx" ON "Automation"("userId", "status");

-- CreateIndex
CREATE INDEX "Automation_nextRunAt_status_idx" ON "Automation"("nextRunAt", "status");

-- CreateIndex
CREATE INDEX "AutomationExecution_automationId_idx" ON "AutomationExecution"("automationId");

-- CreateIndex
CREATE INDEX "AutomationExecution_automationId_status_idx" ON "AutomationExecution"("automationId", "status");

-- CreateIndex
CREATE INDEX "AutomationExecution_startedAt_idx" ON "AutomationExecution"("startedAt");

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
