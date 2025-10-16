-- Add supplier_ingredient_name column to ingredient_supplier_codes table
-- This column stores the name of the ingredient as it appears in the supplier's system

ALTER TABLE ingredient_supplier_codes
ADD COLUMN IF NOT EXISTS supplier_ingredient_name TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN ingredient_supplier_codes.supplier_ingredient_name IS 'Name of the ingredient as it appears in the supplier''s catalog or system';

