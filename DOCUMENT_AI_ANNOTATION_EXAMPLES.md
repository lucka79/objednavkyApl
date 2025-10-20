# Document AI Annotation Examples

## Visual Guide: What to Annotate

This guide shows you **exactly** what to select and label in your invoices.

---

## Example Invoice Layout

```
┌─────────────────────────────────────────────────────────┐
│  Pekárna Novák s.r.o.                                   │ ← supplier_name
│  Hlavní 123, Praha 1                                    │
│                                                          │
│  FAKTURA č. 2522884                                     │ ← invoice_id
│  Datum: 15.10.2025                                      │ ← invoice_date
│                                                          │
│  Odběratel: Restaurace U Marty                          │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Položka              Množ.  MJ   Cena    Celkem        │
├─────────────────────────────────────────────────────────┤
│  Mouka pšeničná        5     kg   25.50   127.50       │
│  ↑                     ↑     ↑    ↑       ↑            │
│  description         quantity unit unit_pr amount       │
│                                                          │
│  Droždí čerstvé        2     kg   45.00   90.00        │
│  ↑                     ↑     ↑    ↑       ↑            │
│  description         quantity unit unit_pr amount       │
│                                                          │
│  Cukr krystal          10    kg   18.50   185.00       │
│  Máslo                 3     kg   120.00  360.00       │
├─────────────────────────────────────────────────────────┤
│  Mezisoučet bez DPH:                     762.50        │ ← net_amount
│  DPH 21%:                                160.13        │ ← vat_amount (optional)
│  CELKEM k úhradě:                        922.63 Kč     │ ← total_amount
└─────────────────────────────────────────────────────────┘
```

---

## Annotation Instructions for Above Invoice

### Step 1: Header Fields

```
✓ Select: "Pekárna Novák s.r.o."
  Label as: supplier_name

✓ Select: "2522884"
  Label as: invoice_id

✓ Select: "15.10.2025"
  Label as: invoice_date

✓ Select: "762.50"
  Label as: net_amount

✓ Select: "922.63"
  Label as: total_amount
```

### Step 2: Line Items (Row 1)

```
✓ Select: "Mouka pšeničná"
  Label as: line_item/description

✓ Select: "5"  ← NUMBER ONLY!
  Label as: line_item/quantity

✓ Select: "kg"  (optional)
  Label as: line_item/unit

✓ Select: "25.50"
  Label as: line_item/unit_price

✓ Select: "127.50"
  Label as: line_item/amount
```

### Step 3: Repeat for ALL Rows

```
Row 2: Droždí čerstvé
  □ line_item/description: "Droždí čerstvé"
  □ line_item/quantity: "2"
  □ line_item/unit: "kg"
  □ line_item/unit_price: "45.00"
  □ line_item/amount: "90.00"

Row 3: Cukr krystal
  □ line_item/description: "Cukr krystal"
  □ line_item/quantity: "10"
  □ line_item/unit: "kg"
  □ line_item/unit_price: "18.50"
  □ line_item/amount: "185.00"

Row 4: Máslo
  □ line_item/description: "Máslo"
  □ line_item/quantity: "3"
  □ line_item/unit: "kg"
  □ line_item/unit_price: "120.00"
  □ line_item/amount: "360.00"
```

---

## Common Patterns & Edge Cases

### Pattern 1: Decimal Quantities

```
Invoice Line:
  Sůl jemná          2.5    kg    15.00    37.50

Annotation:
  ✓ quantity: "2.5"   ← Include decimal point
  ✗ quantity: "2"     ← Don't round
  ✗ quantity: "2,5 kg" ← Don't include unit
```

### Pattern 2: Large Numbers

```
Invoice Line:
  Mouka pytlová      100    kg    22.00    2200.00

Annotation:
  ✓ quantity: "100"
  ✗ quantity: "100 kg"
  ✗ quantity: "100,00"  ← No decimal if whole number shown as "100"
```

### Pattern 3: Fractional Amounts

```
Invoice Line:
  Balení           0.5    balení    200.00    100.00

Annotation:
  ✓ quantity: "0.5"
  ✓ unit: "balení"
```

### Pattern 4: No Explicit Quantity (Implied "1")

