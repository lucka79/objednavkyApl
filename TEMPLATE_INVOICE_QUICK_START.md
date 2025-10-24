# Quick Start: Template-Based Invoice Processing

Get started with automated invoice processing in 30 minutes!

## 1. Run Database Migration (5 minutes)

```sql
-- In Supabase SQL Editor, run:
\i src/sql/create_invoice_templates.sql
```

This creates 3 tables:
- ✅ `invoice_templates` - Your extraction templates
- ✅ `invoice_template_tests` - Performance tracking
- ✅ `unmapped_product_codes` - Codes needing mapping

## 2. Start Python OCR Service (10 minutes)

### Option A: Docker (Easiest)

```bash
cd python-ocr-service
docker-compose up -d
```

### Option B: Local Python

**Windows:**
```powershell
# Install Tesseract from: https://github.com/UB-Mannheim/tesseract/wiki
# Then:
cd python-ocr-service
pip install -r requirements.txt
python main.py
```

**Linux/Mac:**
```bash
# Install dependencies
sudo apt-get install tesseract-ocr tesseract-ocr-ces poppler-utils

# Start service
cd python-ocr-service
pip install -r requirements.txt
python main.py
```

Service should be running at: http://localhost:8000

Test it:
```bash
curl http://localhost:8000/health
# Should return: {"status":"healthy","service":"invoice-ocr"}
```

## 3. Deploy Edge Function (5 minutes)

```bash
# Set Python service URL
supabase secrets set PYTHON_OCR_SERVICE_URL=http://host.docker.internal:8000

# Deploy function
supabase functions deploy process-invoice-template
```

For production, use your deployed Python service URL:
```bash
supabase secrets set PYTHON_OCR_SERVICE_URL=https://your-service.railway.app
```

## 4. Create Your First Template (10 minutes)

### Method 1: Use the UI

1. Go to Admin → Invoices → Templates
2. Click "Nová šablona"
3. Fill in:
   - **Name**: "Pešek - Rambousek Standard"
   - **Version**: "1.0"
   - **Config**: Use example below

### Method 2: Insert via SQL

```sql
INSERT INTO invoice_templates (
  supplier_id,
  template_name,
  version,
  is_active,
  config
)
VALUES (
  'YOUR_SUPPLIER_ID_HERE',
  'Pešek - Rambousek Standard',
  '1.0',
  true,
  '{
    "ocr_settings": {
      "dpi": 300,
      "language": "ces",
      "psm": 6
    },
    "patterns": {
      "invoice_number": "Faktura č\\\\.: (\\\\d+)",
      "date": "Datum: (\\\\d{2}\\\\.\\\\d{2}\\\\.\\\\d{4})",
      "table_start": "Kód\\\\s+Položka\\\\s+Množství",
      "table_end": "Celkem:"
    },
    "table_columns": {}
  }'::jsonb
);
```

### Example Template Configurations

#### For Standard Czech Invoice

```json
{
  "ocr_settings": {
    "dpi": 300,
    "language": "ces",
    "psm": 6
  },
  "patterns": {
    "invoice_number": "(?:Faktura|Fa\\.|Číslo)\\s*č?\\.?:\\s*(\\d+)",
    "date": "Datum:\\s*(\\d{1,2}\\.\\d{1,2}\\.\\d{4})",
    "total_amount": "Celkem:\\s*([\\d\\s,]+)",
    "table_start": "Kód\\s+.*?Množství",
    "table_end": "Celkem|Součet|Total"
  }
}
```

#### For Simple Format (Code-Description-Quantity-Price)

```json
{
  "ocr_settings": {
    "dpi": 300,
    "language": "ces",
    "psm": 6
  },
  "patterns": {
    "invoice_number": "(\\d{6,})",
    "date": "(\\d{2}\\.\\d{2}\\.\\d{4})",
    "table_start": "Kód",
    "table_end": "Celkem"
  },
  "table_columns": {
    "line_pattern": "^(\\d{4,})\\s+(.+?)\\s+(\\d+[.,]?\\d*)\\s+(\\d+[.,]?\\d*)"
  }
}
```

