# Document AI Training Failure - Fix Guide

## Problem Summary

**Training Operation Failed**: `projects/832370309522/locations/eu/operations/3367990916943395816`

**⚠️ CRITICAL ISSUE**: You only have **2 properly annotated documents**, but need **at least 10**.

## 🎯 Quick Action Plan

**What you need to do RIGHT NOW:**

1. ✅ Pick 10 invoices from your collection (clear, representative samples)
2. ✅ For EACH invoice, annotate ALL fields:
   - Invoice header: supplier_name, invoice_id, invoice_date, net_amount, total_amount
   - ALL line items: description, quantity, unit_price, amount
3. ✅ Double-check: Every single row, every single field
4. ✅ Re-train once you have 10 complete documents

**Time estimate**: 15-30 minutes per document = 2.5-5 hours total

**Current status**: 
- ✅ 2 documents complete
- ⚠️ 8 MORE documents needed before you can train

---

## Error Details

### Dataset-Level Errors (CRITICAL)
- **Error Code**: 3 (INVALID_DATASET)
- **Current**: Only 2 documents with complete annotations
- **Required**: Minimum 10 documents with complete annotations

### Missing Annotations Per Field:
| Field | Current | Required | Missing |
|-------|---------|----------|---------|
| `DOCUMENTS_WITH_ENTITIES` | 2 | 10 | **8 more documents** |
| `supplier_name` | 3 instances | 10 | 7 more |
| `net_amount` | 2 instances | 10 | 8 more |
| `invoice_date` | 2 instances | 10 | 8 more |
| `invoice_id` | 4 instances | 10 | 6 more |
| `total_amount` | 2 instances | 10 | 8 more |
| `line_item/quantity` | 2 documents | 10 | 8 more |
| `line_item/unit_price` | 2 documents | 10 | 8 more |
| `line_item/product_code` | 2 documents | 10 | 8 more |

### Document-Level Errors
- **24 training documents** with missing `line_item/quantity` annotations
- **33 test documents** with missing annotations
- Several documents also missing `net_amount` annotations

### Affected Documents

**Training Set** (`gs://invoice-received/bakery_test/`):
- 2522884.pdf, 2523160.pdf, 2523586.pdf, 2523865.pdf, 2525023.pdf, 2525296.pdf, 2527425.pdf, 2527734.pdf, 2529049.pdf, 2529419.pdf, 2529940.pdf
- And many more...

**Test Set** (`gs://invoice-received/rambousekTest/`):
- Similar issues with 2524596.pdf, 2525023.pdf, 2526135.pdf, 2526654.pdf, and others

## ⚠️ ROOT CAUSE

You are trying to train with incomplete data:
- Only **2 out of all your documents** have complete annotations
- The remaining documents are missing critical fields
- **Google Cloud Document AI will not train unless you have at least 10 fully annotated documents**

## Step-by-Step Fix

### Priority: You MUST Fully Annotate at Least 10 Documents

The training will fail until you have **10+ documents with ALL required fields annotated**.

### 1. Access Document AI Console

```
URL: https://console.cloud.google.com/ai/document-ai/processors
Project: 832370309522
Location: eu
Processor ID: b5de41a4cf52cc70
```

### 2. Select 10 Documents to Fully Annotate

**Strategy**: Pick your 10 clearest, most representative invoices. Don't try to annotate everything at once.

**Recommended approach**:
1. Choose invoices with similar layouts
2. Start with simpler invoices (fewer line items)
3. Make sure they represent typical supplier invoices you'll receive

### 3. For EACH of the 10 Documents, Annotate ALL These Fields

#### Invoice-Level Fields (annotate once per document):
- ✅ **`supplier_name`** - Name of the supplier/vendor
- ✅ **`invoice_id`** - Invoice number
- ✅ **`invoice_date`** - Date of invoice
- ✅ **`net_amount`** - Subtotal before tax
- ✅ **`total_amount`** - Grand total including tax
- ⚠️ **`vat_amount`** (if visible) - Tax amount
- ⚠️ **`due_date`** (if visible) - Payment due date

#### Line Item Fields (annotate for EVERY line in the invoice table):
For each product/row in the invoice:
- ✅ **`line_item/description`** - Product name/description
- ✅ **`line_item/quantity`** - Quantity (number only, e.g., "5", "10.5")
- ⚠️ **`line_item/unit`** - Unit (e.g., "kg", "ks", "l")
- ✅ **`line_item/unit_price`** - Price per unit
- ✅ **`line_item/amount`** - Total line amount
- ⚠️ **`line_item/product_code`** - SKU or product code (if visible)

