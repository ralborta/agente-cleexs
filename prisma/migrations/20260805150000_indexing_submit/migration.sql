-- Sprint 5.2: persistir submits de indexación (GSC Indexing API + IndexNow)
ALTER TABLE "publications"
  ADD COLUMN IF NOT EXISTS "gsc_submitted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "gsc_submit_status" TEXT,
  ADD COLUMN IF NOT EXISTS "gsc_submit_detail" TEXT,
  ADD COLUMN IF NOT EXISTS "indexnow_submitted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "indexnow_status" TEXT,
  ADD COLUMN IF NOT EXISTS "indexnow_detail" TEXT;
