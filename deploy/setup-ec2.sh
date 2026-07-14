#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# One-time EC2 host bootstrap for AMAZON LINUX 2023 (SSH user: ec2-user).
#   • Docker + git via dnf
#   • Docker Compose plugin + buildx (AL2023 ships neither; Compose errors
#     "requires buildx 0.17.0 or later" without buildx) — installed as CLI plugins
#   • 2 GB swap via dd (NOT fallocate — xfs, AL2023's default fs, rejects
#     fallocate-created swap). Gives a 1 GB t3.micro headroom so the Next.js
#     production build doesn't get OOM-killed.
#
# Run once:  bash deploy/setup-ec2.sh   then log out/in for the docker group.
# (For Ubuntu, replace the dnf block with apt-get; buildx/compose steps are the same.)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PLUGIN_DIR=/usr/local/lib/docker/cli-plugins

echo "==> Installing Docker + git (dnf)"
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"

echo "==> Installing Docker Compose plugin"
sudo mkdir -p "$PLUGIN_DIR"
sudo curl -sSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
  -o "$PLUGIN_DIR/docker-compose"
sudo chmod +x "$PLUGIN_DIR/docker-compose"

echo "==> Installing Docker buildx plugin (required by Compose)"
BV=$(curl -s https://api.github.com/repos/docker/buildx/releases/latest | grep -oE '"tag_name": "[^"]+' | grep -oE 'v[0-9.]+')
sudo curl -sSL "https://github.com/docker/buildx/releases/download/${BV}/buildx-${BV}.linux-$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')" \
  -o "$PLUGIN_DIR/docker-buildx"
sudo chmod +x "$PLUGIN_DIR/docker-buildx"

echo "==> Setting up 2 GB swap (Next.js build headroom on small instances)"
if ! sudo swapon --show | grep -q '/swapfile'; then
  sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
else
  echo "    swap already configured, skipping"
fi

echo
echo "==> Done. Log OUT and back IN (so the docker group applies), then verify:"
echo "    docker ps && docker compose version && free -h"
echo "  and launch:"
echo "    cp .env.prod.example .env.prod && chmod 600 .env.prod   # fill in secrets"
echo "    docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build"
