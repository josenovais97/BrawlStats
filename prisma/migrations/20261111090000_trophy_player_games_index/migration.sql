-- The profile's Trophies tab (2026-11-11) reads one player's trophy games
-- (battle_type 'ranked' is the trophy ladder) with their trophy change, per
-- profile view. Without this it is a scan of the whole table. Partial, so
-- the index covers the trophy rows only; Prisma's schema cannot describe a
-- partial index (see the note on BattleSample).
CREATE INDEX IF NOT EXISTS "battle_samples_trophy_player_idx"
  ON "battle_samples" ("player_tag", "battle_time")
  WHERE "battle_type" = 'ranked';
