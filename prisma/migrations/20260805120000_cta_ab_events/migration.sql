-- CreateTable
CREATE TABLE "cta_events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "piece_id" TEXT,
    "url" TEXT,
    "variant" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cta_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cta_events_workspace_id_variant_created_at_idx" ON "cta_events"("workspace_id", "variant", "created_at");

-- CreateIndex
CREATE INDEX "cta_events_workspace_id_url_idx" ON "cta_events"("workspace_id", "url");

-- AddForeignKey
ALTER TABLE "cta_events" ADD CONSTRAINT "cta_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
