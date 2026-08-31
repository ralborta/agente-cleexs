-- AlterTable AgentConfig
ALTER TABLE "agent_configs" ADD COLUMN "settings" JSONB;

-- AlterTable KeywordOpportunity (métricas Discovery)
ALTER TABLE "keyword_opportunities" ADD COLUMN "monthly_searches" INTEGER;
ALTER TABLE "keyword_opportunities" ADD COLUMN "trend_score" INTEGER;
ALTER TABLE "keyword_opportunities" ADD COLUMN "relevance_score" INTEGER;
ALTER TABLE "keyword_opportunities" ADD COLUMN "opportunity_score" INTEGER;
ALTER TABLE "keyword_opportunities" ADD COLUMN "brief" JSONB;

-- CreateIndex
CREATE INDEX "keyword_opportunities_workspace_id_opportunity_score_idx" ON "keyword_opportunities"("workspace_id", "opportunity_score");
