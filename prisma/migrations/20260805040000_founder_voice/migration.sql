-- CreateEnum
CREATE TYPE "FounderVoiceNoteStatus" AS ENUM ('available', 'used', 'discarded');

-- CreateTable
CREATE TABLE "founder_voice_notes" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "topic" TEXT,
    "quote" TEXT NOT NULL,
    "author_label" TEXT NOT NULL DEFAULT 'Founder',
    "status" "FounderVoiceNoteStatus" NOT NULL DEFAULT 'available',
    "used_in_piece_id" TEXT,
    "invite_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "founder_voice_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "founder_voice_invites" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "topic" TEXT,
    "mission_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "founder_voice_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "founder_voice_notes_workspace_id_status_idx" ON "founder_voice_notes"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "founder_voice_notes_workspace_id_topic_idx" ON "founder_voice_notes"("workspace_id", "topic");

-- CreateIndex
CREATE UNIQUE INDEX "founder_voice_invites_token_key" ON "founder_voice_invites"("token");

-- CreateIndex
CREATE INDEX "founder_voice_invites_workspace_id_expires_at_idx" ON "founder_voice_invites"("workspace_id", "expires_at");

-- AddForeignKey
ALTER TABLE "founder_voice_notes" ADD CONSTRAINT "founder_voice_notes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "founder_voice_notes" ADD CONSTRAINT "founder_voice_notes_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "founder_voice_invites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "founder_voice_invites" ADD CONSTRAINT "founder_voice_invites_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
