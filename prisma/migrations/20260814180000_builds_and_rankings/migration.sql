-- AlterTable
ALTER TABLE "player_brawler_snapshots" ADD COLUMN     "buffie_gadget" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "buffie_hyper_charge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "buffie_star_power" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gadget_ids" INTEGER[],
ADD COLUMN     "gear_ids" INTEGER[],
ADD COLUMN     "star_power_ids" INTEGER[];

-- CreateTable
CREATE TABLE "brawler_ranking_entries" (
    "id" SERIAL NOT NULL,
    "brawler_id" INTEGER NOT NULL,
    "brawler_name" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'global',
    "rank" INTEGER NOT NULL,
    "player_tag" TEXT NOT NULL,
    "player_name" TEXT NOT NULL,
    "trophies" INTEGER NOT NULL,
    "refreshed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brawler_ranking_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brawler_build_stats" (
    "id" SERIAL NOT NULL,
    "brawler_id" INTEGER NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "item_id" INTEGER NOT NULL,
    "owners" INTEGER NOT NULL,
    "total_owners" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brawler_build_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brawler_ranking_entries_player_tag_idx" ON "brawler_ranking_entries"("player_tag");

-- CreateIndex
CREATE UNIQUE INDEX "brawler_ranking_entries_brawler_id_region_rank_key" ON "brawler_ranking_entries"("brawler_id", "region", "rank");

-- CreateIndex
CREATE INDEX "brawler_build_stats_snapshot_date_idx" ON "brawler_build_stats"("snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "brawler_build_stats_brawler_id_snapshot_date_kind_item_id_key" ON "brawler_build_stats"("brawler_id", "snapshot_date", "kind", "item_id");

