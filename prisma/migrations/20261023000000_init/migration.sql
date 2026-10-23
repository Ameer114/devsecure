-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');
CREATE TYPE "Scanner" AS ENUM ('GITLEAKS', 'TRIVY', 'SEMGREP');
CREATE TYPE "FindingKind" AS ENUM ('SECRET', 'VULNERABILITY', 'SAST', 'MISCONFIG');
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'REMEDIATED', 'FALSE_POSITIVE');
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'BLOCKED', 'CANCELLED');
CREATE TYPE "PolicyOutcome" AS ENUM ('ALLOW', 'BLOCK');
CREATE TYPE "DeploymentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'ROLLED_BACK');
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "ownerId" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PipelineRun" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "githubRunId" TEXT,
    "branch" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "PipelineRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "scanner" "Scanner" NOT NULL,
    "kind" "FindingKind" NOT NULL,
    "severity" "Severity" NOT NULL,
    "ruleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "filePath" TEXT,
    "startLine" INTEGER,
    "endLine" INTEGER,
    "fingerprint" TEXT NOT NULL,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "aiExplanation" TEXT,
    "aiSuggestion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PolicyDecision" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "outcome" "PolicyOutcome" NOT NULL,
    "reasons" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PolicyDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "runId" TEXT,
    "environment" TEXT NOT NULL,
    "imageRef" TEXT NOT NULL,
    "imageDigest" TEXT,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'PENDING',
    "healthCheckOk" BOOLEAN,
    "rolledBackToRef" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "runId" TEXT,
    "findingId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Repository_fullName_key" ON "Repository"("fullName");
CREATE INDEX "Repository_ownerId_idx" ON "Repository"("ownerId");
CREATE INDEX "PipelineRun_repositoryId_startedAt_idx" ON "PipelineRun"("repositoryId", "startedAt");
CREATE UNIQUE INDEX "PipelineRun_repositoryId_githubRunId_key" ON "PipelineRun"("repositoryId", "githubRunId");
CREATE INDEX "Finding_runId_idx" ON "Finding"("runId");
CREATE INDEX "Finding_repositoryId_status_idx" ON "Finding"("repositoryId", "status");
CREATE INDEX "Finding_fingerprint_idx" ON "Finding"("fingerprint");
CREATE UNIQUE INDEX "PolicyDecision_runId_key" ON "PolicyDecision"("runId");
CREATE INDEX "Deployment_repositoryId_startedAt_idx" ON "Deployment"("repositoryId", "startedAt");
CREATE INDEX "Notification_repositoryId_createdAt_idx" ON "Notification"("repositoryId", "createdAt");
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
CREATE INDEX "AuditEvent_repositoryId_createdAt_idx" ON "AuditEvent"("repositoryId", "createdAt");

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PipelineRun" ADD CONSTRAINT "PipelineRun_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PipelineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PolicyDecision" ADD CONSTRAINT "PolicyDecision_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PipelineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PipelineRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PipelineRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE SET NULL ON UPDATE CASCADE;
