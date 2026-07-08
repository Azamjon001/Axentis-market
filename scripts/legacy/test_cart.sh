#!/bin/bash
echo "=== TEST POST /api/cart ==="
curl -s -X POST http://localhost:3000/api/cart \
  -H "Content-Type: application/json" \
  -d '{"user_phone":"+998901234567","product_id":8,"quantity":1}' | cat

echo ""
echo "=== BACKEND LOGS AFTER TEST ==="
cd /root/Axentis-market && docker-compose logs --tail=20 backend 2>&1
