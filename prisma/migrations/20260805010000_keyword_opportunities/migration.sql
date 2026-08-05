-- CreateEnum
CREATE TYPE "FunnelStage" AS ENUM ('tofu', 'mofu', 'bofu');

-- CreateEnum
CREATE TYPE "KeywordOpportunityStatus" AS ENUM ('idea', 'queued', 'in_progress', 'covered', 'discarded');

-- CreateTable
CREATE TABLE "keyword_opportunities" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "seed_keyword" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "cluster" TEXT NOT NULL,
    "stage" "FunnelStage" NOT NULL,
    "intent" TEXT,
    "intent_label" TEXT,
    "status" "KeywordOpportunityStatus" NOT NULL DEFAULT 'idea',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keyword_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "keyword_opportunities_workspace_id_status_idx" ON "keyword_opportunities"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "keyword_opportunities_workspace_id_stage_idx" ON "keyword_opportunities"("workspace_id", "stage");

-- CreateIndex
CREATE INDEX "keyword_opportunities_workspace_id_cluster_idx" ON "keyword_opportunities"("workspace_id", "cluster");

-- CreateIndex
CREATE INDEX "keyword_opportunities_workspace_id_priority_idx" ON "keyword_opportunities"("workspace_id", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_opportunities_workspace_id_keyword_key" ON "keyword_opportunities"("workspace_id", "keyword");

-- AddForeignKey
ALTER TABLE "keyword_opportunities" ADD CONSTRAINT "keyword_opportunities_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