### 4. Annotation Workflow

For each of your 10 selected documents:

1. **Open the document** in the annotation tool
2. **Start with invoice-level fields** at the top:
   - Find and select the supplier name → Label as `supplier_name`
   - Find and select the invoice number → Label as `invoice_id`
   - Find and select the date → Label as `invoice_date`
   - Scroll to bottom, find subtotal → Label as `net_amount`
   - Find grand total → Label as `total_amount`

3. **Then annotate ALL line items** in the table:
   - For the FIRST row:
     - Select description → `line_item/description`
     - Select quantity number → `line_item/quantity`
     - Select unit price → `line_item/unit_price`
     - Select line total → `line_item/amount`
   - **Repeat for EVERY row** in the invoice

4. **Save** the document
5. **Verify** all fields are highlighted
6. Move to the next document

**Progress Tracker**: Keep a checklist
```
□ Document 1/10: _____________.pdf
□ Document 2/10: _____________.pdf
□ Document 3/10: _____________.pdf
□ Document 4/10: _____________.pdf
□ Document 5/10: _____________.pdf
□ Document 6/10: _____________.pdf
□ Document 7/10: _____________.pdf
□ Document 8/10: _____________.pdf
□ Document 9/10: _____________.pdf
□ Document 10/10: _____________.pdf
```

### 5. Annotation Best Practices

#### ✅ DO:
- Annotate **every instance** of the field in all documents
- Be consistent with text selection (exact boundaries)
- Include decimal points/commas if part of the number
- Annotate at least **10-15 documents** minimum for good results
- Review each document twice before saving

#### ❌ DON'T:
- Skip any instances (Document AI needs complete data)
- Include currency symbols in quantity (€, Kč, etc.)
- Include units in the quantity field (use separate `unit` field)
- Mix different annotation styles between documents

### 6. Common Quantity Annotation Mistakes

| ❌ Wrong | ✅ Correct | Reason |
|---------|-----------|---------|
| "5 kg" | "5" | Don't include units |
| "€25.50" | "25.50" | This is price, not quantity |
| "" (empty) | "1" | Don't skip implicit quantities |
| "5-10" | "5" or "10" | Annotate specific values |

### 7. Re-train the Model

After fixing all annotations:

1. Click **"Save"** in the annotation tool
2. Return to the processor page
3. Click **"Train new version"**
4. Wait for training to complete (typically 30-60 minutes)
5. Monitor the training status in Operations

### 8. Validation Checklist

Before starting training, verify:

- [ ] **AT LEAST 10 documents** are fully annotated
- [ ] **EVERY document** has ALL invoice-level fields (supplier_name, invoice_id, invoice_date, net_amount, total_amount)
- [ ] **EVERY line item** in each document has ALL line item fields (description, quantity, unit_price, amount)
- [ ] No duplicate or overlapping annotations
- [ ] Quantities are numbers only (no units like "kg" included)
- [ ] Dates are in consistent format
- [ ] All monetary values include decimals where applicable
- [ ] No skipped rows in invoice tables

### 9. Why 10 Documents Minimum?

Google Cloud Document AI uses machine learning and requires:
- **Statistical significance**: 10+ samples to learn patterns
- **Variation coverage**: Different invoice layouts and formats
- **Error margin**: Training needs redundancy to handle edge cases

**What happens if you have less than 10?**
- ❌ Training will fail immediately during validation
- ❌ You'll get "INVALID_DATASET" error
- ❌ No processor version will be created

## Prevention Tips

### For Future Training:

1. **Create an annotation template** - Document your field definitions
2. **Use annotation guidelines** - Share with your team
3. **Validate before training** - Check all required fields
4. **Start small** - Test with 5 documents before scaling up
5. **Regular reviews** - Check annotations after adding new documents

### Recommended Training Dataset Size:

- **Minimum**: 10 documents (for simple invoices)
- **Good**: 20-30 documents (for varied formats)
- **Optimal**: 50+ documents (for production use)

## Troubleshooting

### "I annotated everything but it still fails!"

**Common mistakes:**

