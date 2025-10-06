# Ingredient Quantity Tracking Setup

This document explains how to set up and use the ingredient quantity tracking system in your application.

## Database Setup

### 1. Run the Database Migration

Execute the SQL migration file to create the necessary tables and functions:

```bash
psql -h your-supabase-host -p 5432 -d postgres -U postgres -f create_ingredient_quantities_table.sql
```

### 2. Database Structure

The system creates the following database components:

#### Table: `ingredient_quantities`
- `id`: UUID primary key
- `ingredient_id`: Foreign key to ingredients table
- `current_quantity`: Current stock level (decimal)
- `unit`: Unit of measurement
- `last_updated`: Timestamp of last update
- `created_at`, `updated_at`: Standard timestamps

#### Functions:
- `update_ingredient_quantity()`: Updates quantity for an ingredient
- `get_ingredient_quantity()`: Gets current quantity of an ingredient
- `initialize_ingredient_quantities()`: Creates quantity records for existing ingredients

## Usage

### 1. Initialize Quantities

When you first set up the system, run the initialization to create quantity records for existing ingredients:

```typescript
import { initializeIngredientQuantities } from '@/lib/quantityManager';

// Initialize quantities for all existing ingredients
await initializeIngredientQuantities();
```

### 2. Update Quantities for Transfers

When a transfer is created, decrease the quantities:

```typescript
import { updateQuantitiesForTransfer } from '@/lib/quantityManager';

// Example: Transfer items
const transferItems = [
  { ingredient_id: 1, quantity: 10 },
  { ingredient_id: 2, quantity: 5 }
];

await updateQuantitiesForTransfer(transferItems);
```

### 3. Update Quantities for Invoices

When an invoice is received, increase the quantities:

```typescript
import { updateQuantitiesForInvoice } from '@/lib/quantityManager';

// Example: Invoice items
const invoiceItems = [
  { ingredient_id: 1, quantity: 20 },
  { ingredient_id: 2, quantity: 15 }
];

await updateQuantitiesForInvoice(invoiceItems);
```

### 4. Get Current Quantity

```typescript
import { getIngredientQuantity } from '@/lib/quantityManager';

const currentQuantity = await getIngredientQuantity(ingredientId);
```

## Integration Points

### 1. Transfer Creation

In your transfer creation logic, add quantity updates:

```typescript
// After creating a transfer
const transferItems = transfer.items.map(item => ({
  ingredient_id: item.ingredient_id,
  quantity: item.quantity
}));

await updateQuantitiesForTransfer(transferItems);
```

### 2. Invoice Processing

In your invoice processing logic, add quantity updates:

```typescript
// After processing a received invoice
const invoiceItems = invoice.items.map(item => ({
  ingredient_id: item.ingredient_id,
  quantity: item.quantity
}));

await updateQuantitiesForInvoice(invoiceItems);
```

### 3. Component Integration

The `IngredientQuantityOverview` component now uses real data from the database:

```typescript
import { useIngredientQuantities } from '@/hooks/useIngredientQuantities';

function MyComponent() {
  const { data: quantities, isLoading, error } = useIngredientQuantities();
  
  // Use quantities data...
}
```

## Features

### 1. Real-time Quantity Tracking
- Automatic quantity updates for transfers and invoices
- Prevents negative quantities
- Tracks last update timestamp

### 2. Low Stock Alerts
- Automatically identifies ingredients with low stock (< 10 units)
- Color-coded status indicators
- Dedicated low stock view

### 3. Comprehensive Overview
- Total inventory value calculation
- Average quantities
- Category and supplier filtering
- Search functionality

### 4. Database Functions
- `update_ingredient_quantity()`: Safe quantity updates
- `get_ingredient_quantity()`: Get current stock
- `initialize_ingredient_quantities()`: Setup for existing ingredients

## Error Handling

The system includes comprehensive error handling:

- Database constraint violations
- Negative quantity prevention
- Missing ingredient handling
- Network error recovery

## Security

- Row Level Security (RLS) enabled
- Authenticated user access only
- Secure function execution
- Input validation

## Performance

- Indexed database queries
- Efficient filtering
- Optimized data fetching
- Minimal database calls

## Future Enhancements

Potential improvements for the quantity tracking system:

1. **Minimum Stock Levels**: Set custom minimum stock levels per ingredient
2. **Reorder Points**: Automatic reorder suggestions
3. **Quantity History**: Track quantity changes over time
4. **Batch Updates**: Bulk quantity operations
5. **Notifications**: Low stock alerts and notifications
6. **Reporting**: Advanced inventory reports and analytics
