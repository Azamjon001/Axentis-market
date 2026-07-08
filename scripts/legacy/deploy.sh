#!/bin/bash
# Quick Deploy Script for VPS
# Save this as deploy.sh and run: bash deploy.sh

VPS="root@77.237.242.126"
PROJECT_DIR="/root/Axentis-market"

echo "=== Deploying to VPS ==="
echo ""

# Execute commands on VPS
ssh $VPS << 'ENDSSH'
cd /root/Axentis-market

echo "📥 Pulling latest code..."
git pull origin main

echo ""
echo "🛑 Stopping containers..."
docker-compose down

echo ""
echo "🔨 Rebuilding containers..."
docker-compose build --no-cache

echo ""
echo "🚀 Starting containers..."
docker-compose up -d

echo ""
echo "✅ Deployment complete! Container status:"
docker ps

ENDSSH

echo ""
echo "Deployment finished!"
