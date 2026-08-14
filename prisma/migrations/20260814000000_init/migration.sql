-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "sampled_players" (
    "tag" TEXT NOT NULL,
    "name" TEXT,
    "trophies" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'ranking',
    "last_sampled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sampled_players_pkey" PRIMARY KEY ("tag")
);

-- CreateTable
CREATE TABLE "player_brawler_snapshots" (
    "id" SERIAL NOT NULL,
    "player_tag" TEXT NOT NULL,
    "brawler_id" INTEGER NOT NULL,
    "brawler_name" TEXT NOT NULL,
    "trophies" INTEGER NOT NULL,
    "highest_trophies" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "power" INTEGER NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_brawler_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_samples" (
    "id" SERIAL NOT NULL,
    "battle_key" TEXT NOT NULL,
    "player_tag" TEXT NOT NULL,
    "brawler_id" INTEGER NOT NULL,
    "brawler_name" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "rank" INTEGER,
    "mode" TEXT NOT NULL,
    "battle_type" TEXT NOT NULL,
    "trophy_change" INTEGER,
    "battle_time" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brawler_stats" (
    "id" SERIAL NOT NULL,
    "brawler_id" INTEGER NOT NULL,
    "brawler_name" TEXT NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "win_rate" DOUBLE PRECISION,
    "baseline_win_rate" DOUBLE PRECISION,
    "usage_rate" DOUBLE PRECISION,
    "avg_trophies" DOUBLE PRECISION,
    "avg_rank" DOUBLE PRECISION,
    "sample_size" INTEGER NOT NULL DEFAULT 0,
    "decided_sample_size" INTEGER NOT NULL DEFAULT 0,
    "owner_sample_size" INTEGER NOT NULL DEFAULT 0,
    "window_days" INTEGER NOT NULL DEFAULT 7,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brawler_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aggregation_runs" (
    "id" SERIAL NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "players_sampled" INTEGER NOT NULL DEFAULT 0,
    "battles_recorded" INTEGER NOT NULL DEFAULT 0,
    "brawlers_updated" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "notes" TEXT,

    CONSTRAINT "aggregation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sampled_players_last_sampled_at_idx" ON "sampled_players"("last_sampled_at");

-- CreateIndex
CREATE INDEX "player_brawler_snapshots_snapshot_date_brawler_id_idx" ON "player_brawler_snapshots"("snapshot_date", "brawler_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_brawler_snapshots_player_tag_brawler_id_snapshot_dat_key" ON "player_brawler_snapshots"("player_tag", "brawler_id", "snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "battle_samples_battle_key_key" ON "battle_samples"("battle_key");

-- CreateIndex
CREATE INDEX "battle_samples_battle_time_idx" ON "battle_samples"("battle_time");

-- CreateIndex
CREATE INDEX "battle_samples_brawler_id_battle_time_idx" ON "battle_samples"("brawler_id", "battle_time");

-- CreateIndex
CREATE INDEX "brawler_stats_snapshot_date_idx" ON "brawler_stats"("snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "brawler_stats_brawler_id_snapshot_date_key" ON "brawler_stats"("brawler_id", "snapshot_date");