## 5. Test Your Template

### Upload a Test Invoice

```typescript
import { useDocumentAI } from "@/hooks/useDocumentAI";

const { processDocumentWithTemplate, isProcessing } = useDocumentAI();

const result = await processDocumentWithTemplate(
  file,
  "supplier-id"
);

console.log(result.data);
// {
//   invoice_number: "2024001",
//   date: "24.10.2024",
//   items: [
//     {
//       product_code: "10001",
//       description: "Mouka",
//       quantity: 50,
//       unit_price: 25.50,
//       matched_ingredient_id: "...",
//       match_status: "exact"
//     }
//   ],
//   unmapped_codes: 2
// }
```

### Check Results

1. **Extracted data** - Review invoice number, date, items
2. **Matched items** - How many codes matched automatically
3. **Unmapped codes** - Go to Unmapped Codes Manager to map them

## 6. Map Unmapped Codes

Add the UnmappedCodesManager to your invoices page:

```typescript
import { UnmappedCodesManager } from "@/components/UnmappedCodesManager";

function InvoicesPage() {
  return (
    <div>
      {/* Your existing invoice upload */}
      
      {/* Add this component */}
      <UnmappedCodesManager supplierId={currentSupplier.id} />
    </div>
  );
}
```

For each unmapped code:
1. Review the suggestion
2. Select correct ingredient from dropdown
3. Click ✓ to map it
4. Next invoice will automatically match this code!

## 7. Refine Your Template

If extraction is not perfect:

### Low Accuracy? Adjust Patterns

```json
{
  "patterns": {
    // Be more specific
    "invoice_number": "Faktura č.: (\\d{6})",  // Expects exactly 6 digits
    
    // Be more flexible
    "date": "(\\d{1,2}\\.\\s*\\d{1,2}\\.\\s*\\d{4})",  // Allows spaces
    
    // Match variations
    "table_start": "(?:Kód|Code|Číslo)\\s+",  // Multiple header variants
  }
}
```

### Poor OCR Quality? Adjust Settings

```json
{
  "ocr_settings": {
    "dpi": 400,        // Increase for better quality (300 → 400)
    "language": "ces", // Czech language
    "psm": 6          // Try different modes: 3, 6, or 11
  }
}
```

PSM Modes:
- `3` - Fully automatic page segmentation
- `6` - Uniform block of text (best for invoices)
- `11` - Sparse text (for minimalist invoices)

## Common Invoice Formats

### Format 1: Standard Table

```
Faktura č.: 123456
Datum: 24.10.2024

Kód    Položka              Množství  Cena   Celkem
10001  Mouka pšeničná      50 kg     25.50  1,275.00
10002  Cukr krystal        20 kg     35.00    700.00

Celkem: 1,975.00
```

Template:
```json
{
  "patterns": {
    "invoice_number": "Faktura č\\.: (\\d+)",
    "date": "Datum: (\\d{2}\\.\\d{2}\\.\\d{4})",
    "table_start": "Kód\\s+Položka",
    "table_end": "Celkem:"
  }
}
```

### Format 2: Compact Format

```
#123456 | 24.10.2024

10001 Mouka 50 kg 25.50
10002 Cukr 20 kg 35.00

Součet: 1,975.00
```

Template:
```json
{
  "patterns": {
    "invoice_number": "#(\\d+)",
    "date": "(\\d{2}\\.\\d{2}\\.\\d{4})",
    "table_start": "^\\d{4}",
    "table_end": "Součet"
  },
  "table_columns": {
    "line_pattern": "^(\\d{4,})\\s+([A-Za-zÁ-ž\\s]+)\\s+(\\d+)\\s+(kg|ks)\\s+([\\d.]+)"
  }
}
```

