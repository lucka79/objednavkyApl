# Daily Ingredient Consumption Setup

This document explains the daily ingredient consumption tracking feature and how to set it up.

## Overview

The Daily Ingredient Consumption feature tracks how much of each ingredient is used daily based on orders. It distinguishes between:

- **Recipe-based consumption**: Ingredients used through product recipes
- **Direct consumption**: Ingredients directly linked to products (not through recipes)

## Database Setup

### 1. Run the SQL Migration

Execute the SQL file to create the required table:

```bash
# Using Supabase CLI
supabase db push --sql src/sql/create_daily_ingredient_consumption.sql

# Or run it directly in Supabase SQL Editor
```

The migration creates:
- `daily_ingredient_consumption` table
- Indexes for performance
- RLS policies for security
- Automatic `updated_at` trigger

### 2. Table Structure

```sql
daily_ingredient_consumption (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  ingredient_id BIGINT NOT NULL REFERENCES ingredients(id),
  product_id BIGINT REFERENCES products(id),
  quantity NUMERIC NOT NULL DEFAULT 0,
  source TEXT NOT NULL CHECK (source IN ('recipe', 'direct')),
  order_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(date, ingredient_id, product_id, source)
)
```

## How It Works

The system supports **two calculation methods**:

### Method 1: From Orders (Order-Based)

1. **Fetch Orders**: Gets all order items for the selected date
2. **Get Product Parts**: Retrieves ingredient relationships for each product
3. **Get Recipe Ingredients**: Fetches ingredients from recipes referenced in product_parts
4. **Calculate Consumption**: 
   - **Direct ingredients**: `order_quantity × ingredient_quantity_per_product`
   - **Recipe ingredients**: `order_quantity × product_part_quantity × recipe_ingredient_quantity`
5. **Aggregate**: Groups by date, ingredient, product, and source
6. **Save**: Stores in `daily_ingredient_consumption` table

### Method 2: From Production (Production-Based) ⭐ RECOMMENDED

1. **Fetch Production**: Gets all baker productions (`bakers` table) for the selected date
2. **Get Baker Items**: Retrieves actual production items (`baker_items` table)
3. **Get Recipe Ingredients**: Fetches ingredients for each recipe
4. **Calculate Consumption**: 
   - Uses `recipe_quantity` (kg of recipe actually used in production)
   - **Formula**: `recipe_kg_used × ingredient_quantity_per_recipe_kg`
5. **Aggregate**: Groups by date, ingredient, product, and source
6. **Save**: Stores in `daily_ingredient_consumption` table

**Why use Production-Based?**
- ✅ More accurate - based on what was actually produced
- ✅ Uses real production quantities from bakers
- ✅ Reflects actual ingredient consumption
- ✅ Better for inventory reconciliation

### Example - Order-Based

**Order:**
- Product: "Rohlík" × 100 pieces
- Date: 2025-10-08

**Product Parts:**
- Recipe: "Těsto základní" (quantity: 0.08 kg per product)
  - Mouka: 0.6 kg per recipe kg
  - Voda: 0.3 kg per recipe kg
  
**Calculation:**
- Mouka: 100 pieces × 0.08 kg/piece × 0.6 kg/recipe_kg = **4.8 kg**
- Voda: 100 pieces × 0.08 kg/piece × 0.3 kg/recipe_kg = **2.4 kg**
- Source: 'recipe'

### Example - Production-Based ⭐

**Baker Production:**
- Recipe: "Těsto základní"
- Date: 2025-10-08

**Baker Item:**
- Product: "Rohlík"
- Recipe Quantity: 6.5 kg (actual kg of recipe used)
- Planned: 100 pieces
- Completed: 95 pieces

**Recipe Ingredients:**
- Mouka: 0.6 kg per recipe kg
- Voda: 0.3 kg per recipe kg

**Calculation:**
- Mouka: 6.5 kg × 0.6 = **3.9 kg**
- Voda: 6.5 kg × 0.3 = **1.95 kg**
- Source: 'recipe'
- Result: More accurate as it uses actual recipe quantity used!

## Features

### Daily Consumption View

Navigate to: **Admin → Ingredients Overview → Daily Consumption Tab**

**Displays:**
- Summary statistics (total ingredients, products, consumption items)
- Date selector
- Grouped view by ingredient showing:
  - Recipe-based consumption
  - Direct consumption
  - Total consumption
  - Products that used the ingredient

**Actions:**
- **Z objednávek** (From Orders): Calculate from order data
- **Z výroby** (From Production): Calculate from production data ⭐ RECOMMENDED
- **Měsíc (obj.)**: Calculate entire month from orders
- **Měsíc (výr.)**: Calculate entire month from production ⭐ RECOMMENDED
- View historical consumption data

**Button Colors:**
- Gray (outline): Order-based calculation
- Orange: Production-based calculation (recommended)

### Monthly Consumption View

Navigate to: **Admin → Ingredients Overview → Monthly Consumption Tab**

**Displays:**
- Consumption aggregated by month
- Shows current month by default
- Filterable by month, ingredient name, category, supplier
- Export to CSV functionality

## Usage

### Calculate Daily Consumption from Orders

```typescript
import { useCalculateDailyConsumption } from "@/hooks/useDailyIngredientConsumption";

const calculateDaily = useCalculateDailyConsumption();

// Calculate for specific date
await calculateDaily.mutateAsync(new Date("2025-10-08"));
```

