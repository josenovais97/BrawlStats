-- Bans and combat stats of Ranked battles (2026-11-25). The battle log carries
-- both since November and nothing kept them; a log holds 25 games, so every
-- day not saved is lost. Raw on the team sample, folded per day beside the
-- lineups. Nullable: adding them rewrites nothing.
ALTER TABLE "battle_team_samples" ADD COLUMN "ban_ids" SMALLINT[];
ALTER TABLE "battle_team_samples" ADD COLUMN "lineup_stats" INTEGER[];

-- brawler_id 0 holds the number of battles whose bans were recorded.
CREATE TABLE "ranked_ban_daily" (
    "day" DATE NOT NULL,
    "mode" TEXT NOT NULL,
    "map_name" TEXT NOT NULL,
    "rank_bracket" SMALLINT NOT NULL,
    "brawler_id" INTEGER NOT NULL,
    "battles" INTEGER NOT NULL,
    CONSTRAINT "ranked_ban_daily_pkey" PRIMARY KEY ("day", "mode", "map_name", "rank_bracket", "brawler_id")
);

CREATE TABLE "ranked_stat_daily" (
    "day" DATE NOT NULL,
    "mode" TEXT NOT NULL,
    "rank_bracket" SMALLINT NOT NULL,
    "brawler_id" INTEGER NOT NULL,
    "games" INTEGER NOT NULL,
    "kills" INTEGER NOT NULL,
    "deaths" INTEGER NOT NULL,
    "deathless" INTEGER NOT NULL,
    "stars" INTEGER NOT NULL,
    "damage" BIGINT NOT NULL,
    "healing" BIGINT NOT NULL,
    "seconds" BIGINT NOT NULL,
    CONSTRAINT "ranked_stat_daily_pkey" PRIMARY KEY ("day", "mode", "rank_bracket", "brawler_id")
);
