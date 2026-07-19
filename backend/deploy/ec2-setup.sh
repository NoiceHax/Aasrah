#!/usr/bin/env bash
# One-time setup for running the Aasrah backend on a fresh Amazon Linux 2023
# EC2 instance (t3.micro / free tier) with Docker + Caddy (for HTTPS).
#
# Usage (on the EC2 box, after SSH-ing in):
#   bash ec2-setup.sh
#
# Then create /home/ec2-user/aasrah.env (see ec2-run.sh header) and run ec2-run.sh.
set -euo pipefail

echo "==> Installing Docker + git"
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user

echo "==> Adding a 1G swap file (912MB box is tight; protects pip install / uvicorn)"
if ! sudo swapon --show | grep -q /swapfile; then
  sudo dd if=/dev/zero of=/swapfile bs=1M count=1024 status=none
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo
echo "Docker installed. Log out and back in (so 'docker' works without sudo),"
echo "then create /home/ec2-user/aasrah.env and run ec2-run.sh."
