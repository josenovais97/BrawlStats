-- Competitive wins and losses, split out from the all-battle-types totals.
--
-- `player_battle_daily` already carried `competitive_battles` as a count, but
-- wins and decided were across every battle type. That made a Ranked-only
-- within-player estimator impossible: you could see how many competitive
-- battles a player had with a brawler, not how many they won.
--
-- Defaulted to zero rather than nullable. The roll-up rebuilds the days it can
-- still see -- `battle_samples` retains 14 -- and everything older keeps a zero
-- it will never fill. Nullable would say "unknown" more honestly, but every
-- consumer would then need a null branch for rows that are simply out of
-- reach, and a zero-decided row is already excluded by the sample floors.
ALTER TABLE "player_battle_daily"
  ADD COLUMN "competitive_wins" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "competitive_decided" INTEGER NOT NULL DEFAULT 0;
