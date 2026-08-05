-- AlterTable
ALTER TABLE "keyword_opportunities" ADD COLUMN "gsc_impressions" INTEGER;
ALTER TABLE "keyword_opportunities" ADD COLUMN "gsc_clicks" INTEGER;
ALTER TABLE "keyword_opportunities" ADD COLUMN "demand_score" INTEGER;
ALTER TABLE "keyword_opportunities" ADD COLUMN "score_reason" TEXT;
ALTER TABLE "keyword_opportunities" ADD COLUMN "scored_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "keyword_opportunities_workspace_id_demand_score_idx" ON "keyword_opportunities"("workspace_id", "demand_score");
