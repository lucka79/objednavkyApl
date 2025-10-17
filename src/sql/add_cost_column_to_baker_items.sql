-- Add cost column to baker_items table to track ingredient costs per product

-- Add cost column (nullable, default to 0)
ALTER TABLE baker_items 
ADD COLUMN IF NOT EXISTS cost DECIMAL(10, 2) DEFAULT 0;

-- Add comment to explain the column
COMMENT ON COLUMN baker_items.cost IS 'Ingredient cost per unit of this product (calculated from recipes and direct ingredients)';

-- Create index for cost-based queries
CREATE INDEX IF NOT EXISTS idx_baker_items_cost ON baker_items(cost);

-- Optionally update existing records to have cost = 0 if NULL
UPDATE baker_items 
SET cost = 0 
WHERE cost IS NULL;

