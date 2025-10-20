# Document AI - Quick Start Guide

## 🚨 CRITICAL ISSUE

Your training failed because you only have **2 properly annotated documents**.

**You need**: Minimum **10 fully annotated documents** before you can train.

**Current progress**: 2/10 (20%) ✅✅⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️

---

## ⏱️ Time Commitment

- **Per document**: 15-30 minutes
- **8 more documents needed**: 2-4 hours
- **Total to get started**: 2-4 hours of focused work

---

## 🎯 What You Need to Do RIGHT NOW

### 1. Open Google Cloud Console
```
https://console.cloud.google.com/ai/document-ai/processors
→ Select processor: b5de41a4cf52cc70
→ Go to "Train" tab
→ Click "View/Edit labels"
```

### 2. Pick 8 More Invoices
- Choose clear, readable PDFs
- Similar layout to your already-annotated 2 documents
- Representative of typical supplier invoices

### 3. For EACH Invoice, Annotate These Fields

**Header (5 fields, once per document):**
1. `supplier_name` - Vendor name
2. `invoice_id` - Invoice number
3. `invoice_date` - Invoice date
4. `net_amount` - Subtotal before tax
5. `total_amount` - Total with tax

**Line Items (4 fields, for EVERY product row):**
1. `line_item/description` - Product name
2. `line_item/quantity` - **NUMBER ONLY** (e.g., "5", not "5 kg")
3. `line_item/unit_price` - Price per unit
4. `line_item/amount` - Line total

### 4. Save and Repeat

Continue until you have **10 fully annotated documents**.

### 5. Train

Once you hit 10 documents:
- Click "Train new version"
- Wait 30-60 minutes
- Test the results

---

## 📚 Documentation Available

I've created 3 detailed guides for you:

### 1. 📖 `DOCUMENT_AI_TRAINING_FIX.md`
**Use for**: Understanding the problem and complete solution
- Error analysis
- Step-by-step fix instructions
- Troubleshooting
- Timeline planning

### 2. ✅ `DOCUMENT_AI_ANNOTATION_CHECKLIST.md`
**Use for**: Keep open while annotating
- Quick field reference
- Progress tracker
- Common mistakes to avoid
- Time estimates

### 3. 🎨 `DOCUMENT_AI_ANNOTATION_EXAMPLES.md`
**Use for**: Visual examples of what to annotate
- Invoice layout examples
- Edge cases and patterns
- What to annotate vs what to skip
- Real-world examples

---

## 🎯 Your Action Plan

### Today (2-4 hours):
```
✓ Already completed: 2 documents ✅
□ Annotate documents 3-4 (1 hour)
□ Take a break
□ Annotate documents 5-7 (1 hour)
□ Take a break
□ Annotate documents 8-10 (1 hour)
□ Review all 10 documents (30 min)
□ Start training
```

### Tomorrow:
```
□ Check training results
□ Test with sample invoices
□ Evaluate accuracy
```

### Next Week:
```
□ If accuracy < 80%: Annotate 10 more documents
□ If accuracy > 80%: Start using in production
```

---

## 💡 Pro Tips

1. **Start with simplest invoices** - Build confidence first
2. **Go row by row** - Don't skip any line items
3. **Be consistent** - Use same format for all documents
4. **Take breaks** - Every 3 documents, rest 10 minutes
5. **Double-check** - Verify before saving each document

---

## ⚠️ Common Mistakes That Will Cause Training to Fail

1. ❌ Annotating only 5-9 documents (need 10 minimum)
2. ❌ Skipping line items (all rows must be annotated)
3. ❌ Including "kg" in quantity (should be "5", not "5 kg")
4. ❌ Missing invoice header fields (all 5 required)
5. ❌ Annotating headers instead of data (don't label "Množství:", label "5")

---

## 📊 Progress Tracker

Copy this and update as you go:

```
✅ Document 1: COMPLETE
✅ Document 2: COMPLETE
□  Document 3: _________________
□  Document 4: _________________
□  Document 5: _________________
□  Document 6: _________________
□  Document 7: _________________
□  Document 8: _________________
□  Document 9: _________________
□  Document 10: _________________

Progress: 2/10 (20%)
Status: 🔴 BLOCKED - Cannot train yet
Next milestone: 5/10 (50%)
```

---

## 🆘 If You Get Stuck

### Training fails again with same error?
→ Read `DOCUMENT_AI_TRAINING_FIX.md` section "Troubleshooting"

### Not sure what to annotate?
→ Read `DOCUMENT_AI_ANNOTATION_EXAMPLES.md`

### Need quick reference while working?
→ Keep `DOCUMENT_AI_ANNOTATION_CHECKLIST.md` open

### Question about specific field?
→ Check the field definitions in any of the guides

---

## ✅ Success Criteria

You'll know you're ready to train when:

1. ✅ You have 10+ documents in training set
2. ✅ Each document has ALL 5 header fields annotated
3. ✅ Each document has ALL line items fully annotated
4. ✅ No skipped rows or missing fields
5. ✅ Consistent annotation style across all documents

---

## 🎉 After Successful Training

Once training succeeds (30-60 minutes):

1. Test processor with new invoices
2. Check extraction accuracy
3. If < 80% accurate: Annotate 10 more documents
4. If > 80% accurate: Integrate into your application
5. Continue improving by adding more training data

---

## 📞 Support

- **Google Cloud Support**: https://cloud.google.com/support
- **Document AI Docs**: https://cloud.google.com/document-ai/docs
- **Your application hook**: `src/hooks/useDocumentAI.ts`

---

## 🚀 Let's Get Started!

**Next action**: Open Google Cloud Console and start annotating document #3.

**Remember**: You're 20% done. Just 8 more documents to go! 💪

**Estimated completion**: 2-4 hours from now

**Last Updated**: 2025-10-19 16:13 (after second training failure)

