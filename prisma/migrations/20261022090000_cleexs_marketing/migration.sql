-- Cleexs Marketing: campañas, ofertas y borradores de email (sin envío real en v1)
CREATE TYPE "MarketingCampaignStatus" AS ENUM ('proposed', 'approved', 'active', 'finished', 'archived');
CREATE TYPE "MarketingOfferStatus" AS ENUM ('draft', 'approved', 'active', 'archived');
CREATE TYPE "MarketingEmailStatus" AS ENUM ('draft', 'approved', 'discarded');

CREATE TABLE "marketing_campaigns" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "audience" TEXT,
    "source_type" TEXT NOT NULL DEFAULT 'manual',
    "source_label" TEXT,
    "source_ref_id" TEXT,
    "status" "MarketingCampaignStatus" NOT NULL DEFAULT 'proposed',
    "agent_slug" TEXT NOT NULL DEFAULT 'marketing',
    "brief" JSONB,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing_offers" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price_text" TEXT,
    "discount_text" TEXT,
    "terms" TEXT,
    "channels" JSONB,
    "status" "MarketingOfferStatus" NOT NULL DEFAULT 'draft',
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_offers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing_email_drafts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "offer_id" TEXT,
    "segment" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "preheader" TEXT,
    "body" TEXT NOT NULL,
    "cta_text" TEXT,
    "cta_url" TEXT,
    "status" "MarketingEmailStatus" NOT NULL DEFAULT 'draft',
    "source" TEXT NOT NULL DEFAULT 'template',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_email_drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketing_campaigns_workspace_id_status_created_at_idx" ON "marketing_campaigns"("workspace_id", "status", "created_at");
CREATE INDEX "marketing_offers_workspace_id_status_created_at_idx" ON "marketing_offers"("workspace_id", "status", "created_at");
CREATE INDEX "marketing_offers_campaign_id_idx" ON "marketing_offers"("campaign_id");
CREATE INDEX "marketing_email_drafts_workspace_id_status_created_at_idx" ON "marketing_email_drafts"("workspace_id", "status", "created_at");
CREATE INDEX "marketing_email_drafts_campaign_id_idx" ON "marketing_email_drafts"("campaign_id");

ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_offers" ADD CONSTRAINT "marketing_offers_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_offers" ADD CONSTRAINT "marketing_offers_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marketing_email_drafts" ADD CONSTRAINT "marketing_email_drafts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_email_drafts" ADD CONSTRAINT "marketing_email_drafts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marketing_email_drafts" ADD CONSTRAINT "marketing_email_drafts_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "marketing_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Agentes del módulo Cleexs Marketing (idempotente; el seed también los crea)
INSERT INTO "agents" ("id", "slug", "name", "description", "created_at") VALUES
  (gen_random_uuid()::text, 'marketing', 'Planificador de campañas', 'Cleexs Marketing: propone campañas y organiza el calendario a partir de las oportunidades detectadas.', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'marketing-email', 'Campañas de email', 'Cleexs Marketing: redacta secuencias de email en borrador. El envío requiere el dominio del cliente conectado.', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'marketing-offers', 'Ofertas y promociones', 'Cleexs Marketing: prepara promociones con precio, condiciones y vigencia aprobados por la empresa.', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
