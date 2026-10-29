-- Discord channels that get every free reward (2026-10-29). Set by a server
-- admin with /rewards-feed setup; one channel per server. Only Discord ids:
-- the server, the channel and the admin who turned it on.
CREATE TABLE "discord_reward_feeds" (
    "guild_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "added_by" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sent_at" TIMESTAMP(3),

    CONSTRAINT "discord_reward_feeds_pkey" PRIMARY KEY ("guild_id")
);
