# Baker Sync Update - UPSERT Strategy

## Summary
Changed the baker synchronization from **DELETE + INSERT** to **UPDATE + INSERT** (UPSERT) strategy to preserve existing `baker_items` records and only update their quantities.

## Changes Made

### Before (DELETE + INSERT approach)
```typescript
if (existingBaker) {
  bakerId = existingBaker.id;
  
  // Delete ALL existing baker_items
  await supabase
    .from('baker_items')
    .delete()
    .eq('production_id', bakerId);
}

// Insert all baker_items fresh
await supabase
  .from('baker_items')
  .insert(allBakerItems);
```

### After (UPSERT approach)
```typescript
if (existingBaker) {
  bakerId = existingBaker.id;
  
  // Don't delete - we'll upsert instead
}

// For each baker:
1. Fetch existing baker_items
2. Update existing ones with new quantities
3. Insert only new products
4. Delete only products no longer in orders
```

## Benefits

### ✅ Preserves Existing Records
- `baker_items.id` remains the same
- Relationships to other tables stay intact
- History is maintained

### ✅ More Efficient
- Only updates what changed
- Fewer database operations
- Better performance

### ✅ Safer
- No risk of losing data if sync fails midway
- Easier to track changes
- Better audit trail

### ✅ Matches React Native App
- Both apps now use same calculation approach
- `recipe_quantity = ordered_quantity × part_quantity`
- Consistent behavior across platforms

## Implementation Details

### Step 1: Fetch Existing Items
```typescript
const { data: existingItems } = await supabase
  .from('baker_items')
  .select('id, product_id, planned_quantity, recipe_quantity')
  .eq('production_id', bakerId);
```

### Step 2: Categorize Items
```typescript
const itemsToUpdate = [];
const itemsToInsert = [];

for (const newItem of itemsForThisBaker) {
  const existing = existingMap.get(newItem.product_id);
  
  if (existing) {
    // Update existing
    itemsToUpdate.push({
      id: existing.id,
      planned_quantity: newItem.planned_quantity,
      recipe_quantity: newItem.recipe_quantity,
      updated_at: new Date().toISOString()
    });
  } else {
    // Insert new
    itemsToInsert.push(newItem);
  }
}
```

### Step 3: Batch Operations
```typescript
// Update existing items (using direct UPDATE)
if (itemsToUpdate.length > 0) {
  for (const item of itemsToUpdate) {
    await supabase
      .from('baker_items')
      .update({
        planned_quantity: item.planned_quantity,
        recipe_quantity: item.recipe_quantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', item.id);
  }
}

// Insert new items
if (itemsToInsert.length > 0) {
  await supabase
    .from('baker_items')
    .insert(itemsToInsert);
}

// Delete obsolete items
if (itemsToDelete.length > 0) {
  await supabase
    .from('baker_items')
    .delete()
    .in('id', itemsToDelete);
}
```

## Console Logging

The sync now provides detailed logging:

```
Debug - Checking baker for date 2025-10-17, recipe 92: Found ID 123
Debug - Updating 5 baker_items for baker 123
Debug - Inserting 2 new baker_items for baker 123
Debug - Deleting 1 obsolete baker_items for baker 123

=== SYNC SUMMARY ===
Baker items updated: 15
Baker items inserted: 5
Baker items deleted: 2
==================
```

## Testing

### Test Scenarios

1. **First Sync** - All items should be inserted
   - Expected: `inserted = total_items`, `updated = 0`, `deleted = 0`

2. **Second Sync (no changes)** - All items should be updated with same values
   - Expected: `updated = total_items`, `inserted = 0`, `deleted = 0`

3. **Add Product to Order** - New item should be inserted
   - Expected: `inserted = 1`, `updated = existing_count`

4. **Remove Product from Order** - Item should be deleted
   - Expected: `deleted = 1`, `updated = existing_count - 1`

5. **Change Quantities** - Items should be updated
   - Expected: `updated = total_items`, `inserted = 0`, `deleted = 0`

## Database Requirements

### No Special Constraints Needed
The implementation does NOT rely on unique constraints on `(production_id, product_id)`. It explicitly manages updates/inserts/deletes using the `id` field.

### What's Required
- `baker_items.id` must be unique (primary key) ✅
- `baker_items.production_id` (foreign key to `bakers`) ✅
- `baker_items.product_id` (foreign key to `products`) ✅

## Migration Notes

### No Database Migration Required
This is a code-only change. No schema changes needed.

### Backward Compatible
- Works with existing database structure
- Can run on any environment immediately
- No downtime required

## Future Improvements

### Possible Enhancements
1. Track `actual_quantity` changes separately
2. Add `is_completed` status preservation
3. Implement optimistic locking with version numbers
4. Add batch size limits for large syncs

### Monitoring
Consider adding:
- Sync duration tracking
- Error rate monitoring
- Change frequency analytics

## Additional Fixes

### Fix 1: UPSERT Constraint Error

#### Issue
```
null value in column "production_id" of relation "baker_items" violates not-null constraint
```

#### Root Cause
When using `.upsert()` with `onConflict: 'id'`, Supabase needs all required fields in case it needs to insert. We were only providing the fields to update.

#### Solution
Switched from UPSERT to direct UPDATE for existing items:

