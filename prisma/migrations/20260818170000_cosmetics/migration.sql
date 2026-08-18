-- Records the cosmetics the API does expose: the profile icon on the account,
-- and the skin equipped on each brawler.
--
-- Neither can be read as "owned" from a single response — the API reports only
-- what is currently equipped. Recording them per sample turns that into a
-- dataset: which skins people actually use, and which icons.
--
-- All three columns are nullable and cannot be backfilled; rows written before
-- this migration have no cosmetic information at all.
ALTER TABLE "sampled_players" ADD COLUMN "icon_id" INTEGER;

ALTER TABLE "player_brawler_snapshots" ADD COLUMN "skin_id" INTEGER;
ALTER TABLE "player_brawler_snapshots" ADD COLUMN "skin_name" TEXT;

CREATE INDEX "player_brawler_snapshots_snapshot_date_skin_id_idx"
  ON "player_brawler_snapshots" ("snapshot_date", "skin_id");