1. **Partial annotations**: You annotated 10 documents BUT:
   - ❌ Skipped some line items in the tables
   - ❌ Missed invoice-level fields like `net_amount` or `invoice_date`
   - ❌ Only annotated first 3 rows, forgot the rest

2. **Wrong field types**: 
   - ❌ Included "kg" in `line_item/quantity` (should be number only)
   - ❌ Selected the header row instead of data
   - ❌ Mixed up `net_amount` and `total_amount`

3. **Split across train/test**: 
   - ❌ You have 10 total documents, but split 8 in test, 2 in train
   - ✅ You need 10 FULLY annotated in TRAINING set alone

### If training fails again:

1. **Check the operation metadata** for specific errors:
   - Look for "num_documents_with_annotation" vs "num_documents_required"
   - If it says "2" or "5" or anything less than 10, you need more

2. **Count your complete documents**:
   - Go to Training tab → View labels
   - Open each document and verify EVERY field is highlighted
   - Count only documents where ALL fields are present

3. **Review one document line-by-line**:
   - Open your "best" annotated document
   - Check: Does it have supplier_name? ✓
   - Check: Does it have invoice_date? ✓
   - Check: Does it have net_amount? ✓
   - Check: Does EVERY row have quantity? ✓
   - This is what ALL 10 documents must look like

### Getting Help:

- **Google Cloud Support**: https://cloud.google.com/support
- **Document AI Documentation**: https://cloud.google.com/document-ai/docs
- **Stack Overflow**: Tag with `google-cloud-document-ai`

## Next Steps - Your Action Plan

### Week 1: Annotate Core Dataset
1. ✅ **Day 1-2**: Annotate first 5 documents (2-3 hours)
   - Focus on most common invoice layout
   - Document your annotation process
2. ✅ **Day 3-4**: Annotate next 5 documents (2-3 hours)
   - Include some variation in layouts
   - Double-check first 5 documents
3. ✅ **Day 5**: Review all 10 documents
   - Verify every field is annotated
   - Check for consistency
   - **Trigger training**

### Week 2: Train & Evaluate
4. ✅ **Wait for training** (30-60 minutes)
5. ✅ **Test the model** with new invoices
6. ✅ **Evaluate accuracy**:
   - Is it extracting quantities correctly?
   - Are supplier names accurate?
   - Are line items grouped properly?

### Week 3+: Improve
7. ✅ **If accuracy < 80%**: Annotate 10-20 more documents
8. ✅ **If accuracy > 80%**: Start using in production
9. ✅ **Continuously improve**: Add more training data over time

### Realistic Timeline
- **Minimum viable**: 1 week (10 documents)
- **Production ready**: 2-4 weeks (20-30 documents)
- **High accuracy**: 1-2 months (50+ documents)

## Related Files

- Application hook: `src/hooks/useDocumentAI.ts`
- Edge function: `supabase/functions/process-document/index.ts`
- Setup guide: `DOCUMENT_AI_SETUP.md`

## Processor Information

- **Project ID**: 832370309522
- **Location**: eu
- **Processor ID**: b5de41a4cf52cc70
- **Latest Failed Version**: 2ebd81e50327314c
- **Operation ID**: 3367990916943395816
- **Training Started**: 2025-10-19T16:12:54.222933Z
- **Failed At**: 2025-10-19T16:13:06.367051Z
- **Duration**: ~12 seconds (validation failed immediately)

### Error Summary
- **Training Dataset Errors**: 24 document errors, 16 dataset errors
- **Test Dataset Errors**: 33 document errors, 6 dataset errors
- **Root Cause**: Only 2/10 required documents fully annotated

---

## Status

**Status**: ⚠️ **BLOCKED** - Insufficient training data

**Priority**: **CRITICAL** - Cannot proceed without completing annotations

**Estimated Fix Time**: 
- **Quick path**: 2.5-5 hours (annotate 8 more documents)
- **Proper path**: 5-10 hours (annotate 10-20 documents for better accuracy)

**Blocker**: You cannot train until you have at least **10 fully annotated documents** in your training set.

---

## Summary

**The Issue**: You tried to train with only 2 complete documents.

**The Solution**: Annotate at least 8 more documents (10 total minimum).

**Why This Matters**: Machine learning needs sufficient examples to learn patterns. 2 documents is not enough data for the AI to understand invoice structures.

**Next Action**: Open Google Cloud Console and start annotating. Progress: 2/10 complete (20%)

