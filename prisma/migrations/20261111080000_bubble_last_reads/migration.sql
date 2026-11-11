-- The Bubble app's last good roster and rank per tag (2026-11-11), so a
-- Supercell maintenance no longer reads as "no account with that tag".
CREATE TABLE IF NOT EXISTS "bubble_last_reads" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bubble_last_reads_pkey" PRIMARY KEY ("key")
);
