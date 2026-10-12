-- Which Brawl Stars account a Discord member linked with /link.
--
-- One row per Discord user, replaced on re-link and deleted by /unlink, so the
-- table is bounded by the server's membership rather than growing with time --
-- the bound AGENTS.md asks every table to have. Nothing here is sensitive: a
-- player tag is public, and the Discord id is what the bot is sent anyway.
CREATE TABLE "discord_links" (
  "discord_user_id" TEXT NOT NULL,
  "player_tag" TEXT NOT NULL,
  "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "discord_links_pkey" PRIMARY KEY ("discord_user_id")
);
