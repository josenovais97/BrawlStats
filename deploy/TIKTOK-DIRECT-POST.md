# Switching TikTok to Direct Post

What to do **if and when** the Content Posting API audit passes. Until then
nothing here applies and the daily job keeps working as it is.

Written 2026-09-25, the day the app was submitted for review. The integration
is running on **sandbox** credentials (`sbaweldv64at4v2qpp`) with
`POST_MODE=MEDIA_UPLOAD`: the job delivers the day's carousel to the account's
TikTok inbox and a human publishes it from TikTok's own editor. That works
indefinitely and needs no audit — the audit buys exactly one thing, which is
removing the human.

## What changes, and what that costs

Today a bad post is a draft nobody publishes. After this it is a public post
that went out at 09:10 without anyone looking at it. Everything below that
looks like paranoia is about that one change.

## Before you start

- [ ] TikTok has actually approved the app. Check the portal, not an email —
      "submitted" and "approved" look similar in a notification.
- [ ] You have the **production** client key and secret to hand. Sandbox
      credentials do not become production credentials when the audit passes;
      they stay a sandbox.
- [ ] `brawlzone.net` is verified for the **production** app. It already was
      (DNS TXT `tiktok-developers-site-verification=2Q9Db1…`) — confirm the
      record is still on the apex, alongside the sandbox one.
- [ ] Nobody is mid-recording or mid-demo. Step 2 invalidates the current
      token.

## 1. Production credentials onto the box

`.env.production` is untracked and survives deploys — it is the one file on
the box that is not wiped by the deploy timer.

```bash
ssh brawlzone
# edit /home/ubuntu/brawlstats/.env.production
#   TIKTOK_CLIENT_KEY=<production key>
#   TIKTOK_CLIENT_SECRET=<production secret>
```

`env_file` is read when a container is **created**, not per request, so a
restart is not enough:

```bash
cd ~/brawlstats && docker compose up -d --force-recreate --no-deps app
docker compose exec -T app node -e 'console.log(process.env.TIKTOK_CLIENT_KEY)'
```

## 2. Re-authorise

The refresh token on the box belongs to the sandbox client and is worthless to
the production one. This has to be done by hand, once, in a browser signed in
as the BrawlZone account.

1. Add a fresh `TIKTOK_SETUP_KEY` to `.env.production` (32 hex characters:
   `openssl rand -hex 16`) and recreate the app container again. It is URL-safe
   by construction — do not reuse `CRON_SECRET`, which is base64 and contains
   `+`, and `+` decodes to a space in a query string.
2. Open `https://brawlzone.net/api/tiktok/auth?key=<that key>` and approve.
3. The callback prints a `ssh brawlzone 'umask 077; cat > …'` block. Run it.
   **Everything below the `STOP RECORDING HERE` line is a live credential** —
   do not film, screenshot or paste it.
4. Delete `TIKTOK_SETUP_KEY` from `.env.production` and recreate the container.
   That closes both OAuth routes until they are needed again.

Confirm before going further:

```bash
ssh brawlzone '~/brawlstats/deploy/bin/brawlzone-tiktok'
# expect: token refreshed / N slides ready / uploaded … / SEND_TO_USER_INBOX
```

If that works, the production client is authorised and still posting to the
inbox. Only now is it worth changing the mode.

## 3. Query creator info first — this is not optional

TikTok requires `/v2/post/publish/creator_info/query/` to be called before a
direct post, and `privacy_level` **must** be one of the `privacy_level_options`
it returns for that account. Hardcoding `PUBLIC_TO_EVERYONE` is the documented
way to have posts rejected, or to publish against a setting the account holder
changed in the app and we never read.

`deploy/bin/brawlzone-tiktok` does not do this today, because `MEDIA_UPLOAD`
does not need it. It has to be added:

```
POST https://open.tiktokapis.com/v2/post/publish/creator_info/query/
Authorization: Bearer $ACCESS
```

Read `data.privacy_level_options`. Prefer `PUBLIC_TO_EVERYONE`; if it is not in
the list, **abort rather than fall back** — every other option is more private
than intended, and silently posting to `SELF_ONLY` every day is exactly the
failure that looks like success.

Also worth reading from the same response: `max_video_post_duration_sec` (not
relevant to photos) and whether the account is in a state that forbids posting
at all.

## 4. Flip the mode and add the fields Direct Post requires

In `deploy/bin/brawlzone-tiktok`:

```diff
-POST_MODE="MEDIA_UPLOAD"
+POST_MODE="DIRECT_POST"
```

And in the payload builder, inside `post_info`:

| Field | Value | Why |
| --- | --- | --- |
| `privacy_level` | from step 3 | required for DIRECT_POST; must come from the query |
| `auto_add_music` | `true` | TikTok adds recommended music. A silent photo post gets pushed less, and this only works in DIRECT_POST |
| `brand_content_toggle` | `false` | not a paid partnership |
| `brand_organic_toggle` | `true` | it *is* promoting our own site, and saying so is the honest answer |
| `disable_comment` | `false` | leave comments on |

The photo-post reference marks the two brand toggles required and the direct-post
reference calls them optional. Send both explicitly and the disagreement stops
mattering.

`brand_organic_toggle: true` is a judgement call, not a formality: the post
drives traffic to a site we own. Declaring it is cheap and being caught not
declaring it is not.

## 5. Rate limit

Six requests per minute per access token. The job makes roughly four calls per
run (refresh, creator info, init, status), so a normal day is nowhere near it —
but a retry loop that does not sleep would be. Do not add one.

## 6. Verify, then leave it alone for a day

```bash
ssh brawlzone '~/brawlstats/deploy/bin/brawlzone-tiktok'
```

Expect `PUBLISH_COMPLETE` rather than `SEND_TO_USER_INBOX`. Then **open TikTok
and look at the post** — the status endpoint reports that TikTok accepted and
processed it, not that it looks right. Check the cover slide is slide 0, the
caption is not truncated mid-word, and the music TikTok chose is not absurd.

If `unaudited_client_can_only_post_to_private_accounts` comes back, the audit
has not actually applied to this client yet. The script dies with that named
error rather than continuing. Set `POST_MODE` back to `MEDIA_UPLOAD` and wait.

## 7. Add the staleness check

Deferred while a human was publishing daily, because a missing post was
obvious — you would notice there was nothing to tap. Once it is unattended,
nothing on the box notices if the job stops: `die` writes to the journal and
no health check reads it.

Add a check that fails when the newest successful upload is more than ~2 days
old, alongside the other health checks in `deploy/`. Health check 9 (the memory
guard) is the model: it exists precisely because losing it breaks nothing
visible until it suddenly does.

## Rollback

One line, no redeploy of the app needed — `deploy/bin/brawlzone-tiktok` is a
repo file, so revert it and push, and the deploy timer picks it up inside five
minutes:

```diff
-POST_MODE="DIRECT_POST"
+POST_MODE="MEDIA_UPLOAD"
```

Posts go back to the inbox. Nothing already published is affected; delete those
in the app if you need to.

## What still will not be automated

- **A tappable link.** There is no link, URL or CTA field in `post_info`, and a
  slide is a picture. The only tappable route is the profile bio link, which
  needs a Business account. See the closing slide in `lib/daily-slides`.
- **Choosing what to post.** The job posts the day's findings. If a day finds
  nothing interesting it will say so rather than invent something, and that is
  deliberate.
