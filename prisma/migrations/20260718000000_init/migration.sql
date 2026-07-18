-- CreateTable
CREATE TABLE "Runbook" ("id" TEXT NOT NULL PRIMARY KEY, "slug" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT NOT NULL, "yaml" TEXT NOT NULL, "severity" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "Runbook_slug_key" ON "Runbook"("slug");
CREATE TABLE "Run" ("id" TEXT NOT NULL PRIMARY KEY, "runbookId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'QUEUED', "startedAt" DATETIME, "completedAt" DATETIME, "durationMs" INTEGER, "stepsJson" TEXT NOT NULL DEFAULT '[]', "invariantsJson" TEXT NOT NULL DEFAULT '[]', "resultJson" TEXT, "explanation" TEXT, "evidenceMarkdown" TEXT, "issueDraftJson" TEXT, "artifactPath" TEXT, "tracePath" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Run_runbookId_fkey" FOREIGN KEY ("runbookId") REFERENCES "Runbook" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX "Run_runbookId_createdAt_idx" ON "Run"("runbookId", "createdAt");
CREATE TABLE "Job" ("id" TEXT NOT NULL PRIMARY KEY, "runId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'QUEUED', "error" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "claimedAt" DATETIME, CONSTRAINT "Job_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE UNIQUE INDEX "Job_runId_key" ON "Job"("runId");
CREATE TABLE "Regression" ("key" TEXT NOT NULL PRIMARY KEY, "enabled" BOOLEAN NOT NULL DEFAULT false, "updatedAt" DATETIME NOT NULL);
CREATE TABLE "Setting" ("key" TEXT NOT NULL PRIMARY KEY, "value" TEXT NOT NULL);
CREATE TABLE "DemoState" ("key" TEXT NOT NULL PRIMARY KEY, "value" TEXT NOT NULL);
