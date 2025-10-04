-- Remove unique constraint to allow multiple codes per supplier for same ingredient
-- This allows the same supplier to have multiple product codes for the same ingredient

-- First, check if the unique constraint exists
DO $$
BEGIN
    -- Check if the unique constraint exists and drop it
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'ingredient_supplier_codes_ingredient_id_supplier_id_key'
        AND table_name = 'ingredient_supplier_codes'
    ) THEN
        ALTER TABLE ingredient_supplier_codes 
        DROP CONSTRAINT ingredient_supplier_codes_ingredient_id_supplier_id_key;
        
        RAISE NOTICE 'Dropped unique constraint on ingredient_id, supplier_id';
    ELSE
        RAISE NOTICE 'Unique constraint does not exist or has different name';
    END IF;
END $$;

-- Add a new unique constraint on ingredient_id, supplier_id, product_code
-- This ensures no duplicate product codes for the same supplier and ingredient
ALTER TABLE ingredient_supplier_codes 
ADD CONSTRAINT ingredient_supplier_codes_unique_product_code 
UNIQUE (ingredient_id, supplier_id, product_code);

-- Add an index for better performance on common queries
CREATE INDEX IF NOT EXISTS idx_ingredient_supplier_codes_ingredient_supplier 
ON ingredient_supplier_codes (ingredient_id, supplier_id);

-- Add an index for active supplier codes
CREATE INDEX IF NOT EXISTS idx_ingredient_supplier_codes_active 
ON ingredient_supplier_codes (ingredient_id, is_active) 
WHERE is_active = true;
