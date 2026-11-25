-- A player's Ranked combat numbers per day and brawler (2026-11-25), so a
-- profile and a Season Wrapped can show K/D for the whole season: the raw
-- battles are kept about two weeks, a season is four.
CREATE TABLE "player_ranked_combat_daily" (
    "day" DATE NOT NULL,
    "player_tag" TEXT NOT NULL,
    "brawler_id" INTEGER NOT NULL,
    "games" SMALLINT NOT NULL,
    "kills" INTEGER NOT NULL,
    "deaths" INTEGER NOT NULL,
    "deathless" SMALLINT NOT NULL,
    "stars" SMALLINT NOT NULL,
    "damage" INTEGER NOT NULL,
    "healing" INTEGER NOT NULL,
    "seconds" INTEGER NOT NULL,
    CONSTRAINT "player_ranked_combat_daily_pkey" PRIMARY KEY ("day", "player_tag", "brawler_id")
);
