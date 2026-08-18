-- Ranked standing per sampled player.
--
-- The game API publishes trophy leaderboards but no Ranked one: there is no
-- endpoint returning the top players by elo. Storing each player's standing as
-- they are sampled is the only way to build that board, so it ranks our pool
-- rather than the world.
ALTER TABLE "sampled_players" ADD COLUMN "ranked_elo" INTEGER;
ALTER TABLE "sampled_players" ADD COLUMN "ranked_rank_name" TEXT;
ALTER TABLE "sampled_players" ADD COLUMN "highest_ranked_elo" INTEGER;
ALTER TABLE "sampled_players" ADD COLUMN "highest_ranked_rank_name" TEXT;

CREATE INDEX "sampled_players_highest_ranked_elo_idx"
  ON "sampled_players" ("highest_ranked_elo");
