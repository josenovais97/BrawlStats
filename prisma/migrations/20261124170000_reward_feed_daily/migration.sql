-- Whether a server's reward feed also gets the store's free daily reward
-- (2026-11-24). On unless the admin turns it off in /rewards-feed setup.
ALTER TABLE "discord_reward_feeds" ADD COLUMN IF NOT EXISTS "daily" BOOLEAN NOT NULL DEFAULT true;
