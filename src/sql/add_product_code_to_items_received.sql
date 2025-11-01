-- Add product_code column to items_received table
-- This column stores the product code from ingredient_supplier_codes for the supplier that issued the invoice

ALTER TABLE public.items_received
ADD COLUMN IF NOT EXISTS product_code VARCHAR(255);

-- Add comment for clarity
COMMENT ON COLUMN public.items_received.product_code IS 'Product code from ingredient_supplier_codes for the supplier that issued the invoice';

