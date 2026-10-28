-- Browser push for new free rewards (2026-10-28). One row per browser that
-- asked to be told; the endpoint and keys are what the browser's push
-- service needs and say nothing about who the person is. Rows are deleted
-- when the push service answers 404/410 (the browser unsubscribed).
CREATE TABLE "push_subscriptions" (
    "id" SERIAL NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sent_at" TIMESTAMP(3),

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
