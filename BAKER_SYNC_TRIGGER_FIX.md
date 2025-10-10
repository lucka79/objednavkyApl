# Baker Auto-Sync Trigger Fix

## Critical Issue Fixed

### ❌ Original Problem

The original trigger had this line:
```sql
pp.quantity as recipe_quantity
```

This was **WRONG** because:
- `pp.quantity` is the amount of recipe per **individual product** (e.g., 0.08 kg per rohlík)
- But `baker_items.recipe_quantity` should be the **total dough weight** needed

### Example of the Bug:

**Order:**
- 100 Rohlíky

**Product Part:**
- Rohlík uses 0.08 kg of "Těsto základní" per piece

**What the OLD trigger did:**
```sql
recipe_quantity = 0.08  -- WRONG! Just copied from product_parts
```

**What it SHOULD be:**
```sql
recipe_quantity = 100 pieces × 0.08 kg/piece = 8 kg  -- CORRECT!
```

## ✅ The Fix

Changed from:
```sql
pp.quantity as recipe_quantity
```

To:
```sql
SUM(pp.quantity * oi.quantity) as total_recipe_kg_for_product
```

### Full Calculation Flow:

1. **Order Items**: Get all orders for the date
2. **Calculate per Product**: `pp.quantity × oi.quantity`
   - Example: 0.08 kg/piece × 100 pieces = 8 kg
3. **Sum per Recipe**: `SUM(recipe_kg_for_all_products)`
   - If multiple products use same recipe, sum them up

## How to Deploy

### 1. Run in Supabase SQL Editor

```bash
# Execute the fixed trigger:
src/sql/create_baker_auto_sync_trigger_fixed.sql
```

### 2. Test the Trigger

```sql
-- Test: Add an order and see if baker production auto-creates
INSERT INTO orders (date, user_id, status) 
VALUES ('2025-10-20', 'your-user-id', 'pending')
RETURNING id;

-- Add order items
INSERT INTO order_items (order_id, product_id, quantity)
VALUES (YOUR_ORDER_ID, 123, 100);  -- 100 Rohlíky

-- Check if baker_items was created with correct recipe_quantity
SELECT 
    bi.product_id,
    p.name,
    bi.planned_quantity,
    bi.recipe_quantity,  -- Should be 8.0, not 0.08!
    r.name as recipe_name
FROM baker_items bi
JOIN products p ON bi.product_id = p.id
JOIN bakers b ON bi.production_id = b.id
JOIN recipes r ON b.recipe_id = r.id
WHERE b.date = '2025-10-20';
```

### 3. Manual Sync Function

The trigger includes a manual sync function you can call:

```sql
-- Sync a specific date
SELECT * FROM manual_sync_baker_productions('2025-10-20');

-- Returns:
-- created_count | updated_count | message
-- --------------+---------------+------------------------------------------
--            5  |             0 | Successfully synced baker productions...
```

## Integration with Daily Consumption

This fix ensures that when you click **"Z výroby"** (From Production) in the Daily Consumption tab:

✅ **Before Fix:**
- Pšen.mouka světlá T530: **54,990 kg** ❌ (Wrong!)

✅ **After Fix:**
- Pšen.mouka světlá T530: **~1,200 kg** ✅ (Realistic!)

## What the Trigger Does

### Automatic Sync on:
1. **Orders table changes** (INSERT, UPDATE date, DELETE)
2. **Order items changes** (INSERT, UPDATE quantity/product, DELETE)

### Only for:
- **Future dates** (today and beyond)
- **Recipes with orders** (ignores products without recipes)

### Actions:
1. **Creates** new baker productions if they don't exist
2. **Updates** existing productions if orders change
3. **Cleans up** baker_items that no longer have orders
4. **Removes** empty productions (no baker_items)

## Verification Query

To see what the trigger calculated:

```sql
SELECT 
    b.date,
    r.name as recipe_name,
    p.name as product_name,
    bi.planned_quantity as pieces,
    bi.recipe_quantity as dough_kg_needed,
    pp.quantity as kg_per_piece,
    -- Verify calculation:
    (bi.recipe_quantity / bi.planned_quantity) as calculated_kg_per_piece,
    -- Should match pp.quantity
    CASE 
        WHEN ABS((bi.recipe_quantity / bi.planned_quantity) - pp.quantity) < 0.01 
        THEN '✓ Correct' 
        ELSE '✗ Wrong' 
    END as verification
FROM baker_items bi
JOIN bakers b ON bi.production_id = b.id
JOIN recipes r ON b.recipe_id = r.id
JOIN products p ON bi.product_id = p.id
JOIN product_parts pp ON pp.product_id = bi.product_id AND pp.recipe_id = b.recipe_id
WHERE b.date >= CURRENT_DATE
ORDER BY b.date, r.name, p.name;
```

## Migration Steps

If you already have existing baker data with **wrong** recipe_quantity values:

```sql
-- Fix existing baker_items with incorrect recipe_quantity
UPDATE baker_items bi
SET recipe_quantity = (
    SELECT SUM(pp.quantity * oi.quantity)
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN product_parts pp ON oi.product_id = pp.product_id
    JOIN bakers b ON pp.recipe_id = b.recipe_id
    WHERE b.id = bi.production_id
    AND oi.product_id = bi.product_id
    AND o.date = b.date
),
updated_at = NOW()
WHERE EXISTS (
    SELECT 1 FROM bakers b WHERE b.id = bi.production_id AND b.date >= CURRENT_DATE
);

-- After fixing, re-calculate consumption
-- Go to Daily Consumption tab and click "Z výroby" for affected dates
```

## Benefits

✅ **Automatic**: No manual baker production creation needed  
✅ **Accurate**: Correct recipe_quantity for consumption tracking  
✅ **Real-time**: Updates as orders change  
✅ **Clean**: Removes outdated productions automatically  
✅ **Safe**: Only affects future dates  

## Files Created

- `src/sql/create_baker_auto_sync_trigger_fixed.sql` - Fixed trigger with correct calculations
- `BAKER_SYNC_TRIGGER_FIX.md` - This documentation

## Related Files

- `src/hooks/useDailyIngredientConsumption.ts` - Uses recipe_quantity for consumption calculation
- `src/hooks/useBakerSync.ts` - Manual sync from React app (can be deprecated if using trigger)
- `create_bakers_auto_update_trigger.sql` - Original trigger (to be replaced)
