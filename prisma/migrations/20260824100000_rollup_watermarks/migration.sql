-- Tracks what each roll-up day was last built from, so a day whose raw rows
-- have not changed is skipped instead of rewritten.
--
-- Rebuilding the trailing days every run is idempotent but not free: on Neon,
-- retained WAL is billed storage, so rewriting identical rows twice a day
-- consumes the plan without changing an answer.

-- CreateTable
CREATE TABLE "rollup_watermarks" (
    "day" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "raw_watermark" TIMESTAMP(3) NOT NULL,
    "folded_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rollup_watermarks_pkey" PRIMARY KEY ("day", "source")
);
