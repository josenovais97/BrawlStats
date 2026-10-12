-- Every brawler in every sampled Ranked battle, both teams, per day.
--
-- `battle_daily_stats` records one brawler per battle: the sampled player's.
-- But `battle_team_samples` already holds the whole lineup -- the player's two
-- team-mates and the three opponents -- so each Ranked battle is six
-- observations, not one. Measured 2026-10-12: 204,608 distinct Ranked battles
-- in seven days, 1.2 million brawler appearances, against 216,000 rows the
-- tier lists were reading. Same API calls, no new raw storage.
--
-- Built by the roll-up from the raw team samples, de-duplicated per battle
-- (two pool players in one lobby see the same battle). `rank_bracket` is 0
-- when the lobby's rank is unknown, so it can sit in the key.
CREATE TABLE "ranked_lineup_daily" (
    "day" DATE NOT NULL,
    "mode" TEXT NOT NULL,
    "map_name" TEXT NOT NULL,
    "rank_bracket" SMALLINT NOT NULL,
    "brawler_id" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "last_battle_time" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ranked_lineup_daily_pkey" PRIMARY KEY ("day", "mode", "map_name", "rank_bracket", "brawler_id")
);
