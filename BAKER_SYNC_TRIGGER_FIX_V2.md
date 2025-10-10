# Baker Auto-Sync Trigger Fix v2

## Issue
The baker auto-sync trigger was creating `baker_items` with `planned_quantity = 0`, which violates the check constraint `baker_production_items_planned_quantity_check`.

**Error:**
```
new row for relation "baker_items" violates check constraint "baker_production_items_planned_quantity_check"
Failing row contains: (52449, 7362, 485, 0, null, f, 2025-10-09 07:12:52.211929+00, 2025-10-09 07:12:52.211929+00, 0.85, 0)
```

## Root Cause
When products are removed from orders or order quantities are reduced to 0, the trigger still tried to insert/update `baker_items` with `planned_quantity = 0`, which violates the database constraint.

## Fix (v2)
The updated trigger now:

1. **Filters at query level**: Added `HAVING SUM(oi.quantity) > 0` to only process products with non-zero quantities
2. **Conditional UPSERT**: Added `WHERE EXCLUDED.planned_quantity > 0` to only update when quantity is positive
3. **Cleanup zero quantities**: Added explicit cleanup step to delete baker_items with `planned_quantity <= 0`
4. **Active orders only**: Modified cleanup logic to only consider orders with `oi.quantity > 0`

### Key Changes

#### 1. Query Filter (Lines 139-145 & 201-207)
```sql
GROUP BY oi.product_id
HAVING SUM(oi.quantity) > 0  -- FIX: Only include items with quantity > 0
```

#### 2. Conditional UPDATE (Line 174)
```sql
ON CONFLICT (production_id, product_id) 
DO UPDATE SET
    planned_quantity = EXCLUDED.planned_quantity,
    recipe_quantity = EXCLUDED.recipe_quantity,
    updated_at = NOW()
WHERE EXCLUDED.planned_quantity > 0;  -- FIX: Only update if quantity > 0
```

#### 3. Cleanup Zero Quantities (Lines 224-230)
```sql
-- Clean up baker_items with zero or negative quantities
DELETE FROM baker_items bi
WHERE bi.production_id IN (
    SELECT b.id 
    FROM bakers b 
    WHERE b.date = target_date
)
AND (bi.planned_quantity <= 0 OR bi.planned_quantity IS NULL);
```

#### 4. Active Orders Filter (Line 245)
```sql
AND oi.quantity > 0  -- FIX: Only consider active orders with quantity > 0
```

## Deployment Steps

1. **Backup current data** (optional but recommended):
   ```sql
   -- Check current baker_items with zero quantities
   SELECT COUNT(*) FROM baker_items WHERE planned_quantity <= 0;
   ```

2. **Run the fixed SQL**:
   - Open Supabase SQL Editor
   - Copy contents of: `src/sql/create_baker_auto_sync_trigger_fixed_v2.sql`
   - Execute the SQL

3. **Clean up existing zero-quantity items** (if any):
   ```sql
   -- Remove baker_items with zero or negative quantities
   DELETE FROM baker_items WHERE planned_quantity <= 0 OR planned_quantity IS NULL;
   ```

4. **Verify the fix**:
   ```sql
   -- Check for any remaining zero-quantity items
   SELECT * FROM baker_items WHERE planned_quantity <= 0 OR planned_quantity IS NULL;
   -- Should return 0 rows
   
   -- Test the manual sync function
   SELECT * FROM manual_sync_baker_productions(CURRENT_DATE);
   ```

## Testing

1. **Create a test order** for tomorrow with some products
2. **Verify baker_items** are created correctly with `planned_quantity > 0`
3. **Reduce order quantity to 0** for one product
4. **Verify** the corresponding `baker_item` is deleted (not updated to 0)
5. **Completely remove the order**
6. **Verify** all corresponding `baker_items` are cleaned up

## What This Prevents

- ❌ Creating `baker_items` with `planned_quantity = 0`
- ❌ Updating existing `baker_items` to `planned_quantity = 0`
- ❌ Orphaned `baker_items` when orders are cancelled/reduced

## What This Ensures

- ✅ Only `baker_items` with `planned_quantity > 0` are created/updated
- ✅ Zero-quantity items are automatically deleted
- ✅ Database constraints are respected
- ✅ Clean, accurate production planning data

## Related Files

- **Trigger SQL**: `src/sql/create_baker_auto_sync_trigger_fixed_v2.sql`
- **Previous version**: `src/sql/create_baker_auto_sync_trigger_fixed.sql`
- **Hook**: `src/hooks/useDailyIngredientConsumption.ts`
- **Components**: 
  - `src/components/DailyIngredientConsumption.tsx`
  - `src/components/DailyProductionPlanner.tsx`

