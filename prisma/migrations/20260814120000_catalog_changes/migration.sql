-- CreateTable
CREATE TABLE "brawler_catalog_entries" (
    "id" SERIAL NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "brawler_id" INTEGER NOT NULL,
    "brawler_name" TEXT NOT NULL,
    "star_power_ids" INTEGER[],
    "gadget_ids" INTEGER[],
    "gear_ids" INTEGER[],
    "hyper_charge_ids" INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brawler_catalog_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_changes" (
    "id" SERIAL NOT NULL,
    "detected_on" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "brawler_id" INTEGER NOT NULL,
    "brawler_name" TEXT NOT NULL,
    "item_id" INTEGER,
    "item_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brawler_catalog_entries_snapshot_date_idx" ON "brawler_catalog_entries"("snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "brawler_catalog_entries_brawler_id_snapshot_date_key" ON "brawler_catalog_entries"("brawler_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "catalog_changes_detected_on_idx" ON "catalog_changes"("detected_on");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_changes_detected_on_kind_brawler_id_item_id_key" ON "catalog_changes"("detected_on", "kind", "brawler_id", "item_id");

