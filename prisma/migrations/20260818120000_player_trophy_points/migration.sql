-- Trophy history for any player who has ever been looked up.
--
-- `sampled_players.trophies` is overwritten on every lookup, so nothing on the
-- site could show a player's trophies moving over time. One row per player per
-- day, upserted, keeps that history without letting a refreshed page write
-- unbounded rows.
CREATE TABLE "player_trophy_points" (
    "id" SERIAL NOT NULL,
    "player_tag" TEXT NOT NULL,
    "recorded_on" DATE NOT NULL,
    "trophies" INTEGER NOT NULL,
    "highest_trophies" INTEGER NOT NULL,
    "brawler_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_trophy_points_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "player_trophy_points_player_tag_recorded_on_key"
  ON "player_trophy_points" ("player_tag", "recorded_on");

CREATE INDEX "player_trophy_points_player_tag_recorded_on_idx"
  ON "player_trophy_points" ("player_tag", "recorded_on");
