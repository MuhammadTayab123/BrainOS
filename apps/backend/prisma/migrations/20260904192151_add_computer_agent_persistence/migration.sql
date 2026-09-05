-- CreateEnum
CREATE TYPE "ComputerAgentStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "ComputerAgent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ComputerAgentStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastAuthenticatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ComputerAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComputerAgentCredential" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "credentialHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ComputerAgentCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComputerAgent_userId_idx" ON "ComputerAgent"("userId");

-- CreateIndex
CREATE INDEX "ComputerAgent_userId_status_idx" ON "ComputerAgent"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ComputerAgentCredential_credentialHash_key" ON "ComputerAgentCredential"("credentialHash");

-- CreateIndex
CREATE INDEX "ComputerAgentCredential_agentId_idx" ON "ComputerAgentCredential"("agentId");

-- AddForeignKey
ALTER TABLE "ComputerAgent" ADD CONSTRAINT "ComputerAgent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComputerAgentCredential" ADD CONSTRAINT "ComputerAgentCredential_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ComputerAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
