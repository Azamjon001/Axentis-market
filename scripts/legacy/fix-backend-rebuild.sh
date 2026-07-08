#!/usr/bin/env bash
# Run this script on the VPS server: bash fix-backend-rebuild.sh
set -e

echo "=== Checking backend container status ==="
docker ps -a | grep backend || echo "No backend container found"

echo ""
echo "=== Recent backend logs ==="
docker compose logs --tail=50 backend 2>&1 || docker-compose logs --tail=50 backend 2>&1 || true

echo ""
echo "=== Pulling latest code ==="
git pull origin main

echo ""
echo "=== Rebuilding and restarting backend (no cache) ==="
docker compose stop backend 2>/dev/null || docker-compose stop backend
docker compose build --no-cache backend 2>/dev/null || docker-compose build --no-cache backend
docker compose up -d backend 2>/dev/null || docker-compose up -d backend

echo ""
echo "=== Waiting 15 seconds for startup ==="
sleep 15

echo ""
echo "=== New backend logs ==="
docker compose logs --tail=50 backend 2>/dev/null || docker-compose logs --tail=50 backend

echo ""
echo "=== Testing API ==="
curl -sf http://localhost:3000/health && echo " - Health OK" || echo " - Health check FAILED"
curl -sf http://localhost:3000/api/users/count && echo " - Users count OK" || echo " - Users count FAILED"
curl -sf "http://localhost:3000/api/companies" && echo " - Companies OK" || echo " - Companies FAILED"
echo ""
echo "=== Done! ==="
