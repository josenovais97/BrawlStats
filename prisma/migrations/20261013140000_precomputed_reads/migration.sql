-- Expensive reads, computed off the request path (scripts/precompute.ts).
--
-- The team-comp reads take 25-50s each (a de-duplicated pass over two weeks of
-- team samples). They were cached for two hours, which still left the first
-- visitor after every expiry and every deploy waiting that long -- the
-- Bubble's Team comp tab among them. A job after each sampler run now writes
-- them here and the pages read the row; a missing or stale row falls back to
-- computing live, exactly as before.
CREATE TABLE "precomputed_reads" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "precomputed_reads_pkey" PRIMARY KEY ("key")
);
