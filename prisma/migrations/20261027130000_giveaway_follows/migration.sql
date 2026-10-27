-- Giveaway follow points (2026-10-27): +1 each for following on Instagram
-- and TikTok and subscribing on YouTube, on the entrant's word -- no
-- platform lets anyone check who follows an account. YouTube's was the
-- owner's call after being told YouTube treats rewarded subscriptions as
-- fake engagement.
ALTER TABLE "giveaway_entries" ADD COLUMN "followed_instagram" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "giveaway_entries" ADD COLUMN "followed_tiktok" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "giveaway_entries" ADD COLUMN "followed_youtube" BOOLEAN NOT NULL DEFAULT false;
