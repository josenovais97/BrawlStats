-- Records the map each battle was played on, so brawler win rates can be
-- broken down per map (the ranked map pages).
--
-- Both columns are nullable: rows sampled before this migration have no map
-- information and can never be backfilled, because the battle log only covers
-- roughly the last 25 matches.
ALTER TABLE "battle_samples" ADD COLUMN "map_name" TEXT;
ALTER TABLE "battle_samples" ADD COLUMN "event_id" INTEGER;

CREATE INDEX "battle_samples_battle_type_map_name_battle_time_idx"
  ON "battle_samples" ("battle_type", "map_name", "battle_time");