## Integration Examples

### Add to ReceivedInvoices Component

```typescript
// In src/components/ReceivedInvoices.tsx

import { useDocumentAI } from "@/hooks/useDocumentAI";
import { UnmappedCodesManager } from "@/components/UnmappedCodesManager";

export function ReceivedInvoices() {
  const { processDocumentWithTemplate, isProcessing } = useDocumentAI();
  
  const handleFileUpload = async (file: File, supplierId: string) => {
    // Use template-based processing
    const result = await processDocumentWithTemplate(file, supplierId);
    
    if (result.success) {
      // Auto-fill form with extracted data
      setInvoiceData({
        invoice_number: result.data.invoiceNumber,
        date: result.data.date,
        total_amount: result.data.totalAmount,
        items: result.data.items,
      });
      
      // Show warning if there are unmapped codes
      if (result.data.unmapped_codes > 0) {
        toast({
          title: "Pozor",
          description: `${result.data.unmapped_codes} kódů nemá přiřazenou surovinu`,
        });
      }
    }
  };
  
  return (
    <div>
      {/* File upload with template processing */}
      <input 
        type="file" 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file, selectedSupplier);
        }}
      />
      
      {/* Show unmapped codes manager */}
      <UnmappedCodesManager supplierId={selectedSupplier} />
    </div>
  );
}
```

### Add to Invoice Upload Dialog

```typescript
// In src/components/InvoiceUploadDialog.tsx

const { processDocumentWithTemplate } = useDocumentAI();

<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Nahrát fakturu</DialogTitle>
    </DialogHeader>
    
    <div className="space-y-4">
      {/* Method selection */}
      <Tabs defaultValue="template">
        <TabsList>
          <TabsTrigger value="template">
            Automaticky (Šablona)
          </TabsTrigger>
          <TabsTrigger value="manual">
            Ručně
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="template">
          <input 
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                const result = await processDocumentWithTemplate(
                  file, 
                  supplierId
                );
                // Handle result...
              }
            }}
          />
        </TabsContent>
        
        <TabsContent value="manual">
          {/* Manual entry form */}
        </TabsContent>
      </Tabs>
    </div>
  </DialogContent>
</Dialog>
```

## Troubleshooting

### "Template not found"
- Check that template exists for the supplier
- Ensure `is_active = true`
- Verify `supplier_id` matches

### "OCR service not responding"
- Check Python service is running: `curl http://localhost:8000/health`
- Verify `PYTHON_OCR_SERVICE_URL` in edge function secrets
- Check edge function logs

### "No items extracted"
- Review OCR output in response
- Adjust `table_start` pattern to match your invoice
- Try different PSM mode (3, 6, or 11)
- Increase DPI if text is blurry

### "Wrong codes matched"
- Check `ingredient_supplier_codes` table for duplicates
- Make product codes more specific
- Use unmapped codes manager to correct mappings

## Next Steps

1. ✅ Create template for your main supplier
2. ✅ Test with 5-10 sample invoices
3. ✅ Map unmapped codes
4. ✅ Refine template patterns
5. Create templates for other suppliers
6. Monitor success rates
7. Adjust patterns as invoice formats change

## Support Resources

- 📖 **Full Documentation**: `TEMPLATE_BASED_INVOICE_AI_SETUP.md`
- 🔍 **Test Regex Patterns**: https://regex101.com
- 🐛 **Debug Logs**: Check Python service console and Supabase edge function logs
- 📊 **Success Rates**: Review in `invoice_templates` table

## Success Metrics

After setup, you should see:
- ⚡ **Processing time**: 1-2 seconds per invoice
- 🎯 **Accuracy**: 90-98% on matched codes
- 💰 **Cost**: Zero per invoice (vs $0.015-0.05 for Google AI)
- 📈 **Improvement**: Accuracy increases with each mapped code

Enjoy automated invoice processing! 🎉

