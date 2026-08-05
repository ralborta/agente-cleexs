-- CreateEnum
CREATE TYPE "KeywordQuestionStatus" AS ENUM ('idea', 'queued', 'in_progress', 'covered', 'discarded');

-- CreateTable
CREATE TABLE "keyword_questions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "cluster" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "stage" "FunnelStage" NOT NULL DEFAULT 'tofu',
    "intent" TEXT,
    "intent_label" TEXT,
    "business_fit" INTEGER NOT NULL DEFAULT 50,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "KeywordQuestionStatus" NOT NULL DEFAULT 'idea',
    "source" TEXT NOT NULL DEFAULT 'llm',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keyword_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "keyword_questions_workspace_id_status_idx" ON "keyword_questions"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "keyword_questions_workspace_id_cluster_idx" ON "keyword_questions"("workspace_id", "cluster");

-- CreateIndex
CREATE INDEX "keyword_questions_workspace_id_priority_idx" ON "keyword_questions"("workspace_id", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_questions_workspace_id_question_key" ON "keyword_questions"("workspace_id", "question");

-- AddForeignKey
ALTER TABLE "keyword_questions" ADD CONSTRAINT "keyword_questions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
