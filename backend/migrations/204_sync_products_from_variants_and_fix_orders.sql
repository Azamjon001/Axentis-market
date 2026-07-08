-- +goose Up
-- Step 1: Sync products from their variants.
--   price          = min purchase price from variants
--   markup_percent = markup_percent of the cheapest variant that has any markup
--   (selling_price is GENERATED ALWAYS from price+markup_percent, so NO direct update needed)
UPDATE products p
SET
    price          = v.min_price,
    markup_percent = COALESCE(v.markup_pct, p.markup_percent),
    updated_at     = NOW()
FROM (
    SELECT
        pv.product_id,
        MIN(pv.price)                                              AS min_price,
        (SELECT pv2.markup_percent
         FROM product_variants pv2
         WHERE pv2.product_id = pv.product_id
           AND pv2.markup_percent > 0
         ORDER BY pv2.price ASC
         LIMIT 1)                                                  AS markup_pct
    FROM product_variants pv
    WHERE pv.price > 0
    GROUP BY pv.product_id
) v
WHERE p.id = v.product_id
  AND v.min_price > 0;

-- Step 2: Recalculate markup_profit for orders where items carry price/price_with_markup.
--   Uses the stored JSON fields price_with_markup and price directly.
UPDATE orders o
SET markup_profit = calc.total
FROM (
    SELECT
        o2.id,
        COALESCE(SUM(
            CASE
                WHEN (item->>'price_with_markup') IS NOT NULL
                 AND (item->>'price')             IS NOT NULL
                 AND (item->>'price_with_markup')::numeric > (item->>'price')::numeric
                THEN ((item->>'price_with_markup')::numeric - (item->>'price')::numeric)
                     * COALESCE((item->>'quantity')::numeric, 1)
                ELSE 0
            END
        ), 0) AS total
    FROM orders o2,
         jsonb_array_elements(o2.items) AS item
    WHERE o2.markup_profit = 0
      AND o2.items IS NOT NULL
      AND jsonb_typeof(o2.items) = 'array'
    GROUP BY o2.id
) calc
WHERE o.id = calc.id
  AND calc.total > 0;

-- Step 3: For orders where items had price==price_with_markup (old cart bug),
--   recalculate using current variant/product selling_price from DB.
UPDATE orders o
SET markup_profit = calc.total
FROM (
    SELECT
        o2.id,
        COALESCE(SUM(
            CASE
                WHEN (item->>'productId') IS NOT NULL
                THEN (
                    COALESCE(
                        (SELECT (pv.selling_price - pv.price)
                         FROM product_variants pv
                         WHERE pv.product_id = (item->>'productId')::bigint
                           AND pv.selling_price > pv.price
                         ORDER BY pv.price ASC
                         LIMIT 1),
                        (SELECT GREATEST(p2.selling_price - p2.price, 0)
                         FROM products p2
                         WHERE p2.id = (item->>'productId')::bigint),
                        0
                    )
                ) * COALESCE((item->>'quantity')::numeric, 1)
                ELSE 0
            END
        ), 0) AS total
    FROM orders o2,
         jsonb_array_elements(o2.items) AS item
    WHERE o2.markup_profit = 0
      AND o2.items IS NOT NULL
      AND jsonb_typeof(o2.items) = 'array'
    GROUP BY o2.id
) calc
WHERE o.id = calc.id
  AND calc.total > 0;

-- +goose Down
-- (no rollback — data fixes only)
