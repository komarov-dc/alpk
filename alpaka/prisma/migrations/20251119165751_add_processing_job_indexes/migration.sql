-- CreateIndex
CREATE INDEX "processing_jobs_status_idx" ON "public"."processing_jobs"("status");

-- CreateIndex
CREATE INDEX "processing_jobs_mode_idx" ON "public"."processing_jobs"("mode");

-- CreateIndex
CREATE INDEX "processing_jobs_status_mode_idx" ON "public"."processing_jobs"("status", "mode");
