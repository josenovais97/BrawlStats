-- Daily challenge tally (2026-10-23): how many players finished each of the
-- day's puzzles in how many guesses, for the "X% solved today" line. Counts
-- only, nothing that identifies a player. 0 guesses is a lost picture puzzle.
CREATE TABLE "daily_challenge_tally" (
    "day" DATE NOT NULL,
    "mode" TEXT NOT NULL,
    "guesses" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_challenge_tally_pkey" PRIMARY KEY ("day","mode","guesses")
);
