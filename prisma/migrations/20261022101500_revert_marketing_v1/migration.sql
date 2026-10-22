-- Revert de la v1 de Cleexs Marketing (hub oscuro dentro del workspace).
-- El módulo se reconstruye como producto standalone; estas tablas se recrean con el nuevo diseño.
DROP TABLE IF EXISTS "marketing_email_drafts";
DROP TABLE IF EXISTS "marketing_offers";
DROP TABLE IF EXISTS "marketing_campaigns";
DROP TYPE IF EXISTS "MarketingEmailStatus";
DROP TYPE IF EXISTS "MarketingOfferStatus";
DROP TYPE IF EXISTS "MarketingCampaignStatus";
DELETE FROM "agents" WHERE "slug" IN ('marketing', 'marketing-email', 'marketing-offers');
