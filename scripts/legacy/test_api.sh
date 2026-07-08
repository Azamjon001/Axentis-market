#!/bin/bash
echo "=== TEST: ADD TO CART ==="
curl -s -w "\nHTTP:%{http_code}" -X POST http://localhost:3000/api/cart \
  -H "Content-Type: application/json" \
  -d '{"user_phone":"+998901111111","product_id":21,"quantity":1,"selected_color":"","selected_size":""}'

echo ""
echo ""
echo "=== TEST: GET CART ==="
curl -s -w "\nHTTP:%{http_code}" http://localhost:3000/api/cart/+998901111111

echo ""
echo ""
echo "=== BACKEND LOGS (cart related) ==="
cd /root/Axentis-market
docker-compose logs --tail=200 backend 2>&1 | grep -E "(cart|Cart|500|ERROR|Error|❌)" | tail -20