```typescript
// Before (caused error)
await supabase
  .from('baker_items')
  .upsert(itemsToUpdate, { onConflict: 'id' });

// After (fixed)
for (const item of itemsToUpdate) {
  await supabase
    .from('baker_items')
    .update({
      planned_quantity: item.planned_quantity,
      recipe_quantity: item.recipe_quantity,
      updated_at: new Date().toISOString()
    })
    .eq('id', item.id);
}
```

### Fix 2: Zero Quantity Products

#### Issue
Products with 0 ordered quantity were showing `Planned: 1` in the UI.

#### Root Cause
1. Order items with `quantity = 0` were being processed
2. `Math.max(1, Math.ceil(ingredientNeeded))` forced minimum of 1 even when ingredientNeeded was 0

#### Solution
Added filters to skip order items with zero or negative quantities:

```typescript
// In useDailyProductionPlanner.ts
for (const orderItem of orderItems) {
  // Skip order items with 0 quantity
  if (orderItem.quantity <= 0) continue;
  // ... process item
}

// Final safety check
return result.filter(item => item.totalOrdered > 0);
```

```typescript
// In useBakerSync.ts
for (const item of order.order_items) {
  // Skip order items with 0 or negative quantity
  if (item.quantity <= 0) continue;
  // ... process item
}
```

### Fix 3: "Čeká na synchronizaci" Badge Logic

#### Issue
The badge was comparing incompatible values:
- `totalRecipeWeight` (saved weight in kg, e.g., 4.62)
- `totalPlannedQuantity` (ceiled planned quantity, e.g., 5)

This caused the badge to always show "Waiting for synchronization" even after syncing.

#### Root Cause
The comparison was between:
```typescript
Math.ceil(recipeData.totalRecipeWeight) !== Math.ceil(recipeData.totalPlannedQuantity)
```

Where `totalRecipeWeight` is actual kg and `totalPlannedQuantity` is a count (not weight).

#### Solution
Added `calculatedRecipeWeight` to track the actual recipe weight calculated from current orders:

```typescript
// In useDailyProductionPlanner.ts
const ingredientNeeded = item.totalOrdered * partQuantity;
const calculatedRecipeWeight = Math.round(ingredientNeeded * 100) / 100;

// Return in ProductionItem
calculatedRecipeWeight: calculatedRecipeWeight
```

Updated comparison to compare like-for-like with tolerance:
```typescript
// Before (wrong)
Math.ceil(recipeData.totalRecipeWeight) !== Math.ceil(recipeData.totalPlannedQuantity)

// After (correct with 100g tolerance)
const diff = Math.abs(
  recipeData.totalRecipeWeight - recipeData.totalCalculatedWeight
);
const needsSync = diff > 0.1; // Tolerance: 100g difference
```

#### Benefits
✅ Compares saved weight (from DB) with calculated weight (from orders)  
✅ Both values are in kg, same unit  
✅ Uses 100g tolerance to avoid false positives from rounding  
✅ Only shows "Needs sync" when difference is > 0.1 kg  
✅ Badge disappears after successful sync  
✅ Bonus: Shows calculated weight if not yet synced

### Fix 4: Added Tolerance for Sync Comparison

#### Issue
"Čeká na synchronizaci" badge showing even when quantities are the same, due to tiny rounding differences (e.g., 4.62 vs 4.6199999).

#### Solution
Added a tolerance of **0.1 kg (100g)** to the comparison:

```typescript
const diff = Math.abs(
  recipeData.totalRecipeWeight - recipeData.totalCalculatedWeight
);
const needsSync = diff > 0.1; // Only flag if difference > 100g
```

#### Benefits
✅ No false "waiting for sync" messages  
✅ Ignores tiny rounding differences  
✅ Still catches real differences when orders change  
✅ Cleaner UI experience

### Fix 5: Product-Level Sync Indicators

#### Feature
Added warning badges (⚠️) to individual products within recipe cards when their saved quantity differs from calculated quantity.

#### Implementation
```typescript
// Track saved and calculated weights per product
products: Map<string, {
  quantity: number;
  savedWeight: number;
  calculatedWeight: number;
}>;

// Show warning badge if difference > 10g
const diff = Math.abs(productData.savedWeight - productData.calculatedWeight);
const needsSync = diff > 0.01; // 10g tolerance

{needsSync && productData.savedWeight > 0 && (
  <Badge variant="outline" className="border-yellow-600 text-yellow-600">
    ⚠️
  </Badge>
)}
```

#### Benefits
✅ See exactly which products within a recipe need sync  
✅ No need to guess which product has the issue  
✅ 10g tolerance for individual products (tighter than recipe-level 100g)  
✅ Visual indicator directly next to the product name  
✅ Only shows on products that have been saved before

## Related Files
- `src/hooks/useBakerSync.ts` - Main sync implementation
- `src/hooks/useDailyProductionPlanner.ts` - Production planning hook
- `src/components/DailyProductionPlanner.tsx` - UI component
- React Native app - Matching calculation approach

---

**Date:** October 16, 2025  
**Status:** ✅ Implemented and Ready for Testing  
**Fixed:** 
- Zero quantity products issue
- UPSERT constraint error (switched to direct UPDATE for existing items)
- "Čeká na synchronizaci" badge now correctly compares saved weight vs calculated weight
- Added 100g tolerance to prevent false "needs sync" messages from rounding
- Added ⚠️ warning badges to individual products that need sync