### Calculate Daily Consumption from Production ⭐ RECOMMENDED

```typescript
import { useCalculateDailyConsumptionFromProduction } from "@/hooks/useDailyIngredientConsumption";

const calculateFromProduction = useCalculateDailyConsumptionFromProduction();

// Calculate from production data for specific date
await calculateFromProduction.mutateAsync(new Date("2025-10-08"));
```

### Calculate Monthly Consumption from Orders

```typescript
import { useCalculateMonthlyConsumption } from "@/hooks/useDailyIngredientConsumption";

const calculateMonthly = useCalculateMonthlyConsumption();

// Calculate for entire month
const startDate = new Date(2025, 9, 1); // October 1, 2025
const endDate = new Date(2025, 9, 31); // October 31, 2025

await calculateMonthly.mutateAsync({ startDate, endDate });
```

### Calculate Monthly Consumption from Production ⭐ RECOMMENDED

```typescript
import { useCalculateMonthlyConsumptionFromProduction } from "@/hooks/useDailyIngredientConsumption";

const calculateMonthlyProduction = useCalculateMonthlyConsumptionFromProduction();

// Calculate entire month from production data
const startDate = new Date(2025, 9, 1); // October 1, 2025
const endDate = new Date(2025, 9, 31); // October 31, 2025

await calculateMonthlyProduction.mutateAsync({ startDate, endDate });
```

### View Consumption Data

```typescript
import { useDailyIngredientConsumption } from "@/hooks/useDailyIngredientConsumption";

const { data, isLoading, error } = useDailyIngredientConsumption(new Date());

// data contains:
// - date: string
// - items: DailyConsumptionItem[]
// - totalIngredients: number
// - totalProducts: number
```

## API Hooks

### `useDailyIngredientConsumption(date: Date)`

Fetches consumption data for a specific date from the database.

**Returns:**
```typescript
{
  date: string;
  items: DailyConsumptionItem[];
  totalIngredients: number;
  totalProducts: number;
}
```

### `useCalculateDailyConsumption()`

Calculates and saves consumption for a specific date **from orders**.

**Usage:**
```typescript
const calculateDaily = useCalculateDailyConsumption();
await calculateDaily.mutateAsync(date);
```

**Data Source:** `order_items` → `product_parts` → `recipe_ingredients`

### `useCalculateDailyConsumptionFromProduction()` ⭐

Calculates and saves consumption for a specific date **from production data**.

**Usage:**
```typescript
const calculateFromProduction = useCalculateDailyConsumptionFromProduction();
await calculateFromProduction.mutateAsync(date);
```

**Data Source:** `bakers` → `baker_items` → `recipe_ingredients`

**Advantages:**
- Uses actual `recipe_quantity` (kg of recipe used)
- More accurate than order-based
- Better for reconciliation with actual inventory

### `useCalculateMonthlyConsumption()`

Calculates consumption for all days in a date range **from orders**.

**Usage:**
```typescript
const calculateMonthly = useCalculateMonthlyConsumption();
await calculateMonthly.mutateAsync({ startDate, endDate });
```

### `useCalculateMonthlyConsumptionFromProduction()` ⭐

Calculates consumption for all days in a date range **from production data**.

**Usage:**
```typescript
const calculateMonthlyProduction = useCalculateMonthlyConsumptionFromProduction();
await calculateMonthlyProduction.mutateAsync({ startDate, endDate });
```

## Performance Considerations

### Pagination

The calculation hooks use pagination to handle large datasets:
- Order items: Fetched in batches of 1000
- Product IDs: Chunked into groups of 100

### Indexes

The following indexes are created for optimal query performance:
- `idx_daily_ingredient_consumption_date`
- `idx_daily_ingredient_consumption_ingredient_id`
- `idx_daily_ingredient_consumption_product_id`
- `idx_daily_ingredient_consumption_date_ingredient`

### Caching

React Query caching is configured:
- Stale time: 5 minutes
- Automatic invalidation after calculations

## Troubleshooting

### No Data Showing

1. Check if orders exist for the selected date
2. Ensure products have `product_parts` configured
3. Verify ingredients are linked in `product_parts`
4. Run "Calculate Daily" to generate consumption data

### Calculation Errors

1. Check console logs for detailed error messages
2. Verify database permissions (RLS policies)
3. Ensure all foreign key relationships are valid
4. Check that `product_parts` table has valid data

### Performance Issues

1. Ensure all indexes are created
2. Consider running calculations during off-peak hours
3. Use monthly calculation for batch processing
4. Check Supabase query performance in dashboard

## Future Enhancements

Potential improvements:
- Automatic daily calculation via cron job/scheduled function
- Historical comparison charts
- Alerts for unusual consumption patterns
- Integration with inventory management
- Cost calculation based on ingredient prices
- Waste tracking
- Predictive analytics for ingredient ordering

## Related Files

- `/src/sql/create_daily_ingredient_consumption.sql` - Database schema
- `/src/hooks/useDailyIngredientConsumption.ts` - Data hooks
- `/src/components/DailyIngredientConsumption.tsx` - Daily view component
- `/src/components/MonthlyIngredientConsumption.tsx` - Monthly view component
- `/src/hooks/useMonthlyIngredientConsumption.ts` - Monthly calculation hook

