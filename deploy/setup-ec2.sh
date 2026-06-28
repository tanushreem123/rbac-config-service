#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# One-time EC2 host bootstrap (Ubuntu 22.04).
#   • Docker + compose plugin + awscli
#   • 2 GB swap file — gives a t3.small (2 GB RAM) headroom so the Next.js
#     production build doesn't get OOM-killed.
# Run once:  bash deploy/setup-ec2.sh   then log out/in for the docker group.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

echo "==> Installing Docker, compose plugin, awscli"
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin awscli
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"

echo "==> Setting up 2 GB swap (Next.js build headroom on small instances)"
if ! sudo swapon --show | grep -q '/swapfile'; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
else
  echo "    swap already configured, skipping"
fi

echo
echo "==> Done. Log OUT and back IN (so the docker group applies), then:"
echo "    cp .env.prod.example .env.prod && chmod 600 .env.prod   # fill in secrets"
echo "    docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build"
