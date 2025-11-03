# HEIC to JPG Conversion Support

## Overview

The application now supports **HEIC/HEIF** image files (commonly used by iPhones) with automatic conversion to JPG format before upload.

## Features

### ✅ **Supported Formats**
- **PDF** - Native support
- **JPG/JPEG** - Native support
- **PNG** - Native support
- **HEIC/HEIF** - Automatic conversion to JPG ✨ NEW

### 🔄 **Automatic Conversion**

When you upload a HEIC file:
1. The system detects it's a HEIC/HEIF format
2. Shows a toast notification: "Převádím HEIC na JPG formát..."
3. Converts the image to high-quality JPG (90% quality)
4. Shows success notification with the converted filename
5. Proceeds with normal upload processing

### 📍 **Where It Works**

HEIC conversion is available in:
- **Invoice Upload Dialog** (`InvoiceUploadDialog.tsx`)
  - Main invoice upload for received invoices
  - Full support with progress feedback
  
- **Template Test Upload** (`admin.invoice-templates.tsx`)
  - Testing invoice templates with sample files
  - Automatic conversion without user interaction needed

## Technical Details

### Implementation

#### Core Converter (`src/utils/heicConverter.ts`)
```typescript
// Check if file is HEIC
isHeicFile(file: File): boolean

// Convert HEIC to JPG
convertHeicToJpg(file: File): Promise<File>

// Handle file with automatic conversion
handleFileWithHeicConversion(file: File): Promise<File>
```

#### Package Used
- **heic2any** - v0.0.4+
  - Lightweight HEIC/HEIF to JPG/PNG converter
  - Browser-based conversion (no server-side processing)
  - High compatibility with iOS photos

### Conversion Settings

- **Output Format**: JPEG
- **Quality**: 0.9 (90% - high quality)
- **Filename**: Original name with `.jpg` extension
  - Example: `IMG_1234.HEIC` → `IMG_1234.jpg`

### Browser Compatibility

Works in modern browsers that support:
- Web Assembly (WASM)
- File API
- Blob API

**Tested on:**
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## User Experience

### Upload Flow

1. **Select File**
   ```
   User clicks "Choose File" → Selects HEIC image
   ```

2. **Detection & Conversion**
   ```
   System detects HEIC → Shows conversion toast
   → Converts to JPG in browser
   ```

3. **Success Feedback**
   ```
   Shows: "Soubor IMG_1234.HEIC úspěšně převeden na IMG_1234.jpg"
   ```

4. **Normal Processing**
   ```
   Continues with OCR and invoice processing
   ```

### Error Handling

If conversion fails:
- Shows error toast with details
- Prevents upload of unconverted file
- User can try again or select different file

## Benefits

### 🎯 **For Users**
- ✅ No need to convert HEIC files manually
- ✅ Can upload photos directly from iPhone
- ✅ Seamless experience with clear feedback
- ✅ No quality loss with 90% JPEG quality

### ⚡ **For System**
- ✅ Client-side conversion (no server load)
- ✅ Reduces server storage (JPG more compatible)
- ✅ Works with existing OCR pipeline
- ✅ No Python backend changes needed

## File Size Considerations

HEIC files are typically **smaller** than equivalent JPG:
- HEIC: ~1-3 MB (high compression)
- Converted JPG: ~2-5 MB (90% quality)

**Note**: Slight file size increase after conversion is normal and expected.

## Troubleshooting

### Issue: "Nepodařilo se převést HEIC soubor"

**Possible causes:**
1. **Corrupted HEIC file** - Try opening in photo viewer first
2. **Unsupported HEIC variant** - Some proprietary formats not supported
3. **Browser compatibility** - Update browser to latest version
4. **Memory limitations** - Very large HEIC files (>50MB) may fail

**Solutions:**
- Convert manually using online tool or Apple Photos
- Try different HEIC file
- Update browser
- Compress image before upload

### Issue: "File too large after conversion"

If converted JPG exceeds upload limit:
1. Use iPhone "Optimize iPhone Storage" setting
2. Compress original HEIC before upload
3. Convert to JPG with lower quality manually

## Future Enhancements

Potential improvements:
- [ ] Batch HEIC conversion for multiple files
- [ ] User-selectable JPG quality (trade-off size vs quality)
- [ ] Progress bar for large HEIC files
- [ ] Support for HEIC sequences (burst photos)
- [ ] WebP output option for even better compression

## Code Examples

### Basic Usage

```typescript
import { handleFileWithHeicConversion } from '@/utils/heicConverter';

// In file input handler
const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;
  
  // Automatic conversion
  const processedFile = await handleFileWithHeicConversion(file);
  
  // Use processedFile for upload
  uploadFile(processedFile);
};
```

### Manual Check

```typescript
import { isHeicFile } from '@/utils/heicConverter';

if (isHeicFile(file)) {
  console.log('HEIC file detected!');
}
```

## Credits

- **heic2any** by [alexcorvi](https://github.com/alexcorvi/heic2any)
- HEIC support added: November 2024

## Related Files

- `src/utils/heicConverter.ts` - Core conversion logic
- `src/components/InvoiceUploadDialog.tsx` - Main invoice upload
- `src/routes/admin.invoice-templates.tsx` - Template test upload
- `package.json` - heic2any dependency

---

**Note**: HEIC files are automatically converted. No user action required beyond selecting the file! 🎉

