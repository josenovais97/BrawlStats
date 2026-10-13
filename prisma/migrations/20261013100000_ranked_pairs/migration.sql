-- Ranked matchups per rank bracket, for the rank-aware draft helper.
--
-- `brawler_pair_daily` holds every team battle's matchups for all ranks and
-- modes together. This is the Ranked slice split by the lobby's bracket
-- (1-4; battles of unknown rank are left out), in one row per pair and side
-- with wins and decided side by side -- the only shape the draft reads --
-- so a bracket costs one row per pairing rather than one per result.
CREATE TABLE "ranked_pair_daily" (
    "day" DATE NOT NULL,
    "rank_bracket" SMALLINT NOT NULL,
    "brawler_id" INTEGER NOT NULL,
    "other_brawler_id" INTEGER NOT NULL,
    "side" TEXT NOT NULL,
    "wins" INTEGER NOT NULL,
    "decided" INTEGER NOT NULL,

    CONSTRAINT "ranked_pair_daily_pkey" PRIMARY KEY ("day", "rank_bracket", "brawler_id", "other_brawler_id", "side")
);
