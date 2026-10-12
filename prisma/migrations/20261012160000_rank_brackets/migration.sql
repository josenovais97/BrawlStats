-- Ranked brackets for the tier list (see src/lib/rank-brackets.ts).
--
-- `lobby_rank` is the median rank tier (1-22) of the six players in a Ranked
-- battle, read from the battle log at sampling time. Null for every other
-- battle type and for rows sampled before this existed: there is no way to
-- backfill it, since the raw log entry is not kept.
--
-- `rank_bracket` is that tier folded into the four brackets by the roll-up,
-- and is what the tier list filters on. Nullable, so the all-ranks list keeps
-- reading every row exactly as before.
--
-- Both nullable smallints on existing tables: no rewrite, no new retention
-- rule (each inherits its table's), and the daily roll-up grows by at most
-- four rows per existing Ranked row.
ALTER TABLE "battle_samples" ADD COLUMN "lobby_rank" SMALLINT;
ALTER TABLE "battle_daily_stats" ADD COLUMN "rank_bracket" SMALLINT;
