-- Club activity (2026-10-16): one row per member per club per day, so the
-- club page can show who gained trophies this week and who went quiet. The
-- game API has no club history. Clubs are tracked when their page is opened
-- and refreshed daily by the sampler while viewed in the last 30 days;
-- snapshots older than 60 days are pruned.
CREATE TABLE "club_member_snapshots" (
    "club_tag" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "player_tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trophies" INTEGER NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "club_member_snapshots_pkey" PRIMARY KEY ("club_tag","day","player_tag")
);

CREATE INDEX "club_member_snapshots_day_idx" ON "club_member_snapshots"("day");

CREATE TABLE "tracked_clubs" (
    "club_tag" TEXT NOT NULL,
    "last_viewed_at" TIMESTAMP(3) NOT NULL,
    "last_snapshot_on" DATE,

    CONSTRAINT "tracked_clubs_pkey" PRIMARY KEY ("club_tag")
);

CREATE INDEX "tracked_clubs_last_viewed_at_idx" ON "tracked_clubs"("last_viewed_at");
