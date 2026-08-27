# deploy/

Everything the box is, as files. Previously this lived only *on* the box, which
made an idle-reclaimed instance an unrecoverable one.

| | |
| --- | --- |
| `bootstrap.sh` | fresh Ubuntu 24.04 aarch64 -> serving. Idempotent. |
| `bin/` | scripts installed to `/usr/local/bin` and `~` |
| `systemd/` | the four timers and the alert template unit |
| `etc/` | logrotate, fail2ban, sshd drop-in |

## Changing any of this

`bootstrap.sh` installs these files; it does **not** run on every deploy, and
`auto-deploy.sh` deliberately does not update itself (a script rewriting itself
mid-run is a bad time). So after changing anything here:

```bash
ssh brawlzone 'cd ~/brawlstats && ./deploy/bootstrap.sh'
```

## What is NOT here, on purpose

- `.env.production` — secrets. Lives on the box and in the off-box backup only.
- Database dumps — `~/backups` on the box, pulled to the dev machine daily.

Both are what you need to restore; neither belongs in a public repo.
