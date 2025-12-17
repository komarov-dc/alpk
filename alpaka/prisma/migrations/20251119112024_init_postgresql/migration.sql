-- CreateTable
CREATE TABLE "public"."projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "canvasData" JSONB,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."execution_instances" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "jobId" TEXT,
    "sessionId" TEXT,
    "status" TEXT NOT NULL,
    "totalNodes" INTEGER NOT NULL,
    "executedNodes" INTEGER NOT NULL DEFAULT 0,
    "failedNodes" INTEGER NOT NULL DEFAULT 0,
    "skippedNodes" INTEGER NOT NULL DEFAULT 0,
    "currentNodeId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "error" TEXT,
    "globalVariablesSnapshot" JSONB NOT NULL,
    "executionResults" JSONB,

    CONSTRAINT "execution_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."execution_logs" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "executionInstanceId" TEXT,
    "input" JSONB,
    "output" JSONB,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."global_variables" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT,
    "description" TEXT,
    "folder" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."processing_jobs" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "workerId" TEXT,
    "responses" JSONB NOT NULL,
    "reports" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."system_flags" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_flags_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "execution_instances_projectId_idx" ON "public"."execution_instances"("projectId");

-- CreateIndex
CREATE INDEX "execution_instances_jobId_idx" ON "public"."execution_instances"("jobId");

-- CreateIndex
CREATE INDEX "execution_instances_sessionId_idx" ON "public"."execution_instances"("sessionId");

-- CreateIndex
CREATE INDEX "execution_instances_status_idx" ON "public"."execution_instances"("status");

-- CreateIndex
CREATE INDEX "execution_logs_executionInstanceId_idx" ON "public"."execution_logs"("executionInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "global_variables_projectId_name_key" ON "public"."global_variables"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "processing_jobs_sessionId_key" ON "public"."processing_jobs"("sessionId");

-- AddForeignKey
ALTER TABLE "public"."execution_instances" ADD CONSTRAINT "execution_instances_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."execution_logs" ADD CONSTRAINT "execution_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."execution_logs" ADD CONSTRAINT "execution_logs_executionInstanceId_fkey" FOREIGN KEY ("executionInstanceId") REFERENCES "public"."execution_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."global_variables" ADD CONSTRAINT "global_variables_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
