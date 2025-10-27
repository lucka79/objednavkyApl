# QR Code Detection Feature

## Overview

The OCR service now automatically detects and decodes QR codes from all pages of uploaded invoices.

## How It Works

1. **Automatic Detection**: When you upload an invoice, the system scans all pages for QR codes
2. **Multi-page Support**: QR codes on any page (including page 2+) are detected
3. **Multiple Codes**: Can detect multiple QR codes in a single document
4. **Auto-decode**: QR codes are automatically decoded and displayed

## What Gets Detected

- **QR Codes** (QRCODE)
- **Barcodes** (EAN13, CODE128, etc.)
- **Data Matrix** codes
- Other 2D barcodes

## Display

Detected QR codes are shown in a purple card with:
- **Page number** where the code was found
- **Type** of code (QRCODE, EAN13, etc.)
- **Data** decoded from the code
- **Copy button** to copy data to clipboard

## Technical Details

### Backend
- Uses `pyzbar` and `opencv-python` for detection
- Processes all pages automatically
- Returns array of detected codes with metadata

### Response Format
```json
{
  "qr_codes": [
    {
      "data": "https://example.com/invoice/12345",
      "type": "QRCODE",
      "page": 2
    }
  ]
}
```

### Dependencies Added
- `pyzbar>=0.1.9`
- `opencv-python-headless>=4.8.0`
- System: `libzbar0`, `libgl1-mesa-glx`, `libglib2.0-0`

## Deployment

To deploy with QR code support:

1. **Rebuild the Docker image**:
```bash
cd python-ocr-service
docker build -t invoice-ocr-service .
```

2. **Or on Railway/other platforms**:
   - The updated `requirements.txt` and `Dockerfile` will be used automatically
   - Redeploy the service to apply changes

## Use Cases

- **Payment QR codes** on invoices
- **Invoice verification** codes
- **Tracking numbers** encoded in QR
- **Digital signatures** or checksums
- **URLs** for online invoice verification

## Example

When a Zeelandia invoice is uploaded with a QR code on page 2:

```
📱 QR kódy nalezené ve faktuře
┌────────────────────────────────────┐
│ Strana 2     Typ: QRCODE          │
│ ┌────────────────────────────────┐ │
│ │ SPD*1.0*AM:25342.51*CC:CZK*... │ │
│ └────────────────────────────────┘ │
│              [📋 Kopírovat]        │
└────────────────────────────────────┘
```

## Notes

- QR detection runs automatically for all invoices
- No template configuration needed
- Works with both PDF and image files
- Detection is fast (~100-200ms per page)

