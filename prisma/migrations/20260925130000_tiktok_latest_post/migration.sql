-- The newest post on the site's own TikTok account. One row, always id 1.
CREATE TABLE "tiktok_latest_post" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "post_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "cover_url" TEXT,
    "posted_at" TIMESTAMP(3),
    "refreshed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_latest_post_pkey" PRIMARY KEY ("id")
);
