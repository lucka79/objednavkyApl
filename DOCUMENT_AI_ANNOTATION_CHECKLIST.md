# Document AI Annotation Checklist

## Quick Reference for Invoice Annotation

Use this checklist while annotating each invoice in Google Cloud Document AI Console.

---

## For EACH Invoice Document

### Step 1: Invoice Header Fields ✓

Select and label these fields (once per document):

```
□ supplier_name     → Supplier/vendor company name
□ invoice_id        → Invoice number (e.g., "2522884")
□ invoice_date      → Date of invoice
□ net_amount        → Subtotal BEFORE tax
□ total_amount      → Grand total INCLUDING tax
```

**Optional but recommended:**
```
□ vat_amount        → Tax amount
□ due_date          → Payment due date
□ receiver_name     → Your company name (if visible)
```

### Step 2: Line Items Table ✓

For **EVERY ROW** in the invoice table, select and label:

```
For Row 1:
□ line_item/description   → Product name
□ line_item/quantity      → Quantity (NUMBER ONLY, e.g., "5")
□ line_item/unit_price    → Price per unit
□ line_item/amount        → Line total

For Row 2:
□ line_item/description   → Product name
□ line_item/quantity      → Quantity (NUMBER ONLY, e.g., "10.5")
□ line_item/unit_price    → Price per unit
□ line_item/amount        → Line total

... Repeat for ALL rows ...
```

**Optional line item fields:**
```
□ line_item/unit           → Unit (e.g., "kg", "ks")
□ line_item/product_code   → SKU/product code (if present)
```

### Step 3: Verification ✓

Before saving, check:

```
□ All invoice header fields are highlighted
□ EVERY line item row is completely annotated
□ No rows skipped (even if values are small/zero)
□ Quantities don't include units (just numbers)
□ No overlapping annotations
□ Text selection is clean (no extra spaces)
```

---

## Common Mistakes to Avoid

### ❌ DON'T Do This:

| Wrong | Right | Why |
|-------|-------|-----|
| "5 kg" in quantity | "5" | Don't include units |
| Skip last 2 rows | Annotate ALL rows | Every row must be labeled |
| Only header fields | Header + ALL line items | Incomplete annotation |
| "€127.50" in amount | "127.50" | No currency symbols |
| Selecting "Množství:" | Select "5" | Don't label the headers |

### ✅ DO This:

- Select ONLY the value text (not labels/headers)
- Include decimal points if present (e.g., "10.5")
- Annotate every single row, even if quantity is "1"
- Be consistent across all documents
- Double-check before saving

---

## Progress Tracker

Print this or keep open in another window:

```
Document 1:  □ Header ✓   □ Line Items ✓   □ Verified ✓
Document 2:  □ Header ✓   □ Line Items ✓   □ Verified ✓
Document 3:  □ Header ✓   □ Line Items ✓   □ Verified ✓
Document 4:  □ Header ✓   □ Line Items ✓   □ Verified ✓
Document 5:  □ Header ✓   □ Line Items ✓   □ Verified ✓
Document 6:  □ Header ✓   □ Line Items ✓   □ Verified ✓
Document 7:  □ Header ✓   □ Line Items ✓   □ Verified ✓
Document 8:  □ Header ✓   □ Line Items ✓   □ Verified ✓
Document 9:  □ Header ✓   □ Line Items ✓   □ Verified ✓
Document 10: □ Header ✓   □ Line Items ✓   □ Verified ✓
```

**Current Status**: ✅ 2/10 documents complete → Need 8 more!

---

## Time Estimates

- **Simple invoice** (5-10 line items): 15 minutes
- **Medium invoice** (10-20 line items): 25 minutes
- **Complex invoice** (20+ line items): 35 minutes

**Total time for 10 documents**: 2.5 - 5 hours

---

## Field Definitions

### Invoice-Level Fields

| Field | What to Select | Example |
|-------|----------------|---------|
| `supplier_name` | Company name at top | "Pekárna Novák s.r.o." |
| `invoice_id` | Invoice number | "2522884" |
| `invoice_date` | Invoice date | "15.10.2025" |
| `net_amount` | Subtotal before VAT | "1250.00" |
| `total_amount` | Total with VAT | "1512.50" |
| `vat_amount` | VAT/tax amount | "262.50" |

### Line Item Fields

| Field | What to Select | Example |
|-------|----------------|---------|
| `line_item/description` | Product name | "Mouka pšeničná hladká" |
| `line_item/quantity` | Quantity NUMBER ONLY | "5" (not "5 kg") |
| `line_item/unit` | Unit of measure | "kg" |
| `line_item/unit_price` | Price per unit | "25.50" |
| `line_item/amount` | Line total | "127.50" |
| `line_item/product_code` | SKU or code | "MOK-001" |

---

## Quick Tips

### Speed Up Annotation

1. **Start with easiest invoice** - build confidence
2. **Use keyboard shortcuts** in annotation tool
3. **Do header fields first** - same pattern every time
4. **Then go row-by-row** - systematic approach
5. **Take breaks** - accuracy > speed

### Quality Checks

After every 2-3 documents:
- Review your first document again
- Check for consistency
- Verify no fields were missed
- Look for annotation patterns

### When in Doubt

- **Too much text selected**: Better than too little
- **Field not visible**: Skip it (only annotate what you see)
- **Unclear value**: Make best judgment, note it for later
- **Table continues on page 2**: Annotate all pages

---

## Minimum Requirements Reminder

✅ **Required**: At least 10 documents with ALL fields annotated  
✅ **Recommended**: 15-20 documents for better accuracy  
✅ **Optimal**: 30+ documents for production use

**You cannot train until you have 10 complete documents.**

---

## Annotation Console Quick Access

```
URL: https://console.cloud.google.com/ai/document-ai/processors
Project: 832370309522
Location: eu
Processor: b5de41a4cf52cc70

Direct link to training:
→ Processors → [Your Processor] → Train tab → View/Edit labels
```

---

## After Completing 10 Documents

1. ✅ Review all 10 documents one more time
2. ✅ Verify checklist completed for each
3. ✅ Click "Train new version" button
4. ✅ Wait 30-60 minutes for training
5. ✅ Test with sample invoices
6. ✅ Add more documents if accuracy < 80%

---

**Last Updated**: 2025-10-19  
**Status**: 2/10 documents complete (20%)  
**Next Milestone**: Complete 5 documents (50%)

