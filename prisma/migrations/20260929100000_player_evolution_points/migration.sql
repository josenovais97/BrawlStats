-- Three more readings on the daily player point, for the evolution timeline.
--
-- Added to `player_trophy_points` rather than to a new table on purpose. The
-- key is already (player_tag, recorded_on), the upsert already collapses a
-- refreshed page into one row a day, and the table already has a retention
-- bound -- it prunes at 120 days while the charts read 90. A separate table
-- would mean a second prune rule that someone has to remember to write, and
-- AGENTS.md is explicit that every table needs a bound. Reusing this one
-- inherits it.
--
-- All three are nullable because every row written before today has none, and
-- there is no way to backfill them: the values come from a live lookup, and
-- `player_brawler_snapshots` is a rotating sample rather than a census, so it
-- cannot be mined for an individual's past.
--
-- The table's name is now narrower than its contents. Renaming it would mean
-- rewriting every caller for no behavioural gain, so it stays.

-- Ranked Elo at the time. `sampled_players` already carries this, but that row
-- is overwritten on every visit, so it can only answer "what now" and never
-- "what changed".
ALTER TABLE "player_trophy_points" ADD COLUMN "ranked_elo" INTEGER;

-- Brawlers at power 11. The roster's depth, as opposed to its size.
ALTER TABLE "player_trophy_points" ADD COLUMN "power_eleven_count" INTEGER;

-- Share of the current S and A tier the player can actually field, 0-1.
ALTER TABLE "player_trophy_points" ADD COLUMN "meta_coverage" DOUBLE PRECISION;
