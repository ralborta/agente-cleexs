-- CreateEnum
CREATE TYPE "AgentJobStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "GrowthRunStatus" AS ENUM ('queued', 'generating_queries', 'searching', 'verifying', 'scoring', 'drafting', 'completed', 'completed_partial', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "GrowthRunTrigger" AS ENUM ('manual', 'auto_publish');

-- CreateEnum
CREATE TYPE "GrowthSerpResultType" AS ENUM ('organic', 'discussions_and_forums', 'questions_and_answers', 'other');

-- CreateEnum
CREATE TYPE "GrowthVerifyStatus" AS ENUM ('pending', 'verified', 'not_verifiable', 'excluded');

-- CreateEnum
CREATE TYPE "GrowthOpportunityEditorialStatus" AS ENUM ('candidate', 'draft_ready', 'approved', 'discarded');

-- CreateEnum
CREATE TYPE "GrowthReplyDraftStatus" AS ENUM ('pending_review', 'approved', 'discarded');

-- CreateEnum
CREATE TYPE "GrowthMetricKind" AS ENUM ('ga4_sessions', 'contact_manual', 'commercial_manual', 'interaction_manual');

-- CreateEnum
CREATE TYPE "GrowthMetricSource" AS ENUM ('ga4', 'manual');

-- CreateEnum
CREATE TYPE "GrowthTopicInsightStatus" AS ENUM ('draft_for_discovery', 'reviewed', 'dismissed');

-- CreateTable
CREATE TABLE "agent_jobs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "AgentJobStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "next_run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "agent_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_conversation_runs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "piece_id" TEXT NOT NULL,
    "publication_id" TEXT,
    "status" "GrowthRunStatus" NOT NULL DEFAULT 'queued',
    "trigger" "GrowthRunTrigger" NOT NULL DEFAULT 'manual',
    "config_snapshot" JSONB,
    "provider_mode" TEXT,
    "query_count" INTEGER NOT NULL DEFAULT 0,
    "serp_hit_count" INTEGER NOT NULL DEFAULT 0,
    "verified_count" INTEGER NOT NULL DEFAULT 0,
    "opportunity_count" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DOUBLE PRECISION,
    "cost_estimated_usd" DOUBLE PRECISION,
    "cost_is_estimate" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "progress_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "growth_conversation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_search_queries" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "piece_id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "query_normalized" TEXT NOT NULL,
    "rationale" TEXT,
    "language_code" TEXT NOT NULL,
    "location_code" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_search_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_serp_hits" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "query_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "url_normalized" TEXT NOT NULL,
    "title" TEXT,
    "snippet" TEXT,
    "position" INTEGER,
    "result_type" "GrowthSerpResultType" NOT NULL DEFAULT 'organic',
    "domain" TEXT,
    "provider_payload" JSONB,
    "provider_mode" TEXT NOT NULL,
    "excluded_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_serp_hits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_conversation_pages" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "url_normalized" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT,
    "topic" TEXT,
    "question_text" TEXT,
    "audience_fit_notes" TEXT,
    "thread_created_at" TIMESTAMP(3),
    "last_activity_at" TIMESTAMP(3),
    "thread_created_at_known" BOOLEAN NOT NULL DEFAULT false,
    "last_activity_at_known" BOOLEAN NOT NULL DEFAULT false,
    "participation_signals" JSONB,
    "allows_replies" BOOLEAN,
    "is_closed" BOOLEAN,
    "is_archived" BOOLEAN,
    "link_rules_notes" TEXT,
    "evidence_snippet" TEXT,
    "verify_status" "GrowthVerifyStatus" NOT NULL DEFAULT 'pending',
    "verified_at" TIMESTAMP(3),
    "verify_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "growth_conversation_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_opportunities" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "piece_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "serp_hit_id" TEXT,
    "opportunity_score" DOUBLE PRECISION NOT NULL,
    "evidence_confidence" DOUBLE PRECISION NOT NULL,
    "score_breakdown" JSONB NOT NULL,
    "editorial_status" "GrowthOpportunityEditorialStatus" NOT NULL DEFAULT 'candidate',
    "discard_reason" TEXT,
    "recommended_rank" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "growth_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_reply_drafts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "body" TEXT NOT NULL,
    "include_link" BOOLEAN NOT NULL DEFAULT false,
    "link_url" TEXT,
    "sources" JSONB,
    "status" "GrowthReplyDraftStatus" NOT NULL DEFAULT 'pending_review',
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "growth_reply_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_interventions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "reply_draft_id" TEXT NOT NULL,
    "attribution_id" TEXT NOT NULL,
    "published_url" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "registered_by_id" TEXT NOT NULL,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "article_url_with_utm" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_interventions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_intervention_metrics" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "intervention_id" TEXT NOT NULL,
    "kind" "GrowthMetricKind" NOT NULL,
    "value" DOUBLE PRECISION,
    "value_known" BOOLEAN NOT NULL DEFAULT false,
    "source" "GrowthMetricSource" NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "provenance" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_intervention_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_topic_insights" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "piece_id" TEXT,
    "run_id" TEXT,
    "topic_key" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "status" "GrowthTopicInsightStatus" NOT NULL DEFAULT 'draft_for_discovery',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "growth_topic_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_jobs_status_next_run_at_idx" ON "agent_jobs"("status", "next_run_at");

-- CreateIndex
CREATE INDEX "agent_jobs_workspace_id_type_status_idx" ON "agent_jobs"("workspace_id", "type", "status");

