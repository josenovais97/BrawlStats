-- Team composition per sampled 3v3 battle, for matchup and synergy stats.
--
-- Kept apart from "battle_samples" on purpose: that table stores only the
-- sampled player's own row so usage and win rates are not inflated by
-- correlated participants, and nothing here is ever folded into those numbers.
-- This table answers a different question — how a brawler does *against* and
-- *alongside* specific brawlers — and the id arrays are read with unnest().

-- CreateTable
CREATE TABLE "battle_team_samples" (
    "id" SERIAL NOT NULL,
    "battle_key" TEXT NOT NULL,
    "player_tag" TEXT NOT NULL,
    "brawler_id" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "map_name" TEXT,
    "battle_type" TEXT NOT NULL,
    "ally_brawler_ids" INTEGER[],
    "enemy_brawler_ids" INTEGER[],
    "battle_time" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_team_samples_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "battle_team_samples_battle_key_key" ON "battle_team_samples"("battle_key");

-- CreateIndex
CREATE INDEX "battle_team_samples_brawler_id_battle_time_idx" ON "battle_team_samples"("brawler_id", "battle_time");

-- CreateIndex
CREATE INDEX "battle_team_samples_battle_time_idx" ON "battle_team_samples"("battle_time");
