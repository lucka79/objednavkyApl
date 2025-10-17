-- Fix Ingredient Prices - Convert per-unit prices to per-kg prices
-- This script helps identify ingredients that may have prices entered as per-unit instead of per-kg

-- ====================================================================================
-- STEP 1: Find potentially incorrect prices
-- ====================================================================================
-- This query finds ingredients where:
-- - Unit is not 'kg' 
-- - kiloPerUnit < 1 (unit is smaller than 1 kg)
-- - Price seems too low (< 100 Kč/kg)
-- - Calculated price per unit is suspiciously low

SELECT 
  id,
  name,
  unit,
  price as current_price_in_db,
  kiloPerUnit as kg_per_unit,
  (price * kiloPerUnit) as calculated_price_per_unit,
  -- If current price is actually per-unit, this is what it should be per-kg:
  (price / kiloPerUnit) as suggested_price_per_kg,
  active,
  created_at
FROM ingredients
WHERE 
  unit != 'kg' 
  AND unit != 'l'
  AND kiloPerUnit < 1 
  AND price < 100
  AND (price * kiloPerUnit) < (price * 0.5)
ORDER BY name;

-- ====================================================================================
-- STEP 2: Preview what changes would be made
-- ====================================================================================
-- This shows a preview of corrections (doesn't change anything yet)

SELECT 
  id,
  name,
  unit,
  price as old_price,
  (price / kiloPerUnit) as new_price,
  CONCAT('UPDATE ingredients SET price = ', ROUND(price / kiloPerUnit, 2), ' WHERE id = ', id, ';') as update_statement
FROM ingredients
WHERE 
  unit != 'kg' 
  AND unit != 'l'
  AND kiloPerUnit < 1 
  AND price < 100
  AND (price * kiloPerUnit) < (price * 0.5)
ORDER BY name;

-- ====================================================================================
-- STEP 3: Fix specific ingredient - Salát Lollo Biondo
-- ====================================================================================
-- Known incorrect price: 40 should be 235.29 (40 / 0.17)

-- Check current value first
SELECT 
  id, 
  name, 
  unit, 
  price, 
  kiloPerUnit,
  (price * kiloPerUnit) as current_price_per_unit,
  (price / kiloPerUnit) as corrected_price_per_kg
FROM ingredients 
WHERE name ILIKE '%Salát Lollo Biondo%' OR id = 162;

-- If confirmed incorrect, uncomment and run this:
-- UPDATE ingredients 
-- SET price = ROUND(price / kiloPerUnit, 2)  -- Convert from per-unit to per-kg
-- WHERE id = 162 AND name = 'Salát Lollo Biondo';

-- Also update supplier codes:
-- UPDATE ingredient_supplier_codes
-- SET price = ROUND(
--   (SELECT price FROM ingredients WHERE id = 162) / 
--   (SELECT kiloPerUnit FROM ingredients WHERE id = 162), 
--   2
-- )
-- WHERE ingredient_id = 162;

-- ====================================================================================
-- STEP 4: Bulk fix for all affected ingredients (CAUTION!)
-- ====================================================================================
-- ⚠️ IMPORTANT: Review results from STEP 1 and STEP 2 before running this!
-- This will update ALL ingredients that appear to have incorrect prices.
-- Only run this if you're confident the detection criteria are correct.

-- Uncomment to execute (after reviewing!):
/*
UPDATE ingredients
SET price = ROUND(price / kiloPerUnit, 2)
WHERE 
  unit != 'kg' 
  AND unit != 'l'
  AND kiloPerUnit < 1 
  AND price < 100
  AND (price * kiloPerUnit) < (price * 0.5);

-- Also update supplier codes for affected ingredients:
UPDATE ingredient_supplier_codes sc
SET price = ROUND(
  (SELECT i.price FROM ingredients i WHERE i.id = sc.ingredient_id) / 
  (SELECT i.kiloPerUnit FROM ingredients i WHERE i.id = sc.ingredient_id), 
  2
)
WHERE ingredient_id IN (
  SELECT id FROM ingredients
  WHERE 
    unit != 'kg' 
    AND unit != 'l'
    AND kiloPerUnit < 1 
    AND price < 100
    AND (price * kiloPerUnit) < (price * 0.5)
);
*/

-- ====================================================================================
-- STEP 5: Verify corrections
-- ====================================================================================
-- After making changes, verify the prices are correct:

SELECT 
  i.id,
  i.name,
  i.unit,
  i.price as price_per_kg,
  i.kiloPerUnit,
  (i.price * i.kiloPerUnit) as price_per_unit,
  ri.recipe_id,
  ri.quantity as quantity_in_recipe,
  (ri.quantity * i.kiloPerUnit * i.price) as calculated_cost
FROM ingredients i
LEFT JOIN recipe_ingredients ri ON ri.ingredient_id = i.id
WHERE 
  i.unit != 'kg'
  AND i.unit != 'l'
  AND ri.recipe_id = (SELECT id FROM recipes WHERE name = 'Salát Kuřecí velká b.')
ORDER BY i.name;

-- ====================================================================================
-- STEP 6: Check recipe totals after fix
-- ====================================================================================
-- Verify the recipe "Salát Kuřecí velká b." has correct totals

WITH recipe_calc AS (
  SELECT 
    r.id as recipe_id,
    r.name as recipe_name,
    r.price as stored_price,
    r.quantity as stored_quantity,
    r.pricePerKilo as stored_price_per_kg,
    SUM(ri.quantity * i.kiloPerUnit) as calculated_weight,
    SUM(ri.quantity * i.kiloPerUnit * i.price) as calculated_price,
    CASE 
      WHEN SUM(ri.quantity * i.kiloPerUnit) > 0 
      THEN SUM(ri.quantity * i.kiloPerUnit * i.price) / SUM(ri.quantity * i.kiloPerUnit)
      ELSE 0 
    END as calculated_price_per_kg
  FROM recipes r
  LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
  LEFT JOIN ingredients i ON i.id = ri.ingredient_id
  WHERE r.name = 'Salát Kuřecí velká b.'
  GROUP BY r.id, r.name, r.price, r.quantity, r.pricePerKilo
)
SELECT 
  recipe_name,
  stored_price,
  calculated_price,
  (calculated_price - stored_price) as price_difference,
  stored_quantity,
  calculated_weight,
  (calculated_weight - stored_quantity) as weight_difference,
  stored_price_per_kg,
  calculated_price_per_kg,
  (calculated_price_per_kg - stored_price_per_kg) as price_per_kg_difference
FROM recipe_calc;

-- ====================================================================================
-- NOTES
-- ====================================================================================
-- 
-- Understanding the system:
-- - ALL prices in the database should be in Kč/kg (price per kilogram)
-- - kiloPerUnit converts the ingredient's unit to kilograms
-- - Cost calculation: quantity × kiloPerUnit × price
-- 
-- Examples:
--   Ingredient with unit "kg": kiloPerUnit = 1, price = 50 Kč/kg
--     Using 2 kg: 2 × 1 × 50 = 100 Kč ✓
-- 
--   Ingredient with unit "ks": kiloPerUnit = 0.17, price = 235 Kč/kg
--     Using 0.5 ks: 0.5 × 0.17 × 235 = 19.98 Kč ✓
-- 
-- Common mistake:
--   Entering price as "per unit" (40 Kč/ks) instead of "per kg" (235 Kč/kg)
-- 
-- ====================================================================================

