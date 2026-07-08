#!/bin/bash
echo "=== PRODUCTS TABLE PRICE COLUMNS ==="
docker exec onlineshop2-postgres psql -U onlineshop2_user onlineshop2 -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='products' ORDER BY ordinal_position"

echo ""
echo "=== TEST ADD TO CART ==="
docker exec onlineshop2-postgres psql -U onlineshop2_user onlineshop2 -c "SELECT id, name FROM products LIMIT 3"

echo ""
echo "=== FULL RECENT BACKEND LOGS ==="
cd /root/Axentis-market && docker-compose logs --since=10m backend 2>&1 | tail -50
