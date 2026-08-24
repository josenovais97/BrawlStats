-- Promote the natural key to the primary key on the three roll-ups whose
-- columns are all NOT NULL.
--
-- Each carried a surrogate `id` plus a unique constraint over the same columns
-- the roll-up is grained by, so every row paid for two indexes describing it
-- identically. Nothing references these rows: they are derived, rebuilt per
-- day, and read only in aggregate. On `brawler_pair_daily` — the largest of
-- them — indexes cost more than the data itself (18.3 MB against 12.0 MB).
--
-- The standalone `day` indexes go too: each new primary key leads with `day`,
-- so range scans on it use the primary key instead.
--
-- `battle_daily_stats` keeps its surrogate id, because `map_name` and
-- `event_id` are nullable and cannot take part in a primary key.

-- player_battle_daily
DROP INDEX "player_battle_daily_day_idx";
DROP INDEX "player_battle_daily_day_player_tag_brawler_id_key";
ALTER TABLE "player_battle_daily" DROP CONSTRAINT "player_battle_daily_pkey";
ALTER TABLE "player_battle_daily" DROP COLUMN "id";
ALTER TABLE "player_battle_daily"
  ADD CONSTRAINT "player_battle_daily_pkey" PRIMARY KEY ("day", "player_tag", "brawler_id");

-- brawler_pair_daily
DROP INDEX "brawler_pair_daily_day_idx";
DROP INDEX "brawler_pair_daily_day_brawler_id_other_brawler_id_side_res_key";
ALTER TABLE "brawler_pair_daily" DROP CONSTRAINT "brawler_pair_daily_pkey";
ALTER TABLE "brawler_pair_daily" DROP COLUMN "id";
ALTER TABLE "brawler_pair_daily"
  ADD CONSTRAINT "brawler_pair_daily_pkey" PRIMARY KEY ("day", "brawler_id", "other_brawler_id", "side", "result");

-- brawler_team_daily
DROP INDEX "brawler_team_daily_day_idx";
DROP INDEX "brawler_team_daily_day_brawler_id_key";
ALTER TABLE "brawler_team_daily" DROP CONSTRAINT "brawler_team_daily_pkey";
ALTER TABLE "brawler_team_daily" DROP COLUMN "id";
ALTER TABLE "brawler_team_daily"
  ADD CONSTRAINT "brawler_team_daily_pkey" PRIMARY KEY ("day", "brawler_id");
