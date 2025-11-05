# Backaldrin Invoice Template Guide

## Overview
This guide documents the invoice template configuration for **Backaldrin** supplier, including the line pattern format and display layout.

## Display Layout
Set `display_layout` to `"backaldrin"` in the template configuration to use the dedicated Backaldrin invoice layout.

## Invoice Format
Backaldrin invoices typically follow this line format:

```
CODE DESCRIPTION QUANTITY UNIT QUANTITY2 UNIT2 UNIT_PRICE LINE_TOTAL | VAT_RATE%
```

### Example Lines:
```
02498362 Šarže Počet Jednotka 10.07.2026 25 kg
00027885 Sahnissimo neutrál 1 kg 8 kg 8 kg 214,000 1 712,00 | 12%
02543250 Kobliha 20 % 25 kg 25 kg 166,000 4 150,00 | 12%
```

## Line Pattern Configuration

### Multi-line Pattern (9 groups)
This pattern captures items that span multiple lines, including optional batch information:

```regex
^(\d{8})\s+([A-Za-zá-žÁ-Ž]+(?:\s+[A-Za-zá-žÁ-Ž]+)*(?:\s+\d+\s*%)?)\s+([\d,]+)\s*([a-zA-Z]{1,5})\s+(?:\d{8,}\s+)?([\d,]+)\s*([a-zA-Z]{1,5})\s+([\d,\s]+)\s+([\d\s,]+)\s*\|\s*(\d+)%
```

### Pattern Groups:
1. **Code** (8 digits): `02498362`
2. **Description**: `Sahnissimo neutrál 1 kg` or `Kobliha 20 %`
3. **Quantity 1**: `8` or `25`
4. **Unit 1**: `kg`
5. **Quantity 2**: `8` or `25` (actual quantity to use)
6. **Unit 2**: `kg`
7. **Unit Price**: `214,000` or `166,000`
8. **Line Total**: `1 712,00` or `4 150,00`
9. **VAT Rate**: `12`

### Important Notes:
- **Description can include percentages**: e.g., "Kobliha 20 %" - the percentage is part of the product name, NOT a separate VAT rate
- **Batch lines** (starting with "Šarže Počet Jednotka") should be ignored using `ignore_patterns`
- **Quantity**: Use quantity 2 (group 5) as the primary quantity
- **Line total calculation**: The Python OCR service calculates `line_total = quantity * unit_price` for accuracy

## Ignore Patterns
Add these patterns to skip non-product lines:

```json
{
  "table_columns": {
    "ignore_patterns": [
      "^Šarže\\s+Počet\\s+Jednotka",
      "^\\d{8}\\s+\\d{2}\\.\\d{2}\\.\\d{4}\\s+[\\d,]+\\s*[a-zA-Z]+"
    ]
  }
}
```

## Complete Template Configuration Example

```json
{
  "ocr_settings": {
    "dpi": 300,
    "language": "ces",
    "psm": 6
  },
  "patterns": {
    "invoice_number": "Faktura\\s+č\\.\\s*([\\d/]+)",
    "date": "Datum uskutečnění.*?:\\s*(\\d{1,2}\\.\\d{1,2}\\.\\d{4})",
    "total_amount": "Částka k úhradě\\s+([\\d\\s,]+)",
    "payment_type": "Forma úhrady:\\s*([a-zA-Zá-žÁ-Ž\\s]+)",
    "table_start": "Předmět zdanitelného plnění",
    "table_end": "Celkem bez DPH"
  },
  "table_columns": {
    "line_pattern": "^(\\d{8})\\s+([A-Za-zá-žÁ-Ž]+(?:\\s+[A-Za-zá-žÁ-Ž]+)*(?:\\s+\\d+\\s*%)?)\\s+([\\d,]+)\\s*([a-zA-Z]{1,5})\\s+(?:\\d{8,}\\s+)?([\\d,]+)\\s*([a-zA-Z]{1,5})\\s+([\\d,\\s]+)\\s+([\\d\\s,]+)\\s*\\|\\s*(\\d+)%",
    "ignore_patterns": [
      "^Šarže\\s+Počet\\s+Jednotka",
      "^\\d{8}\\s+\\d{2}\\.\\d{2}\\.\\d{4}\\s+[\\d,]+\\s*[a-zA-Z]+"
    ]
  },
  "display_layout": "backaldrin"
}
```

## Field Mapping (Python OCR Service)

The Python service maps the 9 groups as follows:

- `product_code`: Group 1 (8-digit code)
- `description`: Group 2 (including percentages if present)
- `quantity`: Group 5 (second quantity value - the actual quantity)
- `unit_of_measure`: Group 6 (second unit)
- `unit_price`: Group 7 (converted from Czech format)
- `line_total`: **Calculated** as `quantity * unit_price` for accuracy
- `vat_rate`: Group 9 (VAT percentage)

## Display Layout Features

The `BackaldrinInvoiceLayout` component displays:

- **Amber-themed** header (distinctive for Backaldrin)
- Product code (8-digit format)
- Description (including percentages)
- Quantity + Unit
- Unit price (2 decimal places)
- VAT rate (%)
- Line total (2 decimal places)
- Mapping status with unmap button
- Low confidence warnings

## Testing the Template

1. Go to **Admin → Invoice Templates → Test Upload**
2. Upload a Backaldrin invoice
3. Check extracted items in the console
4. Use **"🏷️ Označit části řádků"** to create/adjust patterns if needed
5. Verify that:
   - All items are extracted
   - Batch lines are ignored
   - Quantities are correct
   - Descriptions include percentages where applicable
   - Line totals match the invoice

## Common Issues

### Items Not Extracted
- Check if `line_pattern` matches your invoice format
- Verify `table_start` and `table_end` patterns correctly identify the table boundaries
- Check console for OCR text to see actual line format

### Wrong Quantities
- Ensure you're using group 5 (second quantity) not group 3 (first quantity)
- Check if OCR correctly reads numbers (spaces in thousands)

### Missing Items on Second Page
- Verify `table_end` pattern doesn't trigger early
- Check for "continuation" messages in OCR text
- Ensure ignore patterns don't accidentally skip product lines

### Descriptions Too Short
- Adjust the description pattern to be less greedy: `([A-Za-zá-žÁ-Ž]+(?:\\s+[A-Za-zá-žÁ-Ž]+)*(?:\\s+\\d+\\s*%)?)`
- Make sure percentages are included in the description pattern

## Updates and Maintenance

To update the Backaldrin template:

1. **Edit the template** in Admin → Invoice Templates
2. **Update `line_pattern`** if invoice format changes
3. **Add new ignore patterns** if new non-product lines appear
4. **Test thoroughly** with multiple invoices
5. **Document changes** in this guide

## Related Files

- `src/components/invoice-layouts/BackaldrinInvoiceLayout.tsx` - Display component
- `python-ocr-service/main.py` - Line extraction logic (9-group format)
- `src/routes/admin.invoice-templates.tsx` - Layout routing
- `src/components/InvoiceTemplateEditor.tsx` - Template editor

---

Last Updated: 2025-01-05

