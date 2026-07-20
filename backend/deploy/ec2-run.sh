#!/usr/bin/env bash
# Build and (re)run the Aasrah backend on EC2, behind Caddy for automatic HTTPS.
# Rerun this after `git pull` to deploy updates.
#
# Prereqs:
#   - ec2-setup.sh has been run (Docker installed)
#   - /home/ec2-user/aasrah.env exists with your environment values (see below)
#   - Security group allows inbound 80 + 443 (for Let's Encrypt + HTTPS)
#
# Create /home/ec2-user/aasrah.env like this (no quotes needed):
#   AASRAH_DATABASE_URL=postgresql+psycopg://user:pass@host/db?sslmode=require
#   SECRET_KEY=<a long random string>
#   ENVIRONMENT=production
#   DEBUG=false
#   CORS_ORIGINS=https://your-app.vercel.app
#   # optional: NVIDIA_API_KEY=..., SMTP_*, VAPID_*, SENTRY_DSN=...
#
# The public hostname Caddy fetches a TLS cert for (default: nip.io wildcard
# resolving to this box's public IP, so no domain purchase is needed).
API_HOST="${API_HOST:-3-109-144-164.nip.io}"

set -euo pipefail

REPO=/home/ec2-user/aasrah
cd "$REPO"
# No `|| true`: a diverged or dirty tree must stop the deploy, not silently
# rebuild the previous commit and print "Deployed."
git pull --ff-only

echo "==> Building backend image"
docker build -t aasrah-backend ./backend

echo "==> Creating shared docker network"
docker network create aasrah-net 2>/dev/null || true

echo "==> (Re)starting backend container (internal only, port 8000 on the network)"
docker rm -f aasrah-backend 2>/dev/null || true
docker run -d \
  --name aasrah-backend \
  --restart unless-stopped \
  --network aasrah-net \
  --env-file /home/ec2-user/aasrah.env \
  -v aasrah_uploads:/app/uploads \
  --log-opt max-size=10m --log-opt max-file=3 \
  aasrah-backend

# -v aasrah_uploads: WITHOUT this, `docker rm -f` above destroys the container's
# writable layer on every deploy, taking every uploaded rescue photo with it.
# The report_image rows survive, so the UI renders broken tiles forever.
# --log-opt: the default json-file driver grows unbounded until the 8GB root
# volume fills, which takes down Docker itself.

echo "==> Applying database migrations"
docker exec aasrah-backend python -m scripts.init_db

echo "==> Waiting for the new container to report healthy"
for i in $(seq 1 30); do
  if docker exec aasrah-backend python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/v1/health/db', timeout=2).status==200 else 1)" 2>/dev/null; then
    echo "    healthy after ${i}s"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "!!! Backend did not become healthy. Recent logs:" >&2
    docker logs --tail 50 aasrah-backend >&2
    exit 1
  fi
  sleep 1
done

echo "==> Writing Caddyfile for $API_HOST"
cat > /home/ec2-user/Caddyfile <<EOF
$API_HOST {
	reverse_proxy aasrah-backend:8000
}
EOF

echo "==> (Re)starting Caddy (auto HTTPS via Let's Encrypt on 80/443)"
docker rm -f aasrah-caddy 2>/dev/null || true
docker run -d \
  --name aasrah-caddy \
  --restart unless-stopped \
  --network aasrah-net \
  -p 80:80 -p 443:443 \
  -v /home/ec2-user/Caddyfile:/etc/caddy/Caddyfile:ro \
  -v caddy_data:/data \
  -v caddy_config:/config \
  caddy:2-alpine

echo
echo "Deployed. Backend is reachable at:"
echo "  https://$API_HOST/api/v1/health"
echo
echo "Set this on Vercel:  NEXT_PUBLIC_API_BASE_URL=https://$API_HOST/api/v1"
echo "                     NEXT_PUBLIC_API_ORIGIN=https://$API_HOST"
docker ps --filter name=aasrah-
