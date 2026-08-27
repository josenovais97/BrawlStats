#!/usr/bin/env bash
# Take a fresh Ubuntu 24.04 aarch64 box to serving BrawlZone.
#
# Written because everything that makes the box work -- the timers, the wrapper
# scripts, the logrotate and fail2ban config -- used to live only ON the box,
# and Oracle is entitled to reclaim an idle Always Free instance. Losing it
# would have meant rebuilding all of it from memory.
#
#   ssh <newbox>
#   git clone https://github.com/josenovais97/BrawlStats.git ~/brawlstats
#   cd ~/brawlstats && ./deploy/bootstrap.sh
#
# Idempotent: safe to re-run, and re-running is how you apply a change made
# under deploy/. It deliberately does NOT touch .env.production or the
# database -- those come from your off-box backup, see the closing notes.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
USER_NAME="${SUDO_USER:-$USER}"
say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

[ "$(uname -m)" = "aarch64" ] || { echo "expected aarch64; this is $(uname -m)" >&2; exit 1; }
# No `sudo -v` here: it insists on a TTY even where the user has NOPASSWD, so
# it broke non-interactive runs over ssh. The individual sudo calls below work
# either way.
sudo true

say "Firewall: open 80/443 above the REJECT rule"
# OCI's Ubuntu image ships a REJECT at the end of INPUT, so 80/443 stay dead
# even when the security list allows them. Insert above it, then persist.
if ! sudo iptables -C INPUT -m state --state NEW -p tcp --dport 80 -j ACCEPT 2>/dev/null; then
  n=$(sudo iptables -L INPUT --line-numbers -n | awk '/REJECT/ {print $1; exit}')
  n="${n:-1}"
  sudo iptables -I INPUT "$n" -m state --state NEW -p tcp --dport 443 -j ACCEPT
  sudo iptables -I INPUT "$n" -m state --state NEW -p tcp --dport 80 -j ACCEPT
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq iptables-persistent >/dev/null 2>&1 || true
  sudo netfilter-persistent save >/dev/null 2>&1 || sudo sh -c 'iptables-save > /etc/iptables/rules.v4'
fi

say "Docker"
if ! command -v docker >/dev/null; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq ca-certificates curl gnupg >/dev/null
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=arm64 signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu noble stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
fi
sudo usermod -aG docker "$USER_NAME"
sudo systemctl enable --now docker >/dev/null

say "Supporting packages"
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq msmtp msmtp-mta fail2ban jq >/dev/null 2>&1
# rpcbind listens on 0.0.0.0:111 by default and has no use here.
sudo systemctl disable --now rpcbind.socket rpcbind >/dev/null 2>&1 || true
sudo DEBIAN_FRONTEND=noninteractive apt-get -y purge rpcbind >/dev/null 2>&1 || true

say "Directories"
# root:adm 2775 setgid: the jobs write as $USER (in adm), Caddy writes as root.
sudo install -d -o root -g adm -m 2775 /var/log/brawlzone
sudo install -d -o root -g adm -m 750  /etc/brawlzone
sudo install -d -o "$USER_NAME" -g "$USER_NAME" -m 755 /var/lib/brawlzone
sudo usermod -aG adm "$USER_NAME"

say "Scripts"
for f in "$REPO_DIR"/deploy/bin/brawlzone-*; do
  sudo install -m 755 "$f" "/usr/local/bin/$(basename "$f")"
done
install -m 755 "$REPO_DIR/deploy/bin/auto-deploy.sh" "$HOME/auto-deploy.sh"
install -m 755 "$REPO_DIR/deploy/bin/backup-db.sh"  "$HOME/backup-db.sh"

say "systemd units"
sudo install -m 644 "$REPO_DIR"/deploy/systemd/* /etc/systemd/system/
for u in sampler backup deploy; do
  sudo install -d "/etc/systemd/system/brawlzone-${u}.service.d"
  printf '[Unit]\nOnFailure=brawlzone-alert@%%N.service\n' \
    | sudo tee "/etc/systemd/system/brawlzone-${u}.service.d/onfailure.conf" >/dev/null
done
sudo systemctl daemon-reload

say "logrotate, fail2ban, sshd"
sudo install -m 644 "$REPO_DIR/deploy/etc/logrotate-brawlzone" /etc/logrotate.d/brawlzone
sudo install -m 644 "$REPO_DIR/deploy/etc/fail2ban-jail.local" /etc/fail2ban/jail.local
# apt starts fail2ban on install, so `enable --now` is a no-op and the config
# is never read. It must be restarted.
sudo systemctl restart fail2ban
grep -q '^LESS=' /etc/environment || echo 'LESS=-R' | sudo tee -a /etc/environment >/dev/null
if id jpn >/dev/null 2>&1; then
  sudo install -m 644 "$REPO_DIR/deploy/etc/sshd-99-brawlzone.conf" /etc/ssh/sshd_config.d/99-brawlzone.conf
  sudo sshd -t && sudo systemctl reload ssh
else
  echo "  (skipping sshd drop-in: user 'jpn' does not exist on this box)"
fi

say "Alerting config"
if [ ! -f /etc/brawlzone/msmtprc ]; then
  sudo tee /etc/brawlzone/msmtprc >/dev/null <<'EOF'
defaults
auth            on
tls             on
tls_trust_file  /etc/ssl/certs/ca-certificates.crt
logfile         /var/log/brawlzone/alert.log

account         gmail
host            smtp.gmail.com
port            587
from            REPLACE_WITH_YOUR_GMAIL
user            REPLACE_WITH_YOUR_GMAIL
password        REPLACE_WITH_APP_PASSWORD

account default : gmail
EOF
  sudo chmod 600 /etc/brawlzone/msmtprc
  printf 'SMTP_USER=REPLACE_WITH_YOUR_GMAIL\nALERT_TO=contacts@brawlzone.net\n' \
    | sudo tee /etc/brawlzone/alert.conf >/dev/null
  sudo chmod 640 /etc/brawlzone/alert.conf
fi
sudo touch /var/log/brawlzone/alert.log
sudo chgrp adm /var/log/brawlzone/alert.log && sudo chmod 660 /var/log/brawlzone/alert.log

say "Timers"
sudo systemctl enable --now brawlzone-deploy.timer brawlzone-sampler.timer \
                            brawlzone-backup.timer brawlzone-health.timer >/dev/null

cat <<EOF

$(printf '\033[1;32mBox provisioned.\033[0m') Three things this script cannot do for you:

  1. .env.production  -- copy it from your off-box backup into $REPO_DIR/
                         Nothing starts without it.
  2. The database     -- start the stack, then restore your newest dump:
                           docker compose up -d db
                           gunzip -c <dump>.sql.gz | docker compose exec -T db \\
                             psql -U brawlzone -d brawlzone -v ON_ERROR_STOP=1
  3. Credentials      -- put a Gmail app password in /etc/brawlzone/msmtprc
                         and your address in /etc/brawlzone/alert.conf

Then:  cd $REPO_DIR && docker compose up -d --build
And point brawlzone.net at this box's public IP before expecting TLS to issue --
Caddy cannot get a certificate until the name resolves here.
EOF
