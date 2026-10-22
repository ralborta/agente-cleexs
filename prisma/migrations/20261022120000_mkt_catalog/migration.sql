-- Catálogo de servicios/productos: base de las propuestas del Planificador
CREATE TYPE "MktCatalogKind" AS ENUM ('servicio', 'producto');

CREATE TABLE "mkt_catalog_items" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "kind" "MktCatalogKind" NOT NULL DEFAULT 'servicio',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price_text" TEXT,
    "audience" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mkt_catalog_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mkt_catalog_items_workspace_id_active_created_at_idx" ON "mkt_catalog_items"("workspace_id", "active", "created_at");
ALTER TABLE "mkt_catalog_items" ADD CONSTRAINT "mkt_catalog_items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
