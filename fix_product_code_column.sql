-- Fix product_code column to preserve leading zeros
-- Change from INTEGER/NUMERIC to TEXT to support codes like "0101"

-- First, add a new column with TEXT type
ALTER TABLE ingredients ADD COLUMN product_code_text TEXT;

-- Copy existing data, converting to text and padding with zeros if needed
UPDATE ingredients 
SET product_code_text = CASE 
  WHEN product_code IS NOT NULL THEN LPAD(product_code::TEXT, 4, '0')
  ELSE NULL 
END;

-- Drop the old column
ALTER TABLE ingredients DROP COLUMN product_code;

-- Rename the new column to the original name
ALTER TABLE ingredients RENAME COLUMN product_code_text TO product_code;

-- Add a comment to document the change
COMMENT ON COLUMN ingredients.product_code IS 'Product code from supplier (supports leading zeros like 0101)';
