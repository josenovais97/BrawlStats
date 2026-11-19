-- Friend invites from the Bubble app (1.42): a code per inviting tag, and
-- who opened it in the app, so both players land on each other's ladder.
CREATE TABLE IF NOT EXISTS "bubble_invites" (
    "code" TEXT NOT NULL,
    "inviter" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bubble_invites_pkey" PRIMARY KEY ("code")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bubble_invites_inviter_key" ON "bubble_invites"("inviter");

CREATE TABLE IF NOT EXISTS "bubble_invite_accepts" (
    "code" TEXT NOT NULL,
    "invitee" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bubble_invite_accepts_pkey" PRIMARY KEY ("code","invitee")
);

ALTER TABLE "bubble_invite_accepts" ADD CONSTRAINT "bubble_invite_accepts_code_fkey" FOREIGN KEY ("code") REFERENCES "bubble_invites"("code") ON DELETE CASCADE ON UPDATE CASCADE;
