-- Fix numeric overflow in unmapped_product_codes
-- Change last_seen_price from DECIMAL(10,2) to DECIMAL(15,2) to handle larger values
-- This allows prices up to 9,999,999,999,999.99

ALTER TABLE public.unmapped_product_codes
ALTER COLUMN last_seen_price TYPE DECIMAL(15,2);

ALTER TABLE public.unmapped_product_codes
ALTER COLUMN last_seen_quantity TYPE DECIMAL(15,3);

COMMENT ON COLUMN unmapped_product_codes.last_seen_price IS 'Price from invoice (DECIMAL(15,2) to handle large totals)';
COMMENT ON COLUMN unmapped_product_codes.last_seen_quantity IS 'Quantity from invoice (DECIMAL(15,3) to handle fractional quantities)';

