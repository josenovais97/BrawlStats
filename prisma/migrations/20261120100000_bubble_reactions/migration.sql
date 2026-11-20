-- Reactions in the Bubble app's squad feed (1.42): one emoji per player per
-- post, with the reacting player's in-game name. Kept 30 days.
CREATE TABLE IF NOT EXISTS "bubble_reactions" (
    "post" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bubble_reactions_pkey" PRIMARY KEY ("post","tag")
);

CREATE INDEX IF NOT EXISTS "bubble_reactions_subject_created_at_idx" ON "bubble_reactions"("subject", "created_at");
CREATE INDEX IF NOT EXISTS "bubble_reactions_tag_created_at_idx" ON "bubble_reactions"("tag", "created_at");
CREATE INDEX IF NOT EXISTS "bubble_reactions_created_at_idx" ON "bubble_reactions"("created_at");
