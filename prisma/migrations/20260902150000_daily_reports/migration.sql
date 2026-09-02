-- One row per day of Daily discoveries. See the DailyReport model for why this
-- table has no retention window: it is the archive, and its inputs are gone.
CREATE TABLE "daily_reports" (
    "day" DATE NOT NULL,
    "payload" JSONB NOT NULL,
    "findings" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("day")
);
