#!/bin/bash
echo "=== CHECKING COMPANIES COLUMNS ==="
docker exec onlineshop2-postgres psql -U onlineshop2_user -d onlineshop2 -c "SELECT column_name FROM information_schema.columns WHERE table_name='companies' ORDER BY ordinal_position;"
