# Foreign Key CASCADE DELETE Fix

## Problem
Unable to delete orders because of foreign key constraint errors:
```
Key (id)=(15149) is still referenced from table "order_items"
constraint: order_items_order_id_fkey
```

## Root Cause
Foreign key constraints were created with the default behavior (`ON DELETE RESTRICT`), which prevents deletion of parent records when child records exist.

## Solution
Change foreign key constraints to use `ON DELETE CASCADE`, which automatically deletes child records when the parent is deleted.

## Affected Tables

### 1. order_items → orders
**Issue**: Can't delete orders that have order_items  
**Fix**: When order is deleted, automatically delete all its order_items  
**Constraint**: `order_items_order_id_fkey`

### 2. baker_items → bakers
**Issue**: Can't delete baker productions that have baker_items  
**Fix**: When baker production is deleted, automatically delete all its baker_items  
**Constraint**: `baker_items_production_id_fkey`

### 3. daily_ingredient_consumption → ingredients
**Issue**: Can't delete ingredients that have consumption records  
**Fix**: When ingredient is deleted, automatically delete all its consumption records  
**Constraint**: `daily_ingredient_consumption_ingredient_id_fkey`

### 4. daily_ingredient_consumption → products
**Issue**: Can't delete products that have consumption records  
**Fix**: When product is deleted, automatically delete all its consumption records  
**Constraint**: `daily_ingredient_consumption_product_id_fkey`

## Deployment Options

### Option 1: Quick Fix (Just Orders)
If you only need to fix the order deletion issue:

```sql
-- Run: src/sql/fix_order_items_cascade_delete.sql
```

This only fixes the `order_items` constraint.

### Option 2: Comprehensive Fix (Recommended)
Fix all foreign key constraints at once:

```sql
-- Run: src/sql/fix_all_cascade_deletes.sql
```

This fixes all 4 constraints mentioned above.

## Deployment Steps

1. **Choose which SQL file to run** (Option 2 recommended)

2. **Run in Supabase SQL Editor**:
   - Open Supabase Dashboard
   - Go to SQL Editor
   - Copy contents of chosen SQL file
   - Execute

3. **Verify constraints**:
   ```sql
   SELECT 
       conname AS constraint_name,
       conrelid::regclass AS table_name,
       confrelid::regclass AS referenced_table,
       CASE confdeltype
           WHEN 'c' THEN 'CASCADE ✅'
           WHEN 'r' THEN 'RESTRICT ❌'
           WHEN 'a' THEN 'NO ACTION ❌'
       END AS delete_action
   FROM pg_constraint
   WHERE conrelid::regclass::text IN ('order_items', 'baker_items', 'daily_ingredient_consumption')
   AND confrelid IS NOT NULL;
   ```

4. **Test deletion**:
   ```sql
   -- Create test order
   INSERT INTO orders (date, user_id, total) 
   VALUES (CURRENT_DATE, (SELECT id FROM profiles LIMIT 1), 100) 
   RETURNING id;
   
   -- Add test order item (use the returned id)
   INSERT INTO order_items (order_id, product_id, quantity, price, vat)
   VALUES (
       <order_id_from_above>, 
       (SELECT id FROM products LIMIT 1), 
       1, 10, 21
   );
   
   -- Try to delete the order (should work now)
   DELETE FROM orders WHERE id = <order_id_from_above>;
   -- Should succeed and automatically delete the order_item too
   ```

## Behavior After Fix

### Before (RESTRICT):
```
DELETE FROM orders WHERE id = 15149;
❌ ERROR: Key (id)=(15149) is still referenced from table "order_items"
```

### After (CASCADE):
```
DELETE FROM orders WHERE id = 15149;
✅ SUCCESS: Deleted 1 order and automatically deleted all its order_items
```

## Important Notes

### CASCADE DELETE Implications

**✅ Pros:**
- Can delete parent records without errors
- Maintains referential integrity automatically
- Cleaner, more intuitive behavior
- Prevents orphaned child records

**⚠️ Considerations:**
- Deletion is permanent and cannot be undone
- Make sure you want to delete child records too
- Consider soft delete (status flag) for important records

### Safe Deletion Practices

Even with CASCADE, follow these best practices:

1. **Use transactions for bulk deletes**:
   ```sql
   BEGIN;
   DELETE FROM orders WHERE date < '2024-01-01';
   -- Review what was deleted
   SELECT * FROM orders WHERE date < '2024-01-01';
   -- If looks good:
   COMMIT;
   -- If not:
   ROLLBACK;
   ```

2. **Archive before deleting**:
   ```sql
   -- Create archive table
   CREATE TABLE orders_archive AS 
   SELECT * FROM orders WHERE date < '2024-01-01';
   
   -- Then delete
   DELETE FROM orders WHERE date < '2024-01-01';
   ```

3. **Use soft delete for critical data**:
   ```sql
   -- Add deleted_at column
   ALTER TABLE orders ADD COLUMN deleted_at TIMESTAMP;
   
   -- "Delete" by updating
   UPDATE orders SET deleted_at = NOW() WHERE id = 15149;
   
   -- Query only active records
   SELECT * FROM orders WHERE deleted_at IS NULL;
   ```

## Monitoring

After deployment, monitor for:

1. **Accidental deletions**:
   ```sql
   -- Check deletion activity
   SELECT schemaname, tablename, n_tup_del 
   FROM pg_stat_user_tables 
   WHERE n_tup_del > 0
   ORDER BY n_tup_del DESC;
   ```

2. **Orphaned records** (should be none now):
   ```sql
   -- Check for orphaned order_items (should return 0)
   SELECT COUNT(*) 
   FROM order_items oi 
   WHERE NOT EXISTS (
       SELECT 1 FROM orders o WHERE o.id = oi.order_id
   );
   ```

## Rollback (If Needed)

To revert to RESTRICT behavior:

```sql
-- Revert order_items
ALTER TABLE order_items 
DROP CONSTRAINT order_items_order_id_fkey;

ALTER TABLE order_items 
ADD CONSTRAINT order_items_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES orders(id) 
ON DELETE RESTRICT;

-- Repeat for other tables if needed
```

## Related Files

- **Quick Fix**: `src/sql/fix_order_items_cascade_delete.sql`
- **Comprehensive Fix**: `src/sql/fix_all_cascade_deletes.sql`
- **Documentation**: `CASCADE_DELETE_FIX.md` (this file)

## Recommendation

Use the **comprehensive fix** (`fix_all_cascade_deletes.sql`) because:
1. Fixes all potential CASCADE DELETE issues at once
2. Prevents similar errors in the future
3. More consistent database behavior
4. No additional risk vs. partial fix

CASCADE DELETE is the standard and expected behavior for parent-child relationships in most applications.
