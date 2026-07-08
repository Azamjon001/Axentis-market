#!/bin/bash
echo "=== TABLE CHECK ==="
docker exec onlineshop2-postgres psql -U onlineshop2_user onlineshop2 -c "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='cart_items'"

echo ""
echo "=== MIGRATION FILES WITH CART ==="
ls /root/Axentis-market/backend/migrations/ | grep -i cart

echo ""
echo "=== LAST 100 BACKEND LOGS - CART RELATED ==="
cd /root/Axentis-market && docker-compose logs --tail=100 backend 2>&1 | grep -i "cart\|Error adding\|POST.*cart\|500"
