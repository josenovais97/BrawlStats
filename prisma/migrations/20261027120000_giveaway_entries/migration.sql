-- The first BrawlZone giveaway (2026-10-27): one row per entrant. The email
-- is only for telling the winner; it is shown to nobody but the owner and is
-- deleted after the prize is delivered (see the giveaway rules). `ip_hash`
-- is a salted hash, kept only to stop one network minting fake referrals.
CREATE TABLE "giveaway_entries" (
    "id" SERIAL NOT NULL,
    "giveaway" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "player_tag" TEXT NOT NULL,
    "player_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "referred_by" TEXT,
    "discord_user_id" TEXT,
    "ip_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "giveaway_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "giveaway_entries_code_key" ON "giveaway_entries"("code");
CREATE UNIQUE INDEX "giveaway_entries_giveaway_player_tag_key" ON "giveaway_entries"("giveaway", "player_tag");
CREATE UNIQUE INDEX "giveaway_entries_giveaway_email_key" ON "giveaway_entries"("giveaway", "email");
CREATE UNIQUE INDEX "giveaway_entries_giveaway_discord_user_id_key" ON "giveaway_entries"("giveaway", "discord_user_id");
CREATE INDEX "giveaway_entries_referred_by_idx" ON "giveaway_entries"("referred_by");
CREATE INDEX "giveaway_entries_ip_hash_created_at_idx" ON "giveaway_entries"("ip_hash", "created_at");
