-- Hypercharge ownership per sampled player brawler.
--
-- The player payload has carried `hyperCharges` all along; we simply were not
-- recording it, which left the brawler pages unable to say how widely a
-- hypercharge is actually unlocked. Backfill is impossible — the API reports
-- only the present — so existing rows keep an empty array and reads treat a
-- brawler with no recorded hypercharge anywhere as "not yet measured" rather
-- than as "nobody owns it".
ALTER TABLE "player_brawler_snapshots"
  ADD COLUMN "hyper_charge_ids" INTEGER[] NOT NULL DEFAULT '{}';