```
Invoice Line:
  Poradenská služba    -     ks    500.00    500.00

Annotation:
  ⚠ If you see "-" or empty, look at price vs amount
  If they match, quantity is likely 1
  
  Option A: Skip this row (if truly no quantity shown)
  Option B: Type "1" manually (if you can infer it)
  
  Recommendation: Skip problematic rows, focus on clear data
```

### Pattern 5: Multiple Units on Same Product

```
Invoice Line:
  Chléb tmavý (5 ks)     2    balení    45.00    90.00

Annotation:
  ✓ description: "Chléb tmavý (5 ks)"  ← Include full text
  ✓ quantity: "2"                       ← The main quantity
  ✓ unit: "balení"                      ← The main unit
```

---

## What NOT to Annotate

### ❌ Don't Select Headers

```
WRONG:
  Select "Položka" and label as line_item/description
  Select "Množ." and label as line_item/quantity

RIGHT:
  Skip the header row entirely
  Only annotate data rows
```

### ❌ Don't Include Labels

```
WRONG:
  Select "Faktura č. 2522884" → invoice_id

RIGHT:
  Select only "2522884" → invoice_id
```

### ❌ Don't Include Currency Symbols

```
WRONG:
  Select "922.63 Kč" → total_amount

RIGHT:
  Select "922.63" → total_amount
```

### ❌ Don't Mix Fields

```
WRONG:
  Select "5 kg" → line_item/quantity

RIGHT:
  Select "5" → line_item/quantity
  Select "kg" → line_item/unit (separate field)
```

---

## Real-World Examples

### Example 1: Czech Invoice Format

```
Faktura - daňový doklad
Číslo dokladu: 2025/0234        ← Select "2025/0234" as invoice_id
Datum vystavení: 15.10.2025     ← Select "15.10.2025" as invoice_date
Dodavatel: PEKAŘSTVÍ SLÁMA      ← Select "PEKAŘSTVÍ SLÁMA" as supplier_name

Název zboží             Množ.   Cena/MJ   Cena celkem
────────────────────────────────────────────────────
Mouka špaldová          15 kg   32,50     487,50
Voda pramenitá          24 l    8,00      192,00

Mezisoučet:                               679,50 Kč  ← net_amount
DPH 15%:                                  101,93 Kč
K úhradě celkem:                          781,43 Kč  ← total_amount
```

**Annotation:**
```
Invoice level:
  supplier_name: "PEKAŘSTVÍ SLÁMA"
  invoice_id: "2025/0234"
  invoice_date: "15.10.2025"
  net_amount: "679,50" or "679.50" (be consistent)
  total_amount: "781,43" or "781.43"

Line 1:
  line_item/description: "Mouka špaldová"
  line_item/quantity: "15"
  line_item/unit: "kg"
  line_item/unit_price: "32,50"
  line_item/amount: "487,50"

Line 2:
  line_item/description: "Voda pramenitá"
  line_item/quantity: "24"
  line_item/unit: "l"
  line_item/unit_price: "8,00"
  line_item/amount: "192,00"
```

### Example 2: Simplified Invoice

```
Odběratelská faktura položková - 2529049
Vystaveno: 18.10.2025
Dodavatel: Mlékárna Holešov

P.č. Popis              MJ  Množství  Jedn.cena  Cena
1    Máslo tuplované    kg  5,000     125,00     625,00
2    Smetana 33%        l   10,000    45,50      455,00
3    Tvaroh měkký       kg  8,500     52,00      442,00

Celkem bez DPH:                                  1522,00
DPH 15%:                                         228,30
Celkem:                                          1750,30
```

**Annotation:**
```
Invoice level:
  supplier_name: "Mlékárna Holešov"
  invoice_id: "2529049"
  invoice_date: "18.10.2025"
  net_amount: "1522,00"
  total_amount: "1750,30"

Line 1:
  line_item/description: "Máslo tuplované"
  line_item/quantity: "5,000" or "5"  ← Be consistent
  line_item/unit: "kg"
  line_item/unit_price: "125,00"
  line_item/amount: "625,00"

Line 2:
  line_item/description: "Smetana 33%"
  line_item/quantity: "10,000" or "10"
  line_item/unit: "l"
  line_item/unit_price: "45,50"
  line_item/amount: "455,00"

Line 3:
  line_item/description: "Tvaroh měkký"
  line_item/quantity: "8,500" or "8.5"
  line_item/unit: "kg"
  line_item/unit_price: "52,00"
  line_item/amount: "442,00"
```

