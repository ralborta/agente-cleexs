-- CreateEnum
CREATE TYPE "CreativeRequestStatus" AS ENUM ('queued', 'planning', 'rendering', 'preview', 'approved', 'blocked', 'failed');

-- CreateEnum
CREATE TYPE "DistributionChannel" AS ENUM ('linkedin');

-- CreateEnum
CREATE TYPE "DistributionPostStatus" AS ENUM ('draft', 'preview', 'published', 'failed');

-- CreateTable
CREATE TABLE "creative_templates" (
    "id" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "deprecated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creative_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_requests" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "piece_id" TEXT NOT NULL,
    "publication_id" TEXT,
    "channel" "DistributionChannel" NOT NULL DEFAULT 'linkedin',
    "status" "CreativeRequestStatus" NOT NULL DEFAULT 'queued',
    "input" JSONB,
    "planner_output" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_assets" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "template_version" INTEGER NOT NULL,
    "file_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL DEFAULT 'image/png',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "payload" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creative_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distribution_posts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "channel" "DistributionChannel" NOT NULL DEFAULT 'linkedin',
    "status" "DistributionPostStatus" NOT NULL DEFAULT 'draft',
    "external_post_id" TEXT,
    "caption" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distribution_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_performances" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "post_id" TEXT,
    "template_key" TEXT NOT NULL,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "reactions" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "ctr" DOUBLE PRECISION,
    "engagements" INTEGER,
    "collected_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creative_performances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "creative_templates_category_idx" ON "creative_templates"("category");

-- CreateIndex
CREATE UNIQUE INDEX "creative_templates_template_key_version_key" ON "creative_templates"("template_key", "version");

-- CreateIndex
CREATE INDEX "creative_requests_workspace_id_status_created_at_idx" ON "creative_requests"("workspace_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "creative_requests_piece_id_idx" ON "creative_requests"("piece_id");

-- CreateIndex
CREATE INDEX "creative_assets_workspace_id_created_at_idx" ON "creative_assets"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "creative_assets_request_id_idx" ON "creative_assets"("request_id");

-- CreateIndex
CREATE INDEX "creative_assets_template_key_template_version_idx" ON "creative_assets"("template_key", "template_version");

-- CreateIndex
CREATE INDEX "distribution_posts_workspace_id_channel_status_idx" ON "distribution_posts"("workspace_id", "channel", "status");

-- CreateIndex
CREATE INDEX "distribution_posts_asset_id_idx" ON "distribution_posts"("asset_id");

-- CreateIndex
CREATE INDEX "creative_performances_workspace_id_template_key_collected_at_idx" ON "creative_performances"("workspace_id", "template_key", "collected_at");

-- CreateIndex
CREATE INDEX "creative_performances_asset_id_idx" ON "creative_performances"("asset_id");

-- AddForeignKey
ALTER TABLE "creative_requests" ADD CONSTRAINT "creative_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_requests" ADD CONSTRAINT "creative_requests_piece_id_fkey" FOREIGN KEY ("piece_id") REFERENCES "content_pieces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_requests" ADD CONSTRAINT "creative_requests_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_assets" ADD CONSTRAINT "creative_assets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_assets" ADD CONSTRAINT "creative_assets_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "creative_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_assets" ADD CONSTRAINT "creative_assets_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "creative_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution_posts" ADD CONSTRAINT "distribution_posts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution_posts" ADD CONSTRAINT "distribution_posts_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "creative_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution_posts" ADD CONSTRAINT "distribution_posts_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "creative_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_performances" ADD CONSTRAINT "creative_performances_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_performances" ADD CONSTRAINT "creative_performances_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "creative_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_performances" ADD CONSTRAINT "creative_performances_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "distribution_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
