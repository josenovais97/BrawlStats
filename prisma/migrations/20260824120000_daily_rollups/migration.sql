-- Daily roll-ups of the two raw observation tables.
--
-- Every read of `battle_samples` and `battle_team_samples` is a GROUP BY or a
-- COUNT; none opens an individual row. These tables store one row per distinct
-- combination per day instead of one per battle, so the 21-day windows the
-- site reads survive while the raw tables shrink to a few days. See the model
-- comments in schema.prisma for the measurements behind this.

-- CreateTable
CREATE TABLE "battle_daily_stats" (
    "id" SERIAL NOT NULL,
    "day" DATE NOT NULL,
    "battle_type" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "map_name" TEXT,
    "event_id" INTEGER,
    "brawler_id" INTEGER NOT NULL,
    "brawler_name" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "rank" INTEGER,
    "battles" INTEGER NOT NULL,
    "last_battle_time" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "battle_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_battle_daily" (
    "id" SERIAL NOT NULL,
    "day" DATE NOT NULL,
    "player_tag" TEXT NOT NULL,
    "brawler_id" INTEGER NOT NULL,
    "battles" INTEGER NOT NULL,
    "competitive_battles" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "decided" INTEGER NOT NULL,

    CONSTRAINT "player_battle_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brawler_pair_daily" (
    "id" SERIAL NOT NULL,
    "day" DATE NOT NULL,
    "brawler_id" INTEGER NOT NULL,
    "other_brawler_id" INTEGER NOT NULL,
    "side" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "battles" INTEGER NOT NULL,

    CONSTRAINT "brawler_pair_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brawler_team_daily" (
    "id" SERIAL NOT NULL,
    "day" DATE NOT NULL,
    "brawler_id" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "decided" INTEGER NOT NULL,

    CONSTRAINT "brawler_team_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "battle_daily_stats_day_battle_type_idx" ON "battle_daily_stats"("day", "battle_type");

-- CreateIndex
CREATE INDEX "player_battle_daily_day_idx" ON "player_battle_daily"("day");

-- CreateIndex
CREATE INDEX "player_battle_daily_brawler_id_day_idx" ON "player_battle_daily"("brawler_id", "day");

-- CreateIndex
CREATE UNIQUE INDEX "player_battle_daily_day_player_tag_brawler_id_key" ON "player_battle_daily"("day", "player_tag", "brawler_id");

-- CreateIndex
CREATE INDEX "brawler_pair_daily_day_idx" ON "brawler_pair_daily"("day");

-- CreateIndex
CREATE INDEX "brawler_pair_daily_brawler_id_day_idx" ON "brawler_pair_daily"("brawler_id", "day");

-- CreateIndex
CREATE UNIQUE INDEX "brawler_pair_daily_day_brawler_id_other_brawler_id_side_res_key" ON "brawler_pair_daily"("day", "brawler_id", "other_brawler_id", "side", "result");

-- CreateIndex
CREATE INDEX "brawler_team_daily_day_idx" ON "brawler_team_daily"("day");

-- CreateIndex
CREATE UNIQUE INDEX "brawler_team_daily_day_brawler_id_key" ON "brawler_team_daily"("day", "brawler_id");
