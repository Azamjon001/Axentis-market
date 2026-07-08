#!/bin/bash
# Full Docker Rebuild - VPS Deployment Script
# Rebuilds ALL containers without cache (backend + frontend)

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  🚀 FULL DOCKER REBUILD - AXENTIS MARKET                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PROJECT_PATH="/root/Axentis-market"

echo -e "${BLUE}[1/6]${NC} Navigating to project directory..."
cd "$PROJECT_PATH" || exit 1
echo -e "${GREEN}✓${NC} Current directory: $(pwd)"
echo ""

echo -e "${BLUE}[2/6]${NC} Pulling latest changes from GitHub..."
git pull origin main
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Latest code pulled successfully"
else
    echo -e "${RED}✗${NC} Git pull failed!"
    exit 1
fi
echo ""

echo -e "${BLUE}[3/6]${NC} Stopping all containers..."
docker-compose down
echo -e "${GREEN}✓${NC} Containers stopped"
echo ""

echo -e "${BLUE}[4/6]${NC} Rebuilding ALL containers (NO CACHE)..."
echo -e "${YELLOW}⏳ This may take several minutes...${NC}"
docker-compose build --no-cache
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} All containers rebuilt successfully"
else
    echo -e "${RED}✗${NC} Build failed!"
    exit 1
fi
echo ""

echo -e "${BLUE}[5/6]${NC} Starting containers..."
docker-compose up -d
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Containers started"
else
    echo -e "${RED}✗${NC} Failed to start containers!"
    exit 1
fi
echo ""

echo -e "${BLUE}[6/6]${NC} Checking container status..."
docker ps --filter "name=axentis"
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ DEPLOYMENT COMPLETED                                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}🎉 Full rebuild completed!${NC}"
echo ""
echo "📝 Changes in Commit 41cfc3a:"
echo "  • Smart duplicate product detection"
echo "  • Products merge by: name, price, barcode, barid"
echo "  • Quantity auto-increment for duplicates"
echo "  • Works in: manual add, Excel import, CSV import"
echo ""
echo "🌐 Visit: https://axentis.uz"
echo ""
echo "📊 Test the feature:"
echo "  1. Go to 'Raqamli ombor' (Digital Warehouse)"
echo "  2. Add product: Name='Test', Price=1000, Quantity=5"
echo "  3. Add same product again: Name='Test', Price=1000, Quantity=3"
echo "  4. Check warehouse - should show ONE product with Quantity=8"
echo ""
