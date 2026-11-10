-- The profile's Ranked tab (2026-11-10) reads one player's Ranked games from
-- the raw table on every profile view. Without this that is a scan of the
-- whole table (~2 GB). Partial: Ranked rows only, about half the table, so
-- the index stays near 150 MB. Prisma's schema cannot describe a partial
-- index, so it lives here only (see the note on BattleTeamSample).
CREATE INDEX IF NOT EXISTS "battle_team_samples_ranked_player_idx"
  ON "battle_team_samples" ("player_tag", "battle_time")
  WHERE "battle_type" IN ('soloRanked', 'teamRanked');
