#!/bin/bash

# Wait for dependencies to be ready
echo "Starting Invoice OCR Service..."

# Check if Tesseract is available
if ! command -v tesseract &> /dev/null; then
    echo "Error: Tesseract not found"
    exit 1
fi

# Check if required Python packages are installed
python -c "import fastapi, pytesseract, PIL, pdf2image, pyzbar, cv2" || {
    echo "Error: Required Python packages not found"
    exit 1
}

echo "All dependencies ready. Starting server..."

# Start the application
exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1 --log-level info