-- Create invoice templates table
-- Each supplier can have multiple templates (for different invoice versions)
CREATE TABLE IF NOT EXISTS invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES profiles(id),
  template_name TEXT NOT NULL,
  version TEXT DEFAULT '1.0',
  is_active BOOLEAN DEFAULT true,
  
  -- Template configuration JSON
  config JSONB NOT NULL,
  -- Example config structure:
  -- {
  --   "page_regions": {
  --     "header": {"x": 0, "y": 0, "width": 100, "height": 15},
  --     "items_table": {"x": 0, "y": 15, "width": 100, "height": 70}
  --   },
  --   "table_columns": {
  --     "product_code": {"index": 0, "x_start": 5, "x_end": 15},
  --     "description": {"index": 1, "x_start": 15, "x_end": 45},
  --     "quantity": {"index": 2, "x_start": 45, "x_end": 55},
  --     "unit": {"index": 3, "x_start": 55, "x_end": 65},
  --     "unit_price": {"index": 4, "x_start": 65, "x_end": 75},
  --     "total": {"index": 5, "x_start": 75, "x_end": 85}
  --   },
  --   "patterns": {
  --     "invoice_number": "Faktura č\\.: (\\d+)",
  --     "date": "Datum: (\\d{2}\\.\\d{2}\\.\\d{4})",
  --     "table_start": "Kód\\s+Položka\\s+Množství",
  --     "table_end": "Celkem:"
  --   },
  --   "ocr_settings": {
  --     "dpi": 300,
  --     "language": "ces",
  --     "psm": 6
  --   }
  -- }
  
  -- Statistics
  success_rate DECIMAL(5,2) DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoice_templates_supplier 
  ON invoice_templates(supplier_id, is_active);

-- Create table for template test results
CREATE TABLE IF NOT EXISTS invoice_template_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES invoice_templates(id) ON DELETE CASCADE,
  test_file_path TEXT NOT NULL,
  extracted_data JSONB,
  success BOOLEAN,
  error_message TEXT,
  confidence_score DECIMAL(5,2),
  tested_at TIMESTAMPTZ DEFAULT NOW(),
  tested_by UUID REFERENCES auth.users(id)
);

-- Create table for unmapped product codes (suggestions)
CREATE TABLE IF NOT EXISTS unmapped_product_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES profiles(id),
  product_code TEXT NOT NULL,
  description TEXT,
  
  -- Metadata from invoice
  unit_of_measure TEXT,
  last_seen_price DECIMAL(10,2),
  last_seen_quantity DECIMAL(10,2),
  
  -- Suggestion tracking
  suggested_ingredient_id BIGINT REFERENCES ingredients(id),
  suggestion_confidence DECIMAL(5,2),
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'mapped', 'ignored')),
  mapped_to_ingredient_id BIGINT REFERENCES ingredients(id),
  mapped_at TIMESTAMPTZ,
  mapped_by UUID REFERENCES auth.users(id),
  
  -- Tracking
  occurrence_count INTEGER DEFAULT 1,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(supplier_id, product_code)
);

-- Create index for unmapped codes
CREATE INDEX IF NOT EXISTS idx_unmapped_codes_supplier_status 
  ON unmapped_product_codes(supplier_id, status);

-- Enable RLS
ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_template_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE unmapped_product_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoice_templates
CREATE POLICY "Users can view templates for their supplier"
  ON invoice_templates FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE id = supplier_id
    ) OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage templates"
  ON invoice_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for unmapped_product_codes
CREATE POLICY "Users can view unmapped codes for their supplier"
  ON unmapped_product_codes FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE id = supplier_id
    ) OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can update unmapped codes"
  ON unmapped_product_codes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super_admin', 'user')
    )
  );

-- Function to update template statistics
CREATE OR REPLACE FUNCTION update_template_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE invoice_templates
  SET 
    usage_count = usage_count + 1,
    last_used_at = NOW(),
    success_rate = (
      SELECT AVG(CASE WHEN success THEN 100 ELSE 0 END)
      FROM invoice_template_tests
      WHERE template_id = NEW.template_id
    )
  WHERE id = NEW.template_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stats after each test
CREATE TRIGGER update_template_stats_trigger
  AFTER INSERT ON invoice_template_tests
  FOR EACH ROW
  EXECUTE FUNCTION update_template_stats();

-- Function to update unmapped code occurrence
CREATE OR REPLACE FUNCTION update_unmapped_code_occurrence()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO unmapped_product_codes (
    supplier_id,
    product_code,
    description,
    unit_of_measure,
    last_seen_price,
    last_seen_quantity,
    occurrence_count,
    first_seen_at,
    last_seen_at
  )
  VALUES (
    NEW.supplier_id,
    NEW.product_code,
    NEW.description,
    NEW.unit_of_measure,
    NEW.last_seen_price,
    NEW.last_seen_quantity,
    1,
    NOW(),
    NOW()
  )
  ON CONFLICT (supplier_id, product_code)
  DO UPDATE SET
    occurrence_count = unmapped_product_codes.occurrence_count + 1,
    last_seen_at = NOW(),
    last_seen_price = NEW.last_seen_price,
    last_seen_quantity = NEW.last_seen_quantity,
    description = COALESCE(NEW.description, unmapped_product_codes.description),
    unit_of_measure = COALESCE(NEW.unit_of_measure, unmapped_product_codes.unit_of_measure);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE invoice_templates IS 'Templates for parsing supplier invoices';
COMMENT ON TABLE invoice_template_tests IS 'Test results for invoice templates';
COMMENT ON TABLE unmapped_product_codes IS 'Product codes found in invoices that need manual mapping';

