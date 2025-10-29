-- Add QR codes field to invoices_received table
-- This field stores QR codes and barcodes detected from the invoice

ALTER TABLE public.invoices_received
ADD COLUMN IF NOT EXISTS qr_codes JSONB; -- QR codes and barcodes detected from the invoice

-- Add comment for clarity
COMMENT ON COLUMN public.invoices_received.qr_codes IS 'QR codes and barcodes detected from the invoice (array of {data, type, page})';
