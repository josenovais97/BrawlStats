-- What a Ranked win and loss are worth in elo, per rank (2026-11-06).
-- sampled_players.ranked_elo_at: when ranked_elo was read, so the next daily
-- profile read can pair the elo change with the Ranked games in between.
-- ranked_wins/ranked_losses: Ranked results seen in battle logs since then.
ALTER TABLE "sampled_players" ADD COLUMN "ranked_elo_at" TIMESTAMP(3),
    ADD COLUMN "ranked_wins" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "ranked_losses" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ranked_elo_rates" (
    "day" DATE NOT NULL,
    "rank" TEXT NOT NULL,
    "n" INTEGER NOT NULL,
    "sww" DOUBLE PRECISION NOT NULL,
    "swl" DOUBLE PRECISION NOT NULL,
    "sll" DOUBLE PRECISION NOT NULL,
    "swy" DOUBLE PRECISION NOT NULL,
    "sly" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ranked_elo_rates_pkey" PRIMARY KEY ("day","rank")
);
