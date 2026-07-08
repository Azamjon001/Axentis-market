#!/bin/bash
echo "=== cart_items table structure ==="
docker exec onlineshop2-postgres psql -U onlineshop2_user onlineshop2 -c "SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='cart_items' ORDER BY ordinal_position"

echo ""
echo "=== Does cart_items table exist? ==="
docker exec onlineshop2-postgres psql -U onlineshop2_user onlineshop2 -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='cart_items'"

echo ""
echo "=== Backend recent logs ==="
cd /root/Axentis-market && docker-compose logs --tail=30 backend 2>&1 | grep -E "cart|Cart|Error|error|500|INSERT|failed"
