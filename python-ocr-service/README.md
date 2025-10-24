# Invoice OCR Service

Template-based OCR service for extracting data from supplier invoices.

## Features

- Template-based extraction using Tesseract OCR
- Support for PDF and image files
- Configurable per-supplier templates
- Line item extraction with product codes, quantities, and prices
- High accuracy for structured invoices

## Installation

### Local Development

1. Install Tesseract OCR:

**Windows:**
```bash
# Download installer from: https://github.com/UB-Mannheim/tesseract/wiki
# Install Czech language: tesseract-ocr-ces
```

**Linux:**
```bash
sudo apt-get install tesseract-ocr tesseract-ocr-ces poppler-utils
```

**macOS:**
```bash
brew install tesseract tesseract-lang poppler
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Run the service:
```bash
python main.py
```

The service will be available at `http://localhost:8000`

### Docker

Build and run with Docker:

```bash
docker-compose up -d
```

## API Usage

### Process Invoice

**Endpoint:** `POST /process-invoice`

**Request:**
```json
{
  "file_base64": "base64_encoded_file_content",
  "file_name": "invoice.pdf",
  "template_config": {
    "ocr_settings": {
      "dpi": 300,
      "language": "ces",
      "psm": 6
    },
    "patterns": {
      "invoice_number": "Faktura č\\.: (\\d+)",
      "date": "Datum: (\\d{2}\\.\\d{2}\\.\\d{4})",
      "total_amount": "Celkem:\\s+([\\d\\s,]+)",
      "table_start": "Kód\\s+Položka\\s+Množství",
      "table_end": "Celkem:"
    },
    "table_columns": {
      "line_pattern": "^(\\d+)\\s+(.+?)\\s+(\\d+[.,]?\\d*)\\s+(.+?)\\s+(\\d+[.,]?\\d*)\\s+(\\d+[.,]?\\d*)$"
    }
  }
}
```

**Response:**
```json
{
  "invoice_number": "2024001",
  "date": "24.10.2024",
  "supplier": "Pešek - Rambousek",
  "total_amount": 45678.50,
  "items": [
    {
      "product_code": "10001",
      "description": "Mouka pšeničná hladká",
      "quantity": 50.0,
      "unit_of_measure": "kg",
      "unit_price": 25.50,
      "line_total": 1275.00,
      "line_number": 1
    }
  ],
  "confidence": 95.5,
  "raw_text": "..."
}
```

## Template Configuration

### OCR Settings

- `dpi`: Scan resolution (default: 300)
- `language`: Tesseract language code (ces = Czech, eng = English)
- `psm`: Page segmentation mode:
  - 3: Fully automatic page segmentation
  - 6: Uniform block of text (recommended for invoices)
  - 11: Sparse text

### Patterns

Regular expressions to extract specific fields:

```python
{
  "invoice_number": r"Faktura č\.: (\d+)",
  "date": r"Datum: (\d{2}\.\d{2}\.\d{4})",
  "supplier": r"Dodavatel:\s*(.+?)(?=\n)",
  "total_amount": r"Celkem:\s+([\d\s,]+)",
  "table_start": r"Kód\s+Položka\s+Množství",
  "table_end": r"Celkem:"
}
```

### Table Columns

Optional: Define exact line item pattern:

```python
{
  "line_pattern": r"^(\d+)\s+(.+?)\s+(\d+[.,]?\d*)\s+(.+?)\s+(\d+[.,]?\d*)\s+(\d+[.,]?\d*)$"
}
```

Groups: (code, description, quantity, unit, unit_price, line_total)

## Testing

Test the service with a sample invoice:

```bash
curl -X POST http://localhost:8000/process-invoice \
  -H "Content-Type: application/json" \
  -d @test_invoice.json
```

## Deployment

### Railway / Render / Fly.io

1. Push to GitHub
2. Connect repository to platform
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variable: `PYTHON_OCR_SERVICE_URL=https://your-service.railway.app`

### Docker Deployment

```bash
docker build -t invoice-ocr .
docker run -p 8000:8000 invoice-ocr
```

## Troubleshooting

### Tesseract Not Found

Ensure Tesseract is installed and in PATH:
```bash
tesseract --version
```

### Poor OCR Quality

1. Increase DPI in template config (try 400-600)
2. Check language is correct (ces for Czech)
3. Try different PSM mode
4. Ensure invoice is not rotated or skewed

### Missing Dependencies

```bash
# Install all system dependencies
sudo apt-get install tesseract-ocr tesseract-ocr-ces poppler-utils
```

