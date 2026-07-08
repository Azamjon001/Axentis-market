#!/bin/bash
# VPS Deployment Script for Axentis Market
# Run this script on VPS after SSH connection

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  🚀 DEPLOYING AXENTIS MARKET - LATEST VERSION             ║"
echo "╔════════════════════════════════════════════════════════════╗"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Project path
PROJECT_PATH="/root/Axentis-market"

echo -e "${BLUE}[1/5]${NC} Navigating to project directory..."
cd "$PROJECT_PATH" || exit 1
echo -e "${GREEN}✓${NC} Current directory: $(pwd)"
echo ""

echo -e "${BLUE}[2/5]${NC} Pulling latest changes from GitHub..."
git pull origin main
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Successfully pulled latest code"
else
    echo -e "${YELLOW}⚠${NC} Git pull failed, but continuing..."
fi
echo ""

echo -e "${BLUE}[3/5]${NC} Rebuilding frontend (no cache)..."
docker-compose build frontend --no-cache
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Frontend image rebuilt successfully"
else
    echo -e "${YELLOW}⚠${NC} Frontend build had warnings, but continuing..."
fi
echo ""

echo -e "${BLUE}[4/5]${NC} Recreating containers..."
docker-compose up -d --force-recreate frontend
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Containers recreated"
else
    echo -e "${YELLOW}⚠${NC} Container recreation had warnings"
fi
echo ""

echo -e "${BLUE}[5/5]${NC} Checking container status..."
docker ps --filter "name=frontend"
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ DEPLOYMENT COMPLETED                                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}🎉 Latest version deployed!${NC}"
echo ""
echo "📝 Changes in this version:"
echo "  • Analytics panel: blue color for expenses (no red)"
echo "  • Period selector with visible label"
echo "  • Chart descriptions added"
echo "  • Excel import panel translated to Uzbek"
echo "  • Dark mode support for import panel"
echo ""
echo "🌐 Visit: https://axentis.uz/#/analytics"
echo ""