-- CreateIndex
CREATE INDEX "growth_conversation_runs_workspace_id_status_created_at_idx" ON "growth_conversation_runs"("workspace_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "growth_conversation_runs_piece_id_created_at_idx" ON "growth_conversation_runs"("piece_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "growth_search_queries_run_id_query_normalized_key" ON "growth_search_queries"("run_id", "query_normalized");

-- CreateIndex
CREATE INDEX "growth_search_queries_workspace_id_piece_id_idx" ON "growth_search_queries"("workspace_id", "piece_id");

-- CreateIndex
CREATE UNIQUE INDEX "growth_serp_hits_run_id_url_normalized_key" ON "growth_serp_hits"("run_id", "url_normalized");

-- CreateIndex
CREATE INDEX "growth_serp_hits_workspace_id_url_normalized_idx" ON "growth_serp_hits"("workspace_id", "url_normalized");

-- CreateIndex
CREATE INDEX "growth_serp_hits_run_id_idx" ON "growth_serp_hits"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "growth_conversation_pages_workspace_id_url_normalized_key" ON "growth_conversation_pages"("workspace_id", "url_normalized");

-- CreateIndex
CREATE INDEX "growth_conversation_pages_workspace_id_verify_status_idx" ON "growth_conversation_pages"("workspace_id", "verify_status");

-- CreateIndex
CREATE UNIQUE INDEX "growth_opportunities_run_id_conversation_id_key" ON "growth_opportunities"("run_id", "conversation_id");

-- CreateIndex
CREATE INDEX "growth_opportunities_workspace_id_editorial_status_idx" ON "growth_opportunities"("workspace_id", "editorial_status");

-- CreateIndex
CREATE INDEX "growth_opportunities_piece_id_idx" ON "growth_opportunities"("piece_id");

-- CreateIndex
CREATE INDEX "growth_reply_drafts_workspace_id_status_idx" ON "growth_reply_drafts"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "growth_reply_drafts_opportunity_id_version_idx" ON "growth_reply_drafts"("opportunity_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "growth_interventions_attribution_id_key" ON "growth_interventions"("attribution_id");

-- CreateIndex
CREATE INDEX "growth_interventions_workspace_id_published_at_idx" ON "growth_interventions"("workspace_id", "published_at");

-- CreateIndex
CREATE INDEX "growth_interventions_opportunity_id_idx" ON "growth_interventions"("opportunity_id");

-- CreateIndex
CREATE INDEX "growth_intervention_metrics_workspace_id_kind_captured_at_idx" ON "growth_intervention_metrics"("workspace_id", "kind", "captured_at");

-- CreateIndex
CREATE INDEX "growth_intervention_metrics_intervention_id_idx" ON "growth_intervention_metrics"("intervention_id");

-- CreateIndex
CREATE INDEX "growth_topic_insights_workspace_id_status_created_at_idx" ON "growth_topic_insights"("workspace_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "growth_topic_insights_topic_key_idx" ON "growth_topic_insights"("topic_key");

-- AddForeignKey
ALTER TABLE "agent_jobs" ADD CONSTRAINT "agent_jobs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_conversation_runs" ADD CONSTRAINT "growth_conversation_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_conversation_runs" ADD CONSTRAINT "growth_conversation_runs_piece_id_fkey" FOREIGN KEY ("piece_id") REFERENCES "content_pieces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_conversation_runs" ADD CONSTRAINT "growth_conversation_runs_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_search_queries" ADD CONSTRAINT "growth_search_queries_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_search_queries" ADD CONSTRAINT "growth_search_queries_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "growth_conversation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_search_queries" ADD CONSTRAINT "growth_search_queries_piece_id_fkey" FOREIGN KEY ("piece_id") REFERENCES "content_pieces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_serp_hits" ADD CONSTRAINT "growth_serp_hits_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_serp_hits" ADD CONSTRAINT "growth_serp_hits_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "growth_conversation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_serp_hits" ADD CONSTRAINT "growth_serp_hits_query_id_fkey" FOREIGN KEY ("query_id") REFERENCES "growth_search_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_conversation_pages" ADD CONSTRAINT "growth_conversation_pages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_opportunities" ADD CONSTRAINT "growth_opportunities_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_opportunities" ADD CONSTRAINT "growth_opportunities_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "growth_conversation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_opportunities" ADD CONSTRAINT "growth_opportunities_piece_id_fkey" FOREIGN KEY ("piece_id") REFERENCES "content_pieces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_opportunities" ADD CONSTRAINT "growth_opportunities_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "growth_conversation_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_opportunities" ADD CONSTRAINT "growth_opportunities_serp_hit_id_fkey" FOREIGN KEY ("serp_hit_id") REFERENCES "growth_serp_hits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_reply_drafts" ADD CONSTRAINT "growth_reply_drafts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_reply_drafts" ADD CONSTRAINT "growth_reply_drafts_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "growth_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_reply_drafts" ADD CONSTRAINT "growth_reply_drafts_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_interventions" ADD CONSTRAINT "growth_interventions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_interventions" ADD CONSTRAINT "growth_interventions_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "growth_opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_interventions" ADD CONSTRAINT "growth_interventions_reply_draft_id_fkey" FOREIGN KEY ("reply_draft_id") REFERENCES "growth_reply_drafts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_interventions" ADD CONSTRAINT "growth_interventions_registered_by_id_fkey" FOREIGN KEY ("registered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_intervention_metrics" ADD CONSTRAINT "growth_intervention_metrics_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_intervention_metrics" ADD CONSTRAINT "growth_intervention_metrics_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "growth_interventions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_topic_insights" ADD CONSTRAINT "growth_topic_insights_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_topic_insights" ADD CONSTRAINT "growth_topic_insights_piece_id_fkey" FOREIGN KEY ("piece_id") REFERENCES "content_pieces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_topic_insights" ADD CONSTRAINT "growth_topic_insights_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "growth_conversation_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
