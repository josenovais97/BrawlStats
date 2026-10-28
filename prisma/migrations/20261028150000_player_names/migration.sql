-- Name search (2026-10-28). Every profile opened on the site, so a player who
-- looked themselves up by tag once can be found by name afterwards. Profile
-- lookups only join sampled_players within an hourly allowance (sampling
-- costs API calls); this costs one small row and none. Pruned a year after
-- the profile was last opened (pruneOldSamples).
CREATE TABLE "player_names" (
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trophies" INTEGER,
    "icon_id" INTEGER,
    "seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_names_pkey" PRIMARY KEY ("tag")
);

CREATE INDEX "player_names_seen_at_idx" ON "player_names"("seen_at");
