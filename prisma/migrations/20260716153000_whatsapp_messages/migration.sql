-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "phone_digits" TEXT,
    "direction" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "media_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'received',
    "source" TEXT,
    "external_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_messages_chat_id_created_at_idx" ON "whatsapp_messages"("chat_id", "created_at");

-- CreateIndex
CREATE INDEX "whatsapp_messages_phone_digits_idx" ON "whatsapp_messages"("phone_digits");