---

## Consistency Rules

### Rule 1: Decimal Separators

Czech format uses comma (,) but many systems use period (.)

**Choose ONE and stick with it:**

```
Option A (Keep Czech format):
  "127,50" "10,5" "1522,00"

Option B (Convert to international):
  "127.50" "10.5" "1522.00"

Recommendation: Keep the format as shown in the document
```

### Rule 2: Trailing Zeros

```
If invoice shows: "5,00"
  Annotate as: "5,00" (keep it)
  NOT: "5" (don't strip zeros if they're there)

If invoice shows: "5"
  Annotate as: "5"
  NOT: "5.00" (don't add zeros if they're not there)
```

### Rule 3: Product Codes

```
If visible:
  Annotate them as line_item/product_code

If missing:
  Skip this field (don't make them up)

Example:
  "MOK-001 Mouka pšeničná"
  
  product_code: "MOK-001"
  description: "MOK-001 Mouka pšeničná" or just "Mouka pšeničná"
  
  Either is acceptable, just be consistent
```

---

## Difficult Cases

### Case 1: Multi-line Descriptions

```
Invoice shows:
  Mouka pšeničná hladká
  typ 00, balení 25 kg        10    bal    250,00    2500,00

Annotation:
  description: Select BOTH lines of text
               "Mouka pšeničná hladká typ 00, balení 25 kg"
  quantity: "10"
  unit: "bal"
```

### Case 2: Subtotals in Table

```
Invoice shows:
  Mouka pšeničná         5     kg    25,00    125,00
  Cukr                   3     kg    18,00    54,00
  ─────────────────────────────────────────────────
  Mezisoučet                                  179,00  ← DON'T ANNOTATE
  ─────────────────────────────────────────────────
  Droždí                 1     kg    45,00    45,00

Do NOT annotate subtotal rows - only product rows
```

### Case 3: Page Breaks

```
Page 1 ends with:
  ... Máslo             3     kg    120,00   360,00

Page 2 continues with:
  Olej slunečnicový     5     l     35,00    175,00
  ...

Annotate lines on BOTH pages - the model needs all line items
```

### Case 4: Missing Net Amount

```
Invoice shows:
  Celkem k úhradě: 1250,00 Kč

But no "Mezisoučet bez DPH" field visible.

Options:
  A) Calculate it yourself (total / 1.15 or 1.21 depending on VAT)
  B) Skip net_amount for this document
  C) Use total_amount value also for net_amount (not ideal)

Recommendation: Option B - only annotate what's clearly visible
```

---

## Verification Checklist for Each Document

Before clicking "Save", verify:

```
✓ Invoice has supplier_name highlighted
✓ Invoice has invoice_id highlighted
✓ Invoice has invoice_date highlighted
✓ Invoice has net_amount highlighted (if visible)
✓ Invoice has total_amount highlighted

For each line item:
✓ Description is highlighted
✓ Quantity is highlighted (number only)
✓ Unit price is highlighted
✓ Line amount is highlighted

Common mistakes check:
✓ No header rows annotated
✓ No subtotal rows annotated
✓ No currency symbols in amounts
✓ No units included in quantities
✓ All rows annotated (none skipped)
```

---

## Summary

### The Perfect Annotation

1. **Complete**: Every required field annotated
2. **Accurate**: Correct field types and values
3. **Consistent**: Same rules applied across all documents
4. **Clean**: No extra text, no overlaps
5. **Verified**: Checked before saving

### Your Goal

Create **10 perfectly annotated documents** following these examples.

**Quality > Speed** - It's better to annotate 10 documents perfectly than 20 documents poorly.

---

## Need Help?

If you're unsure about a specific invoice:
1. Look at these examples again
2. Choose the most similar pattern
3. Stay consistent with your previous annotations
4. Make a note of unusual cases
5. You can always add more training data later

**Remember**: The AI learns from YOUR annotations. If you're consistent, the AI will be consistent.

---

**Last Updated**: 2025-10-19  
**Related Guides**: 
- `DOCUMENT_AI_TRAINING_FIX.md` - Detailed fix guide
- `DOCUMENT_AI_ANNOTATION_CHECKLIST.md` - Quick checklist

