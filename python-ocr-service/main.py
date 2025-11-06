"""
Template-based Invoice OCR Service
Extracts data from invoices using supplier-specific templates
Version: 2.0.1 - Albert format support with weight field
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pytesseract
from PIL import Image
import pdf2image
import re
import io
import base64
from typing import Dict, List, Optional, Any
import logging
from pyzbar import pyzbar
import numpy as np
import cv2

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Invoice OCR Service")

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ProcessInvoiceRequest(BaseModel):
    file_base64: str
    file_name: str
    template_config: Dict[str, Any]

class InvoiceItem(BaseModel):
    product_code: Optional[str] = None
    description: Optional[str] = None
    quantity: float = 0
    unit_of_measure: Optional[str] = None
    unit_price: float = 0
    line_total: float = 0
    line_number: int = 0
    base_price: Optional[float] = None  # MAKRO: zákl. cena (base price per package)
    units_in_mu: Optional[float] = None  # MAKRO: jedn. v MU (units in measurement unit)
    vat_rate: Optional[float] = None  # MAKRO: DPH%
    vat_amount: Optional[float] = None  # MAKRO: DPH (CZK)
    total_with_vat: Optional[float] = None  # MAKRO: Celkem s DPH
    package_weight_kg: Optional[float] = None  # Weight per package in kg (extracted from description)
    total_weight_kg: Optional[float] = None  # Total weight: quantity × package_weight_kg
    price_per_kg: Optional[float] = None  # Price per kilogram: line_total / total_weight_kg
    item_weight: Optional[str] = None  # Item weight as string (e.g., "125g", "2,5kg") for retail formats
    package_weight: Optional[float] = None  # ZEELANDIA: Obsah (package weight value)
    package_weight_unit: Optional[str] = None  # ZEELANDIA: Obsah unit (KG/PCE/G)
    total_weight: Optional[float] = None  # ZEELANDIA: Fakt.mn (total weight value)
    total_weight_unit: Optional[str] = None  # ZEELANDIA: Fakt.mn unit (KG/PCE/G)

class QRCodeData(BaseModel):
    data: str
    type: str
    page: int
    
class ProcessInvoiceResponse(BaseModel):
    invoice_number: Optional[str] = None
    date: Optional[str] = None
    supplier: Optional[str] = None
    total_amount: float = 0
    payment_type: Optional[str] = None
    items: List[InvoiceItem] = []
    confidence: float = 0
    raw_text: Optional[str] = None
    qr_codes: List[QRCodeData] = []

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "invoice-ocr"}

@app.post("/process-invoice", response_model=ProcessInvoiceResponse)
async def process_invoice(request: ProcessInvoiceRequest):
    """
    Process invoice using template-based extraction
    """
    try:
        logger.info(f"Processing invoice: {request.file_name}")
        
        # Decode base64 file
        file_bytes = base64.b64decode(request.file_base64)
        
        # Convert PDF to image(s)
        images = convert_to_images(file_bytes, request.file_name)
        
        if not images:
            raise HTTPException(status_code=400, detail="Failed to convert file to images")
        
        # Get OCR settings from template
        ocr_config = request.template_config.get('ocr_settings', {})
        dpi = ocr_config.get('dpi', 300)
        language = ocr_config.get('language', 'ces')
        psm = ocr_config.get('psm', 6)
        
        # Perform OCR on all pages
        custom_config = f'--oem 3 --psm {psm}'
        all_pages_text = []
        
        logger.info(f"Processing {len(images)} page(s)")
        
        for page_num, image in enumerate(images, 1):
            page_text = pytesseract.image_to_string(image, lang=language, config=custom_config)
            all_pages_text.append(f"\n--- Page {page_num} ---\n{page_text}")
            logger.info(f"Page {page_num} OCR completed, text length: {len(page_text)}")
        
        # Combine all pages
        raw_text = "\n".join(all_pages_text)
        
        logger.info(f"OCR completed for all pages, total text length: {len(raw_text)}")
        
        # Remove page markers and clean up page breaks for seamless table extraction
        raw_text_display = raw_text
        
        # Remove page markers
        raw_text_display = re.sub(r'\n--- Page \d+ ---\n', '\n', raw_text_display)
        
        # Remove repeated footers (typically "Vystavil:" or similar at end of pages)
        # Look for pattern: Vystavil: [text] [dashes]
        raw_text_display = re.sub(r'Vystavil:.*?[\-—]{2,}.*?(?=\n|$)', '', raw_text_display, flags=re.MULTILINE | re.DOTALL)
        
        # Remove repeated page headers (e.g., "DAŇOVÝ DOKLAD Číslo dokladu XXX Strana: N")
        raw_text_display = re.sub(r'DAŇOVÝ DOKLAD.*?Strana:\s*\d+\n', '', raw_text_display, flags=re.IGNORECASE)
        
        # Remove "continuation" messages that appear between pages
        # Example: "Tento doklad má pokračování na stránce č. 2"
        continuation_patterns = [
            r'Tento\s+doklad\s+má\s+pokračování\s+na\s+stránce\s+č\.\s*\d+',
            r'pokračování\s+na\s+stránce\s+č\.\s*\d+',
            r'continuation\s+on\s+page\s+\d+',
        ]
        for pattern in continuation_patterns:
            raw_text_display = re.sub(pattern, '', raw_text_display, flags=re.IGNORECASE)
            logger.debug(f"Removed continuation pattern: {pattern}")
        
        # Find and keep ONLY the first table header, remove all subsequent ones
        table_header_pattern = r'Označení\s+dodávky\s+Množství\s+Cena/MJ\s+DPH\s+Sleva\s+Celkem'
        matches = list(re.finditer(table_header_pattern, raw_text_display))
        
        if len(matches) > 1:
            # Keep the first match, remove all others
            logger.info(f"Found {len(matches)} table headers, keeping first and removing {len(matches) - 1} duplicates")
            
            # Replace all matches except the first with empty string
            for match in reversed(matches[1:]):  # Reverse to maintain positions
                start, end = match.span()
                raw_text_display = raw_text_display[:start] + raw_text_display[end:]
        
        # Also remove "Předmět zdanitelného plnění Množství / j. v CZK bez bez DPH DPH" headers that appear on subsequent pages
        # This is the Backaldrin table header format
        backaldrin_header_pattern = r'Předmět\s+zdanitelného\s+plnění\s+Množství\s*/\s*j\.\s+v\s+CZK\s+bez\s+bez\s+DPH\s+DPH'
        backaldrin_matches = list(re.finditer(backaldrin_header_pattern, raw_text_display, re.IGNORECASE))
        if len(backaldrin_matches) > 1:
            logger.info(f"Found {len(backaldrin_matches)} Backaldrin table headers, keeping first and removing {len(backaldrin_matches) - 1} duplicates")
            for match in reversed(backaldrin_matches[1:]):
                start, end = match.span()
                raw_text_display = raw_text_display[:start] + raw_text_display[end:]
        
        # Clean up excessive blank lines (more than 2 consecutive newlines)
        raw_text_display = re.sub(r'\n{3,}', '\n\n', raw_text_display)
        
        # Apply OCR error corrections (common Tesseract mistakes)
        raw_text_display = fix_ocr_errors(raw_text_display)
        
        # Extract data using template patterns (use cleaned text for better extraction)
        patterns = request.template_config.get('patterns', {})
        
        # Override patterns for specific suppliers based on display_layout
        # This ensures proven patterns are always used, regardless of template configuration
        display_layout = request.template_config.get('display_layout', '')
        if display_layout.lower() == 'dekos':
            logger.info("🔧 Dekos display_layout detected - overriding invoice_number pattern")
            # Override invoice number pattern to handle Czech diacritics (DAŇOVÝ vs DANOVY)
            # Support both with and without diacritics
            patterns['invoice_number'] = r'(?:DAŇOVÝ|DANOVY|Daňový|Danovy)\s+DOKLAD\s*-\s*faktura\s+č\.\s*(\d{5,})'
            logger.info(f"   Using Dekos invoice_number: {patterns['invoice_number']}")
        elif display_layout.lower() == 'zeelandia':
            logger.info("🔧 Zeelandia display_layout detected - overriding patterns (pure sequence)")
            # Zeelandia: Labels and values are SEPARATED (labels first, values after)
            # Extract by pure value patterns in sequence order
            
            # 1st: Invoice number - first standalone 9-digit number (after "Zeelandia" company name)
            patterns['invoice_number'] = r'Zeelandia[\s\S]+?(\d{9})'
            # 2nd: Total amount - first amount with space thousands separator (e.g., "33 751,78")
            patterns['total_amount'] = r'(\d{1,3}(?:\s\d{3})*,\d{2})\s*(?:CZK|Kč)'
            # 3rd: Date - first date in DD.MM.YYYY format (appears multiple times, take first)
            patterns['date'] = r'(\d{1,2}\.\d{1,2}\.\d{4})'
            # 4th: Payment type - word after all dates, not "DIČ" (look for Czech payment terms)
            patterns['payment_type'] = r'(?:\d{1,2}\.\d{1,2}\.\d{4})\s+([A-ZÁ-Žá-žů][a-zá-žů]+(?:\s+[a-zá-žů]+)?)'
            
            logger.info(f"   Using Zeelandia invoice_number (pure sequence): {patterns['invoice_number']}")
            logger.info(f"   Using Zeelandia total_amount (pure sequence): {patterns['total_amount']}")
            logger.info(f"   Using Zeelandia date (pure sequence): {patterns['date']}")
            logger.info(f"   Using Zeelandia payment_type (pure sequence): {patterns['payment_type']}")
        
        invoice_number = extract_pattern(raw_text_display, patterns.get('invoice_number'))
        date = extract_pattern(raw_text_display, patterns.get('date'))
        supplier = extract_pattern(raw_text_display, patterns.get('supplier'))
        
        # Extract total amount with detailed logging
        total_amount_pattern = patterns.get('total_amount')
        logger.info(f"🔍 Extracting total_amount with pattern: {total_amount_pattern}")
        
        # Debug: Search for "Celková částka" in the text
        if 'celková částka' in raw_text_display.lower():
            logger.info(f"✅ Found 'Celková částka' in text")
            # Find all occurrences
            lines = raw_text_display.split('\n')
            for i, line in enumerate(lines):
                if 'celková částka' in line.lower():
                    logger.info(f"   Line {i}: '{line.strip()}'")
                    # Show surrounding lines
                    if i > 0:
                        logger.info(f"   Previous line {i-1}: '{lines[i-1].strip()}'")
                    if i < len(lines) - 1:
                        logger.info(f"   Next line {i+1}: '{lines[i+1].strip()}'")
        else:
            logger.warning(f"❌ 'Celková částka' NOT found in text")
            # Show first 500 chars to help debug
            logger.warning(f"   First 500 chars of text: {raw_text_display[:500]}")
        
        total_amount_str = extract_pattern(raw_text_display, total_amount_pattern)
        if total_amount_str:
            # Clean up extracted value - remove newlines and extra whitespace
            total_amount_str = total_amount_str.strip().replace('\n', ' ').replace('\r', ' ')
            # Remove any trailing non-digit characters that might have been captured
            total_amount_str = re.sub(r'[^\d\s,\.]+$', '', total_amount_str).strip()
            total_amount = extract_number(total_amount_str)
            logger.info(f"💰 Total amount extracted: '{total_amount_str}' (cleaned) -> {total_amount}")
        else:
            total_amount = 0
            logger.warning(f"⚠️ Total amount not found with pattern: {total_amount_pattern}")
            # Try to manually test the pattern
            if total_amount_pattern:
                try:
                    test_match = re.search(total_amount_pattern, raw_text_display, re.IGNORECASE | re.MULTILINE)
                    if test_match:
                        logger.warning(f"   ⚠️ BUT re.search() DID find match: '{test_match.group(1) if test_match.groups() else test_match.group(0)}'")
                    else:
                        logger.warning(f"   ❌ re.search() also failed - pattern likely doesn't match")
                        # Try simpler pattern
                        simple_test = re.search(r'Celková částka.*?(\d[\d\s,\.]+)', raw_text_display, re.IGNORECASE)
                        if simple_test:
                            logger.warning(f"   💡 Simple pattern found: '{simple_test.group(1)}'")
                except Exception as e:
                    logger.error(f"   Error testing pattern: {e}")
        
        payment_type = extract_pattern(raw_text_display, patterns.get('payment_type'))
        
        # Extract line items (use cleaned text for seamless multi-page extraction)
        items = extract_line_items(
            raw_text_display,
            images[0],
            request.template_config,
            language,
            psm
        )
        
        # Detect QR codes from all pages
        qr_codes = []
        for page_num, image in enumerate(images, 1):
            page_qr_codes = detect_qr_codes(image, page_num)
            qr_codes.extend(page_qr_codes)
        
        if qr_codes:
            logger.info(f"Found {len(qr_codes)} QR code(s) across all pages")
            for qr in qr_codes:
                logger.info(f"  Page {qr.page}: {qr.type} - {qr.data[:100]}...")
        
        # Calculate confidence based on extracted data
        confidence = calculate_confidence({
            'invoice_number': invoice_number,
            'date': date,
            'items': items,
        })
        
        logger.info(f"Extraction complete: {len(items)} items, confidence: {confidence:.2f}")
        
        return ProcessInvoiceResponse(
            invoice_number=invoice_number,
            date=date,
            supplier=supplier,
            total_amount=total_amount,
            payment_type=payment_type,
            items=items,
            confidence=confidence,
            raw_text=raw_text_display if len(raw_text_display) < 20000 else raw_text_display[:20000] + "\n\n... (text truncated for display)",
            qr_codes=qr_codes,
        )
        
    except Exception as e:
        logger.error(f"Error processing invoice: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

def fix_ocr_errors(text: str) -> str:
    """
    Fix common OCR errors from Tesseract
    """
    # Fix 1: "xl" should be "x" in product descriptions (e.g., "12xl1kg" → "12x1kg")
    text = re.sub(r'(\d+)xl(\d)', r'\1x\2', text)
    
    # Fix 2: Lowercase "l" followed by digit should be "1" (e.g., "1l2kg" → "12kg", "l1kg" → "11kg")
    text = re.sub(r'l(\d)', r'1\1', text)
    
    # Fix 2.5: "2lkg" should be "21kg" (l between digit and unit kg/g is likely "1")
    # Pattern: digit + "l" + (kg|g) - fixes cases like "2lkg" → "21kg", "1lkg" → "11kg"
    # This fixes OCR error where "1" is read as "l" before weight units
    # Use \g<1> to avoid ambiguity with \11 (group 11)
    text = re.sub(r'(\d)l(kg|g)(?=\s|$|,|\d)', r'\g<1>1\2', text)
    
    # Fix 2.6: "1l" or "2l" should be "1L" or "2L" (liter unit with uppercase L)
    # Pattern: digit(s) + lowercase "l" at word boundary or before space
    # Fixes cases like "Rosette 1l" → "Rosette 1L", "gel 2l" → "gel 2L"
    # This corrects OCR error where lowercase "l" should be uppercase "L" for liters
    text = re.sub(r'(\d+)l(?=\s|$|,)', r'\1L', text)
    
    # Fix 3: VAT percentage - "12 5" should be "12 %"
    # Only in table rows (NOT after ":" to avoid fixing amounts like "95 223,00")
    # Match when: 1-2 digits + optional space + "5" + space + digits + comma/space (table format)
    text = re.sub(r'(?<!:)\s(\d{1,2})\s+5(?=\s+\d+[,\s])', r' \1 %', text)
    
    # Fix 4: "215" should be "21 %" when it appears as VAT rate
    # Pattern: space + "215" + space + amount (e.g., "570,00 215 1 140,00" → "570,00 21 % 1 140,00")
    text = re.sub(r'\s215(?=\s+\d+[\s,])', ' 21 %', text)
    
    # Fix 5: Remove trailing period after numbers with comma thousand separator (e.g., "1,000." → "1,000")
    # Only match when there's a comma separator to avoid breaking decimals
    text = re.sub(r'(\d+,\d+)\.\s+', r'\1 ', text)
    
    # Fix 6: VAT rate corrections - "2%" should be "12%" in most cases
    # Pattern: space + "2%" at the end of a line or before currency
    text = re.sub(r'\s2%(?=\s+[A-Z]{2,3}\s|$)', ' 12%', text)
    
    # Fix 7: Another common VAT error - "21%" sometimes appears as "215" 
    # Pattern: "215" followed by space and currency or end of line
    text = re.sub(r'215(?=\s+[A-Z]{2,3}\s|$)', '21%', text)
    
    # Fix 8: Remove table border characters (|) used in old-school invoice designs
    # These are visual separators that interfere with data extraction
    # Remove at start/end of lines and between columns
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        # Remove leading and trailing pipes
        line = re.sub(r'^\s*\|+\s*', '', line)
        line = re.sub(r'\s*\|+\s*$', '', line)
        # Replace pipes between columns with single space
        line = re.sub(r'\s*\|\s*', ' ', line)
        cleaned_lines.append(line)
    text = '\n'.join(cleaned_lines)
    
    # Fix 9: Remove extraneous dashes before dates (Dekos format)
    # Pattern: "Datum splatnosti: — 03.10.2025" → "Datum splatnosti: 03.10.2025"
    # Remove em-dash (—), en-dash (–), and regular dash (-) when followed by a date
    text = re.sub(r':\s*[—–-]+\s*(\d{1,2}\.\d{1,2}\.\d{4})', r': \1', text)
    
    # Fix 10: Fix capacity indicators misread as numbers (Dekos format)
    # Pattern: "STOP BAKTER 51 108,1300" → "STOP BAKTER 5L 108,1300"
    # BUT: "STOP BAKTER 5L 51 108,1300" → no change (51 is thousands separator, not OCR error)
    # Strategy: Don't fix if the same digit appears in a capacity indicator earlier on the same line
    # Process line by line to avoid cross-line matches
    lines = text.split('\n')
    fixed_lines = []
    for line in lines:
        # Find all potential X1 patterns that need fixing
        # Pattern: NOT preceded by digit + word + space + X1 + space + price_with_4_decimals
        # Use word boundary to avoid matching "5L 51" where "L" from "5L" would be matched
        def replace_if_not_duplicate(match):
            letter = match.group(1)
            digit = match.group(2)
            price = match.group(3)
            # Check if "{digit}L" or "{digit}I" already exists earlier in the line
            capacity_indicator = f"{digit}L"
            capacity_indicator_alt = f"{digit}I"
            line_before_match = line[:match.start()]
            if capacity_indicator in line_before_match or capacity_indicator_alt in line_before_match:
                # Don't change - capacity indicator already exists
                return match.group(0)  # Return original
            else:
                # Fix: X1 → XL
                return f"{letter} {digit}L {price}"
        
        # Pattern: word boundary + letter (not preceded by digit) + space + X1 + space + price
        # Negative lookbehind (?<!\d) ensures the letter isn't part of a capacity indicator like "5L"
        fixed_line = re.sub(
            r'(?<!\d)([A-Za-zá-žÁ-Ž])\s+(\d)1\s+(\d+(?:\s\d+)?,\d{4})',
            replace_if_not_duplicate,
            line
        )
        fixed_lines.append(fixed_line)
    text = '\n'.join(fixed_lines)
    
    logger.info("Applied OCR error corrections")
    return text

def convert_to_images(file_bytes: bytes, filename: str) -> List[Image.Image]:
    """Convert PDF or image file to PIL Image(s)"""
    try:
        # Try as PDF first
        if filename.lower().endswith('.pdf'):
            images = pdf2image.convert_from_bytes(file_bytes, dpi=300)
            return images
        else:
            # Try as image
            image = Image.open(io.BytesIO(file_bytes))
            return [image]
    except Exception as e:
        logger.error(f"Error converting file: {e}")
        return []

def detect_qr_codes(image: Image.Image, page_num: int) -> List[QRCodeData]:
    """
    Detect and decode QR codes from an image
    """
    qr_codes = []
    
    try:
        # Convert PIL Image to numpy array for OpenCV
        img_array = np.array(image)
        
        # Convert RGB to BGR (OpenCV uses BGR)
        if len(img_array.shape) == 3 and img_array.shape[2] == 3:
            img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        
        # Convert to grayscale for better QR detection
        gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY)
        
        # Detect QR codes using pyzbar
        decoded_objects = pyzbar.decode(gray)
        
        for obj in decoded_objects:
            qr_data = obj.data.decode('utf-8', errors='ignore')
            qr_type = obj.type
            
            # Only include QR codes, skip barcodes (CODE128, EAN13, etc.)
            if qr_type == 'QRCODE':
                qr_codes.append(QRCodeData(
                    data=qr_data,
                    type=qr_type,
                    page=page_num
                ))
                logger.info(f"Detected {qr_type} on page {page_num}: {qr_data[:100]}")
            else:
                logger.debug(f"Skipping barcode {qr_type} on page {page_num}: {qr_data[:100]}")
    
    except Exception as e:
        logger.error(f"Error detecting QR codes on page {page_num}: {e}")
    
    return qr_codes

def extract_pattern(text: str, pattern: Optional[str]) -> Optional[str]:
    """Extract data using regex pattern"""
    if not pattern or not text:
        logger.debug(f"extract_pattern: Missing pattern or text (pattern={pattern is not None}, text_len={len(text) if text else 0})")
        return None
    
    # Special logging for total_amount pattern
    is_total_amount_pattern = 'Celková částka' in pattern or 'celková částka' in pattern.lower() if pattern else False
    
    if is_total_amount_pattern:
        logger.info(f"🎯 extract_pattern called for total_amount")
        logger.info(f"   Pattern: '{pattern}'")
        logger.info(f"   Text length: {len(text)} chars")
        logger.info(f"   Pattern length: {len(pattern)} chars")
    
    try:
        # Compile pattern first to catch syntax errors
        compiled_pattern = re.compile(pattern, re.IGNORECASE | re.MULTILINE)
        
        match = compiled_pattern.search(text)
        if match:
            extracted = match.group(1) if match.groups() else match.group(0)
            if is_total_amount_pattern:
                logger.info(f"✅✅✅ Pattern MATCHED for total_amount: '{extracted}'")
                logger.info(f"   Full match: '{match.group(0)}'")
                logger.info(f"   Groups: {match.groups()}")
            else:
                logger.info(f"✅ Pattern matched: '{pattern[:50]}...' -> '{extracted}'")
            return extracted
        else:
            # Pattern didn't match
            if is_total_amount_pattern:
                logger.warning(f"❌❌❌ Pattern did NOT match for total_amount")
                logger.warning(f"   Pattern: '{pattern}'")
                
                # Show the actual line with Celková částka
                lines = text.split('\n')
                for i, line in enumerate(lines):
                    if 'celková částka' in line.lower():
                        logger.warning(f"   Found 'Celková částka' at line {i}: '{line.strip()}'")
                        logger.warning(f"   Line length: {len(line)} chars")
                        
                        # Try to match just this line
                        line_match = compiled_pattern.search(line)
                        if line_match:
                            logger.warning(f"   ⚠️ BUT pattern DOES match when searching just this line!")
                            logger.warning(f"   Line match: '{line_match.group(1) if line_match.groups() else line_match.group(0)}'")
                        else:
                            logger.warning(f"   ❌ Pattern doesn't match even on this line alone")
                            
                            # Show character codes for debugging
                            logger.warning(f"   Line bytes: {line.encode('utf-8')}")
                        
                        # Show surrounding lines
                        if i > 0:
                            logger.warning(f"   Previous line {i-1}: '{lines[i-1].strip()}'")
                        if i < len(lines) - 1:
                            logger.warning(f"   Next line {i+1}: '{lines[i+1].strip()}'")
                        break
                else:
                    logger.warning(f"   'Celková částka' NOT found in text at all!")
                    logger.warning(f"   First 500 chars: {text[:500]}")
            else:
                logger.warning(f"❌ Pattern did NOT match: '{pattern[:80]}'")
                logger.warning(f"   Searched in text (first 200 chars): {text[:200]}")
    except re.error as e:
        logger.error(f"❌ Regex syntax error in pattern '{pattern}': {e}")
    except Exception as e:
        logger.error(f"Error extracting pattern '{pattern}': {e}", exc_info=True)
    
    return None

def extract_weight_from_description(description: str) -> Optional[float]:
    """
    Extract weight from product description and convert to kg.
    Examples: "125g" -> 0.125, "2,5kg" -> 2.5, "750ml" -> 0.75
    """
    if not description:
        return None
    
    # Pattern: number followed by weight unit (g, kg, l, ml)
    weight_pattern = r'(\d+[,.]?\d*)\s*(kg|g|l|ml)\b'
    match = re.search(weight_pattern, description, re.IGNORECASE)
    
    if match:
        weight_str = match.group(1).replace(',', '.')
        unit = match.group(2).lower()
        weight = float(weight_str)
        
        # Convert to kg
        if unit in ['g', 'ml']:
            weight = weight / 1000
        
        logger.debug(f"Extracted weight: {weight} kg from '{description}'")
        return weight
    
    return None

def extract_number(text: Optional[str]) -> float:
    """Extract number from text, handling Czech number format"""
    if not text:
        return 0
    
    # Handle Czech number format: "7 579,00" -> 7579.00
    # First, remove any currency codes (CZK, EUR, etc.)
    cleaned = re.sub(r'[A-Z]{2,}$', '', text.strip())
    
    # Then replace Czech decimal comma with period
    cleaned = cleaned.replace(',', '.')
    
    # Then remove spaces (thousands separators in Czech format)
    cleaned = cleaned.replace(' ', '')
    
    try:
        return float(cleaned)
    except:
        return 0

def extract_line_items(
    raw_text: str,
    image: Image.Image,
    template_config: Dict,
    language: str,
    psm: int
) -> List[InvoiceItem]:
    """
    Extract line items from invoice using template configuration
    """
    items = []
    patterns = template_config.get('patterns', {})
    table_columns = template_config.get('table_columns', {})
    
    # Override patterns for specific suppliers based on display_layout
    # This ensures proven patterns are always used, regardless of template configuration
    display_layout = template_config.get('display_layout', '')
    if display_layout.lower() == 'dekos':
        logger.info("🔧 Dekos display_layout detected - using proven Dekos table/line patterns")
        # For Dekos, items appear right after the payment/delivery info, before any table header
        # Look for "Zp.dopravy:" or "Forma úhrady:" which comes right before the items start
        # Then items follow immediately (e.g., "3.1003 Krabice dortová...")
        patterns['table_start'] = r'(?:Zp\.dopravy|Forma úhrady):[^\n]*\n'
        # Override line pattern to use the proven Dekos pattern (7 groups)
        # Format: code, description, unit_price, quantity, unit, vat_rate, line_total
        table_columns['line_pattern'] = r'^(\d+\.\d+(?:-\d+)?)\s+([A-Za-zá-žÁ-Ž/](?:[\wá-žÁ-Ž.,%()/+-]|\s(?!\d+,\d{4}))+?)\s+([\d\s,\.]+)\s+([\d\s,\.]+)\s+([A-Za-z0-9]{1,10})\s+(\d+)\s+([\d\s,\.]+)'
        # For table_end, use the "FAKTURA č." line that appears before the summary on page 2
        patterns['table_end'] = r'(?:FAKTURA|Faktura)\s+č\.'
        logger.info(f"   Using Dekos table_start: {patterns['table_start']}")
        logger.info(f"   Using Dekos table_end: {patterns.get('table_end')}")
        logger.info(f"   Using Dekos line_pattern (7 groups): {table_columns['line_pattern']}")
    elif display_layout.lower() in ['leco', 'le-co']:
        logger.info("🔧 Le-co display_layout detected - using proven Le-co patterns")
        # Le-co pattern: 9 groups (code, description, quantity, unit, unit_price, line_total, vat_rate, vat_amount, total_with_vat)
        table_columns['line_pattern'] = r'^(\d+)\s+([A-Za-zá-žÁ-Ž][A-Za-zá-žÁ-Ž0-9\s.,%()-]+?)\s+(\d[\d,\.]*)\s+([A-Za-z]{1,5})\s+([\d\s,\.]+)\s+([\d\s,\.]+)\s+(\d+)\s+([\d\s,\.]+)\s+([\d\s,\.]+)'
        logger.info(f"   Using Le-co line_pattern (9 groups): {table_columns['line_pattern']}")
    elif display_layout.lower() == 'makro':
        logger.info("🔧 Makro display_layout detected - using proven Makro patterns")
        # Makro pattern: 10 groups (code, quantity, description, base_price, units_in_mu, price_per_mu, total, vat_rate, vat_amount, total_with_vat)
        # Format handles two types:
        # - Format A: Regular items with package weight (e.g., "100g 12x")
        # - Format B: Items sold by weight (description starts with "*")
        # Pattern captures: code(6-7 digits), quantity/weight(decimal), description(any text), base_price, units_in_mu, price_per_mu, total, vat_rate, vat_amount, total_with_vat
        table_columns['line_pattern'] = r'^(\d{6,7})\s+([\d,\.]+)\s+([*]?[A-Za-zá-žÁ-Ž0-9\s.,%()/-]+?)\s+([\d\s,\.]+)\s+([\d\s,\.]+)\s+([\d\s,\.]+)\s+([\d\s,\.]+)\s+(\d+)\s+([\d\s,\.]+)\s+([\d\s,\.]+)'
        logger.info(f"   Using Makro line_pattern (10 groups): {table_columns['line_pattern']}")
    elif display_layout.lower() == 'pesek':
        logger.info("🔧 Pešek display_layout detected - using proven Pešek multi-line patterns")
        # Pešek pattern: 6 groups (multi-line format)
        # Format: Description on line 1, then on line 2: Code Quantity Unit Price VAT% Total
        # Example:
        #   Line 1: "Mouka pšeničná hladká speciál"
        #   Line 2: "0201 50kg 6,80 12 % 340,00"
        # Pattern captures: description, code, quantity, unit, unit_price, line_total
        table_columns['line_pattern'] = r'^([^\n]+?)\s*\n\s*(\d+)\s+([\d,]+)\s*([a-zA-Z]{1,5})\s+([\d,\s]+)\s+\d+\s*%?\s*\d*\s+([\d,\.\s]+)'
        logger.info(f"   Using Pešek multi-line pattern (6 groups): {table_columns['line_pattern']}")
    elif display_layout.lower() == 'goodmills':
        logger.info("🔧 Goodmills display_layout detected - using proven Goodmills multi-line patterns")
        # Goodmills pattern: 7 groups (multi-line format)
        # Format: Data on line 1, description on line 2
        # Line 1: Code VAT% Quantity Unit UnitPrice LineTotal
        # Line 2: Description
        # Example:
        #   Line 1: "512001 12% 7160.00 KG 8.9000 63724.00"
        #   Line 2: "Pš.m.hl.světlá T530 volná"
        # Pattern captures: code, vat_rate, quantity, unit, unit_price, line_total, description
        table_columns['line_pattern'] = r'^(\d{6})\s+(\d+)%\s+([\d\.]+)\s+([A-Z]{2,4})\s+([\d\.]+)\s+([\d\.]+)\s*\n\s*(.+?)(?:\n|$)'
        logger.info(f"   Using Goodmills multi-line pattern (7 groups): {table_columns['line_pattern']}")
    elif display_layout.lower() == 'albert':
        logger.info("🔧 Albert display_layout detected - using proven Albert patterns")
        # Albert pattern: 4 groups (retail format without product codes)
        # Format: Description Weight Price VAT_Letter
        # Example: "RYBÍZ ČERVENÝ 1250 39,90 A"
        # Pattern captures: description (uppercase Czech letters), weight (3-5 digits), unit_price, vat_letter (A/B/C/D)
        # VAT mapping: A=21%, B=15%, C=10%, D=0%
        # Weight corrections applied via description_corrections (e.g., "1250" → "125g")
        table_columns['line_pattern'] = r'^(?:[A-Z]\s+)?([A-ZĚŠČŘŽÝÁÍÉÚŮĎŤŇĹ\s]+?)\s+(\d{3,5})\s+([\d,]+)\s+([A-D])\s*$'
        logger.info(f"   Using Albert pattern (4 groups, no product codes): {table_columns['line_pattern']}")
    elif display_layout.lower() == 'zeelandia':
        logger.info("🔧 Zeelandia display_layout detected - using pure sequence patterns")
        # Zeelandia: Labels and values are SEPARATED (labels first, values after)
        # Extract by pure value patterns in sequence order
        
        # 1st: Invoice number - first standalone 9-digit number (after "Zeelandia" company name)
        patterns['invoice_number'] = r'Zeelandia[\s\S]+?(\d{9})'
        # 2nd: Total amount - first amount with space thousands separator (e.g., "33 751,78")
        patterns['total_amount'] = r'(\d{1,3}(?:\s\d{3})*,\d{2})\s*(?:CZK|Kč)'
        # 3rd: Date - first date in DD.MM.YYYY format (appears multiple times, take first)
        patterns['date'] = r'(\d{1,2}\.\d{1,2}\.\d{4})'
        # 4th: Payment type - word after all dates, not "DIČ" (look for Czech payment terms)
        patterns['payment_type'] = r'(?:\d{1,2}\.\d{1,2}\.\d{4})\s+([A-ZÁ-Žá-žů][a-zá-žů]+(?:\s+[a-zá-žů]+)?)'
        
        logger.info(f"   Using Zeelandia invoice_number (pure sequence): {patterns['invoice_number']}")
        logger.info(f"   Using Zeelandia total_amount (pure sequence): {patterns['total_amount']}")
        logger.info(f"   Using Zeelandia date (pure sequence): {patterns['date']}")
        logger.info(f"   Using Zeelandia payment_type (pure sequence): {patterns['payment_type']}")
        
        # Zeelandia pattern: 12 groups (single-line format with detailed packaging info)
        # Format: Code Description Quantity Unit Obsah Obsah_Unit Fakt.mn Fakt.mn_Unit UnitPrice TotalPrice Currency VAT%
        # Example: "10000891 ON Hruška gel 1kg 12 BAG 1,00 KG 12,00 KG 64,00 768,00 CZ 2%"
        # Example: "0000930 ON Jablko skořice gel 11kg 13 BKT 11,00 KG 143,00 KG 53,00 7 579,00 CZ 12%"
        # Example: "0001153 Bolognese 5kg 5 BKT 5,00 KG 25,00 KG 63,00 1575,00CZK 12%" (no space before CZK)
        # Pattern captures: code(7-8 digits), description, quantity, unit(BAG/BKT/PCE), obsah, obsah_unit, fakt_mn, fakt_mn_unit, unit_price, total_price, currency, vat_rate
        # Czech number format: use \d+(?:\s\d+)* to match numbers with space thousands separators (e.g., "7 579,00")
        table_columns['line_pattern'] = r'^(\d{7,8})\s+([A-Za-zá-žÁ-Ž0-9\s.,%()-]+?)\s+(\d+)\s+(BAG|BKT|PCE)\s+([\d,\.]+)\s+(KG|PCE|G)\s+([\d\s,\.]+)\s+(KG|PCE|G)\s+(\d+(?:\s\d+)*,\d+)\s+(\d+(?:\s\d+)*,\d+)\s*([A-Z]{2,3})\s+(\d+)%'
        logger.info(f"   Using Zeelandia line_pattern (12 groups with Czech number format): {table_columns['line_pattern']}")
        
        # Zeelandia-specific description corrections
        table_columns['description_corrections'] = {
            'replace_pattern': [
                {'pattern': r'^Rosette 1$', 'replacement': 'Rosette 1L'},
                {'pattern': r'^Rosette 1\s', 'replacement': 'Rosette 1L '},
            ]
        }
        logger.info("   Applied Zeelandia description corrections: Rosette 1 → Rosette 1L")
    
    # Find table start and end
    table_start_pattern = patterns.get('table_start')
    table_end_pattern = patterns.get('table_end')
    
    if not table_start_pattern:
        # Fallback: extract from entire text
        return extract_items_from_text(raw_text, table_columns)
    
    # Extract table section
    try:
        start_match = re.search(table_start_pattern, raw_text, re.IGNORECASE | re.MULTILINE)
        
        if start_match:
            start_pos = start_match.end()
            
            # For table_end, search for the LAST occurrence (not first) to handle multi-page tables
            # But ignore "continuation" markers that appear between pages
            if table_end_pattern:
                # Find all matches
                end_matches = list(re.finditer(table_end_pattern, raw_text, re.IGNORECASE | re.MULTILINE))
                
                # Filter out matches that are continuation messages
                # These should not stop extraction - they indicate more pages follow
                continuation_phrases = [
                    'pokračování',
                    'continuation',
                    'pokračuje',
                    'stránce',
                    'page',
                    'Tento doklad má',
                ]
                
                valid_end_matches = []
                for match in end_matches:
                    match_text = raw_text[match.start():match.end()].lower()
                    is_continuation = any(phrase.lower() in match_text for phrase in continuation_phrases)
                    if not is_continuation:
                        valid_end_matches.append(match)
                    else:
                        logger.debug(f"Skipping continuation marker as table_end: {match_text[:50]}")
                
                if valid_end_matches:
                    # Use the last valid match (for multi-page tables)
                    end_pos = valid_end_matches[-1].start()
                    logger.info(f"Found {len(end_matches)} table end markers ({len(valid_end_matches)} valid, {len(end_matches) - len(valid_end_matches)} continuation), using the last valid one")
                elif end_matches:
                    # All matches were continuations, use end of text
                    end_pos = len(raw_text)
                    logger.info(f"All {len(end_matches)} table end markers were continuation messages, using end of text")
                else:
                    end_pos = len(raw_text)
                    logger.info("No table end marker found, using end of text")
            else:
                end_pos = len(raw_text)
                logger.info("No table end pattern configured, using end of text")
            
            table_text = raw_text[start_pos:end_pos]
            
            logger.info(f"Extracted table section: {len(table_text)} characters from position {start_pos} to {end_pos}")
            logger.info(f"Table text preview (first 500 chars): {table_text[:500]}")
            logger.info(f"Table text preview (last 500 chars): {table_text[-500:]}")
            
            # Check if second page is included (look for "Stranač. 2" or "Strana 2" or page 2 markers)
            second_page_markers = [
                'Stranač. 2',
                'Strana 2',
                'page 2',
                'Dodavatel: backaldrin',
                '01395050',  # First item from second page
                '01250120',  # Second item from second page
            ]
            second_page_found = any(marker in table_text for marker in second_page_markers)
            logger.info(f"Second page detected in table_text: {second_page_found}")
            if second_page_found:
                # Find position of second page items
                for marker in second_page_markers:
                    pos = table_text.find(marker)
                    if pos >= 0:
                        logger.info(f"Found second page marker '{marker}' at position {pos} in table_text")
                        # Log context around marker
                        context_start = max(0, pos - 100)
                        context_end = min(len(table_text), pos + 200)
                        logger.info(f"Context around marker: {table_text[context_start:context_end]}")
                        break
            
            # Extract items from table text
            items = extract_items_from_text(table_text, table_columns)
        else:
            logger.warning(f"Table start pattern not found: {table_start_pattern}")
            
    except Exception as e:
        logger.error(f"Error extracting table section: {e}")
    
    return items

def extract_items_from_text(text: str, table_columns: Dict) -> List[InvoiceItem]:
    """
    Extract items from table text using line-by-line or multi-line parsing
    """
    items = []
    item_pattern = table_columns.get('line_pattern')
    
    # Get ignore patterns from config
    ignore_patterns = table_columns.get('ignore_patterns', [])
    if isinstance(ignore_patterns, str):
        # Support single pattern as string
        ignore_patterns = [ignore_patterns]
    
    # Check if it's a multi-line pattern (contains \n in pattern)
    if item_pattern and '\\n' in item_pattern:
        logger.info(f"Using multi-line pattern extraction")
        logger.info(f"Multi-line pattern: {item_pattern[:100]}...")
        
        # Use regex with MULTILINE and DOTALL flags for better multi-line matching
        try:
            matches = re.finditer(item_pattern, text, re.MULTILINE | re.DOTALL)
            
            for match_no, match in enumerate(matches, 1):
                matched_text = match.group(0) if match.groups() else ""
                groups = match.groups()
                
                # Check if matched text should be ignored
                should_ignore = False
                for ignore_pattern in ignore_patterns:
                    try:
                        if re.match(ignore_pattern, matched_text, re.IGNORECASE):
                            logger.debug(f"Skipping multi-line match (matches ignore pattern '{ignore_pattern}'): {matched_text[:50]}")
                            should_ignore = True
                            break
                    except Exception as e:
                        logger.warning(f"Invalid ignore pattern '{ignore_pattern}': {e}")
                
                if should_ignore:
                    continue
                
                # Handle different multi-line formats based on number of groups
                if len(groups) >= 5:
                    # Format 1: Multi-line format: description, code, quantity, unit, price, total
                    # Example: "sůl jemná 25kg" / "0201 50kg 6,80 12 % 340,00"
                    if len(groups) == 6:
                        quantity_raw = groups[2] if len(groups) > 2 else "0"
                        unit_raw = groups[3].strip() if len(groups) > 3 else None
                        
                        # Fix OCR issue: "101t" is actually "10 lt" (l looks like 1)
                        quantity = extract_number(quantity_raw)
                        unit = unit_raw
                        
                        if unit == 't' and quantity_raw and len(quantity_raw) > 1:
                            # Last digit of quantity is actually "l" in unit
                            # "101" → quantity: 10, unit: lt
                            try:
                                quantity_str = str(int(quantity))
                                if len(quantity_str) >= 2:
                                    quantity = float(quantity_str[:-1])  # Remove last digit
                                    unit = 'lt'  # Change t to lt
                                    logger.info(f"Fixed OCR: {quantity_raw}t → {quantity} lt")
                            except:
                                pass  # Keep original if conversion fails
                        
                        item = InvoiceItem(
                            description=groups[0].strip() if groups[0] else None,
                            product_code=groups[1].strip() if len(groups) > 1 else None,
                            quantity=quantity,
                            unit_of_measure=unit,
                            unit_price=extract_number(groups[4]) if len(groups) > 4 else 0,
                            line_total=extract_number(groups[5]) if len(groups) > 5 else 0,
                            line_number=match_no,
                        )
                        
                        if item.product_code:
                            items.append(item)
                            logger.debug(f"Extracted multi-line item (6 groups): {item.product_code} - {item.description}")
                    
                    # Format 2: Backaldrin multi-line: code+description on line 1, data on line 2
                    # Example: "02543250 Kobliha 20 %" / "25 kg 25 kg 166,000 4 150,00 | 12%"
                    elif len(groups) == 9:
                        # Backaldrin multi-line format - same as single-line Backaldrin
                        product_code = groups[0] if len(groups) > 0 else None
                        description = groups[1].strip() if len(groups) > 1 else None
                        quantity1 = extract_number(groups[2]) if len(groups) > 2 else 0
                        unit1 = groups[3] if len(groups) > 3 else None
                        quantity2 = extract_number(groups[4]) if len(groups) > 4 else 0
                        unit2 = groups[5] if len(groups) > 5 else None
                        unit_price = extract_number(groups[6]) if len(groups) > 6 else 0
                        line_total = extract_number(groups[7]) if len(groups) > 7 else 0
                        vat_percent = extract_number(groups[8]) if len(groups) > 8 else None
                        vat_rate = vat_percent
                        
                        # Use quantity2 and unit2 as primary quantity
                        quantity = quantity2 if quantity2 > 0 else quantity1
                        unit_of_measure = unit2 if unit2 else unit1
                        
                        item = InvoiceItem(
                            product_code=product_code,
                            description=description,
                            quantity=quantity,
                            unit_of_measure=unit_of_measure,
                            unit_price=unit_price,
                            line_total=line_total,
                            vat_rate=vat_rate or vat_percent,
                            line_number=match_no,
                        )
                        
                        if item.product_code:
                            items.append(item)
                            logger.debug(f"Extracted multi-line Backaldrin item (9 groups): {item.product_code} - {item.description}")
                    
                    # Format 3: Goodmills format - data on line 1, description on line 2
                    # Example: "512001 12% 7160.00 KG 8.9000 63724.00" / "Pš.m.hl.světlá T530 volná"
                    # Groups: code, vat_rate, quantity, unit, unit_price, line_total, description
                    elif len(groups) == 7:
                        product_code = groups[0].strip() if len(groups) > 0 else None
                        vat_rate = extract_number(groups[1]) if len(groups) > 1 else None
                        quantity = extract_number(groups[2]) if len(groups) > 2 else 0
                        unit_of_measure = groups[3].strip().lower() if len(groups) > 3 else None
                        unit_price = extract_number(groups[4]) if len(groups) > 4 else 0
                        line_total = extract_number(groups[5]) if len(groups) > 5 else 0
                        description = groups[6].strip() if len(groups) > 6 else None
                        
                        item = InvoiceItem(
                            product_code=product_code,
                            description=description,
                            quantity=quantity,
                            unit_of_measure=unit_of_measure,
                            unit_price=unit_price,
                            line_total=line_total,
                            vat_rate=vat_rate,
                            line_number=match_no,
                        )
                        
                        if item.product_code:
                            items.append(item)
                            logger.debug(f"Extracted multi-line Goodmills item (7 groups): {item.product_code} - {item.description}")
                    
                    else:
                        # Generic multi-line format - try to extract what we can
                        logger.info(f"Generic multi-line format with {len(groups)} groups, attempting extraction")
                        # Try to identify fields by position and content
                        product_code = None
                        description = None
                        quantity = 0
                        unit_of_measure = None
                        unit_price = 0
                        line_total = 0
                        
                        # First group is usually description or code+description
                        if groups[0]:
                            first_group = groups[0].strip()
                            # Check if it starts with a code (digits)
                            code_match = re.match(r'^(\d+)\s+(.+)', first_group)
                            if code_match:
                                product_code = code_match.group(1)
                                description = code_match.group(2).strip()
                            else:
                                description = first_group
                        
                        # Second group might be code (if first was description)
                        if not product_code and len(groups) > 1 and groups[1]:
                            code_match = re.match(r'^(\d+)', groups[1].strip())
                            if code_match:
                                product_code = code_match.group(1)
                        
                        # Try to extract quantity and other numeric fields
                        for i, group in enumerate(groups):
                            if i < 2:  # Skip first two (description/code)
                                continue
                            group_str = str(group).strip() if group else ""
                            # Try to extract numbers
                            numbers = re.findall(r'[\d,]+', group_str)
                            if numbers:
                                num_val = extract_number(numbers[0])
                                if quantity == 0:
                                    quantity = num_val
                                elif unit_price == 0:
                                    unit_price = num_val
                                elif line_total == 0:
                                    line_total = num_val
                            
                            # Try to extract unit
                            unit_match = re.search(r'([a-zA-Z]{1,5})\b', group_str)
                            if unit_match and not unit_of_measure:
                                unit_of_measure = unit_match.group(1)
                        
                        if product_code:
                            item = InvoiceItem(
                                product_code=product_code,
                                description=description,
                                quantity=quantity,
                                unit_of_measure=unit_of_measure,
                                unit_price=unit_price,
                                line_total=line_total,
                                line_number=match_no,
                            )
                            items.append(item)
                            logger.debug(f"Extracted generic multi-line item: {item.product_code} - {item.description}")
            
            logger.info(f"Extracted {len(items)} items using multi-line pattern")
            return items
            
        except Exception as e:
            logger.error(f"Error with multi-line pattern: {e}")
            # Fall back to line-by-line
    
    # Single-line processing (original method)
    lines = text.strip().split('\n')
    logger.info(f"Processing {len(lines)} lines for items")
    
    # Log if we see second page markers in the text
    text_lower = text.lower()
    second_page_in_text = any(marker in text_lower for marker in ['stranač. 2', 'strana 2', 'dodavatel: backaldrin', '01395050', '01250120'])
    logger.info(f"Second page markers found in text: {second_page_in_text}")
    if second_page_in_text:
        # Find lines containing second page markers
        for idx, line in enumerate(lines):
            if any(marker in line.lower() for marker in ['01395050', '01250120', 'vídeňské chlebové koření', 'bas tmavý']):
                logger.info(f"Found second page item at line {idx + 1}: {line[:100]}")
    
    # Get ignore patterns from config
    ignore_patterns = table_columns.get('ignore_patterns', [])
    if isinstance(ignore_patterns, str):
        # Support single pattern as string
        ignore_patterns = [ignore_patterns]
    
    items_before_extraction = len(items)
    skip_next_line = False  # Flag to skip second line of multi-line items
    for line_no, line in enumerate(lines, 1):
        line = line.strip()
        
        if not line or len(line) < 5:
            continue
        
        # Skip this line if it's the second line of a multi-line item
        if skip_next_line:
            logger.debug(f"Skipping line {line_no} (second line of multi-line item): {line[:50]}")
            skip_next_line = False
            continue
        
        # Check if line matches any ignore pattern
        should_ignore = False
        for ignore_pattern in ignore_patterns:
            try:
                # Use both match (start of line) and search (anywhere) for flexibility
                if re.match(ignore_pattern, line, re.IGNORECASE) or re.search(ignore_pattern, line, re.IGNORECASE):
                    logger.debug(f"Skipping line (matches ignore pattern '{ignore_pattern}'): {line[:50]}")
                    should_ignore = True
                    break
            except Exception as e:
                logger.warning(f"Invalid ignore pattern '{ignore_pattern}': {e}")
        
        if should_ignore:
            continue
        
        # Skip metadata/info lines that don't start with a product code
        # Examples: "BC GTIN...", "OVOCE A ZELENINA", section headers, etc.
        # Also skip "Šarže Počet Jednotka" header rows
        if re.match(r'^[A-Z]{2,}\s+(GTIN|Šarže)', line, re.IGNORECASE) or \
           re.match(r'^Šarže\s+Počet\s+Jednotka', line, re.IGNORECASE):
            logger.debug(f"Skipping metadata/header line: {line[:50]}")
            continue
        
        # Skip batch/date lines: 8-digit batch number followed by date (DD.MM.YYYY) and quantity
        # Example: "02498362 10.07.2026 25 kg" - these appear after product lines in backaldrin format
        if re.match(r'^\d{8}\s+\d{1,2}\.\d{1,2}\.\d{4}\s+\d+', line):
            logger.debug(f"Skipping batch/date line: {line[:50]}")
            continue
        
        # Skip production/expiration info lines (Goodmills format)
        # Example: "Vyrobeno: 21/10/2025, DMT: 22/07/2026"
        if re.match(r'^Vyrobeno:', line, re.IGNORECASE) or re.match(r'^DMT:', line, re.IGNORECASE):
            logger.debug(f"Skipping production info line: {line[:50]}")
            continue
        
        # Skip section headers (lines with only uppercase letters and spaces, but SHORT - likely headers)
        # But allow longer lines (likely product descriptions)
        if re.match(r'^[A-ZĚŠČŘŽÝÁÍÉÚŮĎŤŇĹ\s]+$', line) and len(line) < 30:
            logger.debug(f"Skipping header line: {line}")
            continue
        
        # Check if pattern requires product code at start (starts with ^\d)
        # If pattern starts with optional code or no code requirement, skip this validation
        requires_product_code = item_pattern and item_pattern.startswith('^(\\d')
        
        if requires_product_code:
            # Skip lines that don't start with a digit (product codes should be numeric)
            # Only enforce this for suppliers that use product codes
            if not re.match(r'^\d', line):
                logger.debug(f"Skipping non-product line (no code): {line[:50]}")
                continue
            
            # Check if line starts with a product code (digits with optional dot and dash)
            # This helps ensure we process lines even after description continuation lines
            # Examples: "8.5340-1", "7.6550-2", "35.2010-1", "35.0400"
            code_match = re.match(r'^(\d+\.?\d*-?\d*)', line)
            if not code_match:
                logger.debug(f"Skipping line without valid product code format: {line[:50]}")
                continue
        
        # Log lines from second page for debugging
        if '01395050' in line or '01250120' in line or 'Vídeňské chlebové koření' in line or 'BAS tmavý' in line:
            logger.info(f"⚠️ Processing line from second page (line {line_no}): {line[:100]}")
        
        # Log lines with codes containing dash for debugging (e.g., "8.5340-1", "7.6550-2")
        if re.match(r'^\d+\.\d+-\d+', line):
            logger.info(f"🔍 Processing line with dash code (line {line_no}): {line[:100]}")
        
        # Check for multi-line Albert items (description + weight on line 1, quantity × price on line 2)
        # Example:
        #   Line 1: "JAHODY 2500 1"
        #   Line 2: "2 x 69,90 Kč 139,80 A"
        combined_line = line
        multiline_item_detected = False
        if line_no < len(lines):  # Not the last line
            # Check if current line matches partial pattern: description + weight + incomplete
            partial_pattern = r'^(?:[A-Z]\s+)?([A-ZĚŠČŘŽÝÁÍÉÚŮĎŤŇĹ\s]+?)\s+(\d{3,5})\s+\d+\s*$'
            partial_match = re.match(partial_pattern, line)
            
            if partial_match:
                # Check next line for "quantity x price Kč total VAT" pattern
                next_line_idx = lines.index(line) + 1 if line in lines else -1
                if next_line_idx > 0 and next_line_idx < len(lines):
                    next_line = lines[next_line_idx].strip()
                    # Pattern: "2 x 69,90 Kč 139,80 A"
                    multiline_pattern = r'^(\d+)\s+x\s+([\d,]+)\s+Kč\s+([\d,]+)\s+([A-Z])\s*$'
                    multiline_match = re.match(multiline_pattern, next_line)
                    
                    if multiline_match:
                        # Combine into single line format: description weight quantity×price total VAT
                        # But reformat to match single-line pattern: description weight unit_price VAT
                        description = partial_match.group(1).strip()
                        weight = partial_match.group(2).strip()
                        quantity = multiline_match.group(1).strip()
                        unit_price = multiline_match.group(2).strip()
                        line_total = multiline_match.group(3).strip()
                        vat_letter = multiline_match.group(4).strip()
                        
                        # For multi-item lines, we'll extract the actual unit price
                        # If quantity > 1, calculate: actual_unit_price = line_total / quantity
                        try:
                            qty_num = int(quantity)
                            total_num = extract_number(line_total)
                            if qty_num > 1 and total_num > 0:
                                actual_unit_price = total_num / qty_num
                                unit_price_str = f"{actual_unit_price:.2f}".replace('.', ',')
                            else:
                                unit_price_str = unit_price
                        except:
                            unit_price_str = unit_price
                        
                        # Reconstruct as single-line format for existing parser
                        combined_line = f"{description} {weight} {unit_price_str} {vat_letter}"
                        multiline_item_detected = True
                        skip_next_line = True  # Mark next line for skipping
                        logger.info(f"🔗 Multi-line Albert item detected (lines {line_no}-{line_no+1}):")
                        logger.info(f"   Line 1: {line}")
                        logger.info(f"   Line 2: {next_line}")
                        logger.info(f"   Combined: {combined_line}")
                        logger.info(f"   Quantity: {quantity}, Unit Price: {unit_price_str}, Total: {line_total}")
        
        # Try to extract item from line (or combined line for multi-line items)
        item = extract_item_from_line(combined_line, table_columns, line_no)
        
        # For multi-line items, update quantity and line_total
        if multiline_item_detected and item:
            try:
                # Parse the original quantity and line total from the second line
                next_line = lines[lines.index(line) + 1].strip()
                multiline_match = re.match(r'^(\d+)\s+x\s+([\d,]+)\s+Kč\s+([\d,]+)\s+([A-Z])\s*$', next_line)
                if multiline_match:
                    item.quantity = int(multiline_match.group(1))
                    item.line_total = extract_number(multiline_match.group(3))
                    logger.info(f"   → Updated item: quantity={item.quantity}, line_total={item.line_total}")
            except Exception as e:
                logger.warning(f"Failed to update multi-line item quantity/total: {e}")
        
        # Accept items with product_code OR description (for retail formats like Albert)
        if item and (item.product_code or item.description):
            items.append(item)
            if multiline_item_detected:
                logger.info(f"✅ Added multi-line item: {item.description}, qty={item.quantity}, price={item.unit_price}, total={item.line_total}")
            else:
                logger.debug(f"Extracted item: {item.product_code or 'no-code'} - {item.description}")
        elif re.match(r'^\d+\.\d+-\d+', line):
            # Log if lines with dash codes don't match pattern
            logger.warning(f"❌ Line with dash code did not match pattern (line {line_no}): {line[:100]}")
            logger.warning(f"   Pattern used: {table_columns.get('line_pattern', 'None')}")
        elif '01395050' in line or '01250120' in line:
            # Log if second page items don't match
            logger.warning(f"❌ Line from second page did not match pattern (line {line_no}): {line[:100]}")
            logger.warning(f"   Pattern used: {table_columns.get('line_pattern', 'None')}")
        elif line_no % 50 == 0:  # Log every 50th line to see progress
            logger.debug(f"Line {line_no} did not match pattern: {line[:80]}")
    
    logger.info(f"Extracted {len(items)} valid items (started with {items_before_extraction}, processed {len(lines)} lines)")
    
    # Log all extracted items for debugging
    for idx, item in enumerate(items, 1):
        logger.info(f"Item {idx}: desc={item.description}, code={item.product_code}, qty={item.quantity}, price={item.unit_price}, total={item.line_total}, weight={item.item_weight}")
    
    # Check if second page items are missing
    extracted_codes = {item.product_code for item in items}
    second_page_codes = {'01395050', '01250120'}
    missing_second_page = second_page_codes - extracted_codes
    if missing_second_page:
        logger.warning(f"Missing second page items with codes: {missing_second_page}")
    
    return items

def apply_code_corrections(product_code: str, corrections: Dict) -> str:
    """
    Apply code corrections based on configured rules
    
    Supports:
    - prepend_if_starts_with: {"0000": "1"} -> prepends "1" to codes starting with "0000"
    - replace_pattern: [{"pattern": "^0+", "replacement": "1"}] -> regex replacements
    """
    if not product_code or not corrections:
        return product_code
    
    # Rule 1: Prepend if starts with specific pattern
    prepend_rules = corrections.get('prepend_if_starts_with', {})
    for starts_with, prepend_text in prepend_rules.items():
        if product_code.startswith(starts_with):
            corrected = prepend_text + product_code
            logger.info(f"Code correction: {product_code} -> {corrected} (prepended '{prepend_text}')")
            return corrected
    
    # Rule 2: Regex pattern replacements
    replace_rules = corrections.get('replace_pattern', [])
    for rule in replace_rules:
        pattern = rule.get('pattern')
        replacement = rule.get('replacement', '')
        if pattern:
            corrected = re.sub(pattern, replacement, product_code)
            if corrected != product_code:
                logger.info(f"Code correction: {product_code} -> {corrected} (pattern: {pattern})")
                return corrected
    
    return product_code

def apply_description_corrections(description: str, corrections: Dict) -> str:
    """
    Apply description corrections based on configured rules
    
    Supports:
    - replace_pattern: [{"pattern": "Tikg", "replacement": "11kg"}] -> regex replacements
    """
    if not description or not corrections:
        return description
    
    # Apply regex pattern replacements
    replace_rules = corrections.get('replace_pattern', [])
    for rule in replace_rules:
        pattern = rule.get('pattern')
        replacement = rule.get('replacement', '')
        if pattern:
            corrected = re.sub(pattern, replacement, description)
            if corrected != description:
                logger.info(f"Description correction: {description} -> {corrected} (pattern: {pattern})")
                return corrected
    
    return description

def extract_item_from_line(line: str, table_columns: Dict, line_number: int) -> Optional[InvoiceItem]:
    """
    Extract single item from a line of text
    Uses configurable patterns or whitespace splitting
    """
    
    # Get code correction rules if configured
    code_corrections = table_columns.get('code_corrections', {})
    
    # Method 1: Use regex patterns if configured
    item_pattern = table_columns.get('line_pattern')
    if item_pattern:
        # Automatically extend pattern to support codes with optional dash (e.g., "8.5340-1")
        # Convert ^(\d+\.\d+) to ^(\d+\.\d+(?:-\d+)?) to support both "35.0400" and "8.5340-1"
        original_pattern = item_pattern
        pattern_was_extended = False
        if '^(\\d+\\.\\d+)' in item_pattern and '(?:-\\d+)?' not in item_pattern:
            item_pattern = item_pattern.replace('^(\\d+\\.\\d+)', '^(\\d+\\.\\d+(?:-\\d+)?)')
            pattern_was_extended = True
            logger.info(f"🔧 Extended pattern to support dash codes")
            logger.info(f"   Original: {original_pattern}")
            logger.info(f"   Extended: {item_pattern}")
        
        # Automatically extend pattern to support + in descriptions (e.g., "20+8x33cm")
        # Add + to description character classes if missing
        description_pattern_extended = False
        if '[A-Za-zá-žÁ-Ž0-9\\s.,%()-]' in item_pattern and '+' not in item_pattern:
            item_pattern = item_pattern.replace('[A-Za-zá-žÁ-Ž0-9\\s.,%()-]', '[A-Za-zá-žÁ-Ž0-9\\s.,%()+-]')
            description_pattern_extended = True
            pattern_was_extended = True
        
        # Automatically improve description pattern to capture capacity indicators like "5L", "10kg"
        # Convert simple non-greedy pattern to one with negative lookahead
        # Old: [\wá-žÁ-Ž\s.,%()/+-]+?
        # New: (?:[\wá-žÁ-Ž.,%()/+-]|\s(?!\d{2,}[\s,]))+?
        # This stops before "space + 2+ digits with comma" (unit price pattern like "108,1300")
        capacity_pattern_improved = False
        if '[\\wá-žÁ-Ž\\s.,%()/+-]+?' in item_pattern and '(?!\\d{2,}[\\s,])' not in item_pattern:
            item_pattern = item_pattern.replace('[\\wá-žÁ-Ž\\s.,%()/+-]+?', '(?:[\\wá-žÁ-Ž.,%()/+-]|\\s(?!\\d{2,}[\\s,]))+?')
            capacity_pattern_improved = True
            pattern_was_extended = True
        
        # Log the extensions
        if description_pattern_extended:
            logger.info(f"🔧 Extended pattern to support + in descriptions")
        if capacity_pattern_improved:
            logger.info(f"🔧 Improved description pattern to capture capacity indicators (5L, 10kg, etc.)")
        if pattern_was_extended:
            logger.info(f"   Final pattern: {item_pattern}")
        
        logger.info(f"Using line_pattern: {item_pattern}")
        logger.info(f"Testing against line: {line[:100]}")
        try:
            # Validate pattern before using it
            try:
                re.compile(item_pattern)
            except re.error as pattern_error:
                logger.error(f"Invalid regex pattern: {pattern_error}")
                logger.error(f"Pattern: {item_pattern}")
                return None
            
            match = re.match(item_pattern, line)
            
            if match:
                logger.info(f"✅ Pattern matched! Groups: {len(match.groups())}")
                if pattern_was_extended:
                    logger.info(f"   (Match succeeded with extended pattern)")
            else:
                logger.warning(f"❌ Pattern did NOT match")
                if pattern_was_extended:
                    logger.warning(f"   (Even extended pattern failed to match)")
            
            # Only use Dekos fallback pattern if main pattern doesn't match
            # This respects each supplier's configured pattern first
            # Check if line starts with Dekos code pattern (digits.digits with optional dash)
            if not match:
                is_dekos_code = re.match(r'^\d+\.\d+(?:-\d+)?', line)
                if is_dekos_code:
                # Dekos format: code (with optional dash), description, unit_price, quantity, unit, vat_rate, line_total
                # Example: "8.5340-1 Utěrka Z-Z / 200 útržků, šedá 15,9700 20,000 bal 21 319,40"
                # Example: "35.0400 Jar PŘIMONA 5I zelený 79,0000 8,000 1ks 21 632,00"
                # Example: "35.0265 STOP BAKTER 5L 108,1300 1,000 1ks 21 108,13" (OCR may read "5L" as "51")
                # Example: "1.2021 Sáček papírový 20+8x33cm hnědý 580,0000 1,000 tis 21 580,00"
                # Note: Description can contain +, -, /, numbers like "5L", "10kg" (e.g., "20+8x33cm", "12-200z", "5L")
                # Unit price pattern: large number with thousands separator (space or nothing) and comma decimal
                    # Stop before: space + digit + comma + 4 digits (unit_price pattern like "5,3000", "108,1300")
                    # Description can contain numbers and "x" (e.g., "28x28x10cm", "20+8x33cm")
                    # Use negative lookahead to stop before unit_price: space + digit + comma + 4 digits
                    dekos_pattern = r'^(\d+\.\d+(?:-\d+)?)\s+([A-Za-zá-žÁ-Ž/](?:[\wá-žÁ-Ž.,%()/+-]|\s(?!\d+,\d{4}))+?)\s+([\d\s,\.]+)\s+([\d\s,\.]+)\s+([A-Za-z0-9]{1,10})\s+(\d+)\s+([\d\s,\.]+)'
                    dekos_match = re.match(dekos_pattern, line)
                    if dekos_match and len(dekos_match.groups()) == 7:
                        # Use Dekos pattern as fallback only if main pattern didn't match
                        match = dekos_match
                        logger.info(f"✅ Dekos fallback pattern matched (7 groups) for line: {line[:80]}")
                        logger.info(f"   Using Dekos fallback pattern (main pattern didn't match)")
            
            # If primary pattern doesn't match, try alternative Backaldrin patterns for edge cases
            if not match and r'\d{8}' in item_pattern:
                # This looks like a Backaldrin pattern - try alternative formats
                # Format 1: "5 kg 5kg" (space optional between qty and unit)
                # Format 2: "12 kg 0004260834 12 kg" (batch number between)
                alternative_pattern = r'^(\d{8})\s+([A-Za-zá-žÁ-Ž]+(?:\s+[A-Za-zá-žÁ-Ž]+)*(?:\s+\d+\s*%)?)\s+([\d,]+)\s*([a-zA-Z]{1,5})\s+(?:\d{8,}\s+)?([\d,]+)\s*([a-zA-Z]{1,5})\s+([\d,\s]+)\s+([\d\s,]+)\s*\|\s*(\d+)%'
                match = re.match(alternative_pattern, line)
                if match:
                    logger.info(f"✅ Alternative Backaldrin pattern matched (flexible spacing + optional batch): {line[:80]}")
            
            # If primary pattern doesn't match, try Le-co fallback pattern (9 groups format)
            # Le-co format: code, description, quantity, unit, unit_price, line_total, vat_rate, vat_amount, total_with_vat
            # Example: "486510 BORŮVKY KANADSKÉ VAN. 125g 1,000 BAG 53,70 53,70 12 6,44 60,14"
            if not match:
                # Check if line starts with product code (digits) and might be Le-co format
                # Le-co pattern: KÓD POPIS MNOŽSTVÍ JEDNOTKA CENA/J CELKEM DPH% DPH_ČÁSTKA CELKEM_S_DPH
                leco_pattern = r'^(\d+)\s+([A-Za-zá-žÁ-Ž][A-Za-zá-žÁ-Ž0-9\s.,%()-]+?)\s+(\d[\d,\.]*)\s+([A-Za-z]{1,5})\s+([\d\s,\.]+)\s+([\d\s,\.]+)\s+(\d+)\s+([\d\s,\.]+)\s+([\d\s,\.]+)'
                leco_match = re.match(leco_pattern, line)
                if leco_match and len(leco_match.groups()) == 9:
                    # Use Le-co pattern as fallback only if main pattern didn't match
                    match = leco_match
                    logger.info(f"✅ Le-co fallback pattern matched (9 groups) for line: {line[:80]}")
                    logger.info(f"   Using Le-co fallback pattern (main pattern didn't match)")
            
            if match:
                try:
                    groups = match.groups()
                    logger.info(f"✅ Pattern matched with {len(groups)} groups for line: {line[:80]}")
                    logger.info(f"Groups (all {len(groups)}): {groups}")
                    logger.info(f"Group breakdown: code={groups[0] if len(groups) > 0 else None}, description={groups[1] if len(groups) > 1 else None}, ...")
                except Exception as e:
                    logger.error(f"Error getting groups from match: {e}")
                    logger.error(f"Pattern: {item_pattern}")
                    logger.error(f"Line: {line[:100]}")
                    return None
                
                # Handle different pattern formats:
                # Format 1 (6 groups): code, description, quantity, unit, price, total
                # Format 2 (10 groups): code, quantity, description, base_price, units_in_mu, price_per_mu, total, vat_rate, vat_amount, total_with_vat
                
                if len(groups) >= 12:
                    # Zeelandia format: 12 captures
                    # code, description, quantity, unit(BAG/BKT/PCE), obsah, obsah_unit, fakt_mn, fakt_mn_unit, unit_price, total_price, currency, vat_rate
                    
                    # Map Zeelandia format: 10000891 ON Hruška gel 1kg 12 BAG 1,00 KG 12,00 KG 64,00 768,00 CZ 2%
                    product_code = groups[0] if len(groups) > 0 else None
                    description = groups[1].strip() if len(groups) > 1 else None
                    quantity = extract_number(groups[2]) if len(groups) > 2 else 0
                    unit_of_measure = groups[3] if len(groups) > 3 else None  # BAG/BKT/PCE
                    package_weight = extract_number(groups[4]) if len(groups) > 4 else None  # Obsah
                    package_weight_unit = groups[5] if len(groups) > 5 else None  # KG/PCE
                    total_weight = extract_number(groups[6]) if len(groups) > 6 else None  # Fakt.mn
                    total_weight_unit = groups[7] if len(groups) > 7 else None  # KG/PCE
                    unit_price = extract_number(groups[8]) if len(groups) > 8 else 0
                    line_total = extract_number(groups[9]) if len(groups) > 9 else 0
                    currency = groups[10] if len(groups) > 10 else None
                    vat_rate = extract_number(groups[11]) if len(groups) > 11 else None
                    
                    # Zeelandia OCR Error Fix: If total_weight is 0 or missing, calculate from quantity × package_weight
                    # This handles OCR errors where "10,00" is misread as "0,00" or "1" is missing
                    if (total_weight == 0 or total_weight is None) and quantity and package_weight:
                        calculated_total_weight = quantity * package_weight
                        logger.info(f"⚠️ OCR Error Correction: total_weight was {total_weight}, calculating from quantity × package_weight: {quantity} × {package_weight} = {calculated_total_weight}")
                        total_weight = calculated_total_weight
                    
                    # Calculate line_total from total_weight * unit_price for more accuracy
                    # This avoids OCR errors in the total price field
                    calculated_line_total = total_weight * unit_price if total_weight and unit_price else line_total
                    
                    logger.info(f"Extracting Zeelandia format - quantity: {quantity}, unit: {unit_of_measure}, package_weight: {package_weight}, total_weight: {total_weight}, unit_price: {unit_price}, calculated_total: {calculated_line_total}")
                    
                    # Apply code corrections if configured
                    corrected_code = apply_code_corrections(product_code, code_corrections) if product_code else None
                    
                    # Apply description corrections if configured
                    description_corrections = table_columns.get('description_corrections', {})
                    corrected_description = apply_description_corrections(description, description_corrections) if description else None
                    
                    return InvoiceItem(
                        product_code=corrected_code,
                        description=corrected_description,
                        quantity=quantity,
                        unit_of_measure=unit_of_measure,
                        unit_price=unit_price,
                        line_total=calculated_line_total,
                        package_weight_kg=package_weight if package_weight_unit == 'KG' else None,
                        total_weight_kg=total_weight if total_weight_unit == 'KG' else None,
                        package_weight=package_weight,
                        package_weight_unit=package_weight_unit,
                        total_weight=total_weight,
                        total_weight_unit=total_weight_unit,
                        vat_rate=vat_rate,
                        line_number=line_number,
                    )
                elif len(groups) >= 9:
                    # Check if it's backaldrin format (starts with 8-digit code)
                    # Backaldrin format: CODE DESCRIPTION (with optional "20 %") QTY1 UNIT1 QTY2 UNIT2 UNIT_PRICE TOTAL | VAT%
                    # Check if first group is 8-digit code
                    first_group = groups[0] if len(groups) > 0 else ""
                    is_backaldrin = first_group and len(str(first_group)) == 8 and str(first_group).isdigit()
                    
                    # Alternative Backaldrin format with 6 groups: "02874010 Sahnissimo neutrál kg 8kg | 12%"
                    if len(groups) == 6 and is_backaldrin:
                        # Alternative Backaldrin format - 6 groups: code, description, unit1, qty2 (from combined "8kg"), unit2 (from combined), vat_percent
                        logger.info(f"Detected Alternative Backaldrin format with 6 groups - line: {line[:80]}")
                        logger.info(f"All groups: {groups}")
                        product_code = groups[0] if len(groups) > 0 else None
                        description = groups[1].strip() if len(groups) > 1 else None
                        unit1 = groups[2] if len(groups) > 2 else None  # Standalone unit (e.g., "kg")
                        qty2_combined = groups[3] if len(groups) > 3 else None  # Combined quantity+unit (e.g., "8")
                        unit2_combined = groups[4] if len(groups) > 4 else None  # Combined unit from "8kg" (e.g., "kg")
                        vat_percent = extract_number(groups[5]) if len(groups) > 5 else None
                        vat_rate = vat_percent
                        
                        # Extract quantity from qty2_combined (should be just the number)
                        quantity = extract_number(qty2_combined) if qty2_combined else 0
                        # Use unit2_combined as the unit (from combined "8kg")
                        unit_of_measure = unit2_combined.lower() if unit2_combined else (unit1.lower() if unit1 else None)
                        
                        # Remove trailing unit from description if present (e.g., "Sahnissimo neutrál kg" → "Sahnissimo neutrál")
                        if description and unit1:
                            # Check if description ends with the unit1
                            unit_pattern = re.compile(r'\s+' + re.escape(unit1) + r'$', re.IGNORECASE)
                            if unit_pattern.search(description):
                                description = unit_pattern.sub('', description).strip()
                                logger.info(f"Removed trailing unit '{unit1}' from description, new description: '{description}'")
                        
                        logger.info(f"Extracting Alternative Backaldrin format - code: {product_code}, description: {description}, quantity: {quantity} {unit_of_measure}, vat_rate: {vat_rate}")
                        
                        # Apply code corrections if configured
                        corrected_code = apply_code_corrections(product_code, code_corrections) if product_code else None
                        
                        # Apply description corrections if configured
                        description_corrections = table_columns.get('description_corrections', {})
                        corrected_description = apply_description_corrections(description, description_corrections) if description else None
                        
                        return InvoiceItem(
                            product_code=corrected_code,
                            description=corrected_description,
                            quantity=quantity,
                            unit_of_measure=unit_of_measure,
                            unit_price=0,  # Not available in this format
                            line_total=0,  # Not available in this format
                            vat_rate=vat_rate or vat_percent,
                            line_number=line_number,
                        )
                    
                    if len(groups) == 9 and is_backaldrin:
                        # Backaldrin format - 9 groups: code, description (with optional "20 %"), qty1, unit1, qty2, unit2, unit_price, total, vat_percent
                        # Note: "20 %" in description like "Kobliha 20 %" is part of product name, not separate VAT field
                        logger.info(f"Detected Backaldrin format with 9 groups - line: {line[:80]}")
                        logger.info(f"All groups: {groups}")
                        product_code = groups[0] if len(groups) > 0 else None
                        description = groups[1].strip() if len(groups) > 1 else None  # Includes "20 %" if present
                        logger.info(f"Extracted - code: {product_code}, description: {description}, group[1] raw: '{groups[1] if len(groups) > 1 else None}'")
                        quantity1 = extract_number(groups[2]) if len(groups) > 2 else 0
                        unit1 = groups[3] if len(groups) > 3 else None
                        quantity2 = extract_number(groups[4]) if len(groups) > 4 else 0
                        unit2 = groups[5] if len(groups) > 5 else None
                        unit_price = extract_number(groups[6]) if len(groups) > 6 else 0
                        line_total_ocr = extract_number(groups[7]) if len(groups) > 7 else 0  # OCR extracted value (may have errors with spaces)
                        vat_percent = extract_number(groups[8]) if len(groups) > 8 else None
                        vat_rate = vat_percent  # Use vat_percent from end as the actual VAT rate
                        
                        # Use quantity2 and unit2 as primary quantity (appears to be the actual quantity)
                        quantity = quantity2 if quantity2 > 0 else quantity1
                        unit_of_measure = unit2 if unit2 else unit1
                        
                        # Special handling for format like "02874010 Sahnissimo neutrál kg 8kg | 12%"
                        # In this case, UNIT1 might be captured in description, and QTY2+UNIT2 are combined
                        # Check if description ends with a unit word (kg, ks, etc.)
                        if description:
                            # Remove trailing unit from description if it was mistakenly captured
                            # Common units: kg, ks, lt, ml, g, l, kr
                            unit_pattern = r'\s+(kg|ks|lt|ml|g|l|kr|pcs|pc)$'
                            unit_match = re.search(unit_pattern, description, re.IGNORECASE)
                            if unit_match and not unit_of_measure:
                                # Description ends with unit, remove it and use as unit_of_measure
                                unit_of_measure = unit_match.group(1).lower()
                                description = re.sub(unit_pattern, '', description, flags=re.IGNORECASE).strip()
                                logger.info(f"Removed trailing unit '{unit_of_measure}' from description, new description: '{description}'")
                        
                        # If quantity is still 0 but we have unit2, check if unit2 contains quantity (e.g., "8kg")
                        if quantity == 0 and unit2:
                            # Try to extract quantity from unit2 if it contains digits
                            qty_unit_match = re.match(r'^(\d+)(kg|ks|lt|ml|g|l|kr|pcs|pc)$', unit2, re.IGNORECASE)
                            if qty_unit_match:
                                quantity = extract_number(qty_unit_match.group(1))
                                unit_of_measure = qty_unit_match.group(2).lower()
                                logger.info(f"Extracted quantity {quantity} and unit '{unit_of_measure}' from combined '{unit2}'")
                        
                        # Calculate line_total from quantity * unit_price for accuracy
                        # OCR often has errors with spaces in Czech number format (e.g., "4 150,00" vs "4150,00")
                        line_total = quantity * unit_price if quantity and unit_price else line_total_ocr
                        if line_total != line_total_ocr and line_total_ocr > 0:
                            logger.info(f"Calculated line_total: {line_total} (OCR was: {line_total_ocr}, using calculation instead)")
                        
                        logger.info(f"Extracting Backaldrin format - code: {product_code}, description: {description}, quantity: {quantity} {unit_of_measure}, unit_price: {unit_price}, total: {line_total}")
                        
                        # Apply code corrections if configured
                        corrected_code = apply_code_corrections(product_code, code_corrections) if product_code else None
                        
                        # Apply description corrections if configured
                        description_corrections = table_columns.get('description_corrections', {})
                        corrected_description = apply_description_corrections(description, description_corrections) if description else None
                        
                        return InvoiceItem(
                            product_code=corrected_code,
                            description=corrected_description,
                            quantity=quantity,
                            unit_of_measure=unit_of_measure,
                            unit_price=unit_price,
                            line_total=line_total,
                            vat_rate=vat_rate or vat_percent,
                            line_number=line_number,
                        )
                    
                    # Albert format (4 groups): description, weight, price, vat_letter
                    # Example: "RYBÍZ ČERVENÝ 1250 39,90 A"
                    # No product code - retail format
                    if len(groups) == 4:
                        description = groups[0].strip() if groups[0] else None
                        weight_raw = groups[1].strip() if len(groups) > 1 else None
                        unit_price = extract_number(groups[2]) if len(groups) > 2 else 0
                        vat_letter = groups[3].strip() if len(groups) > 3 else None
                        
                        # Convert VAT letter to percentage: A=21%, B=15%, C=10%, D=0%
                        vat_mapping = {'A': 21, 'B': 15, 'C': 10, 'D': 0}
                        vat_rate = vat_mapping.get(vat_letter, 21) if vat_letter else None
                        
                        # Calculate line_total: quantity=1 (one package), price = unit_price
                        quantity = 1
                        line_total = unit_price
                        
                        # Apply description corrections to weight (e.g., "1250" → "125g")
                        description_corrections = table_columns.get('description_corrections', {})
                        corrected_weight = apply_description_corrections(weight_raw, description_corrections) if weight_raw else None
                        
                        logger.info(f"Extracting Albert format (4 groups) - description: {description}, weight: {weight_raw} → {corrected_weight}, unit_price: {unit_price}, vat_letter: {vat_letter} ({vat_rate}%)")
                        
                        # Apply description corrections to name as well
                        corrected_description = apply_description_corrections(description, description_corrections) if description else None
                        
                        return InvoiceItem(
                            product_code=None,  # No product codes for Albert
                            description=corrected_description,
                            quantity=quantity,
                            unit_of_measure="ks",  # Pieces/packages
                            unit_price=unit_price,
                            line_total=line_total,
                            vat_rate=vat_rate,
                            line_number=line_number,
                            item_weight=corrected_weight,  # Store corrected weight (e.g., "125g")
                        )
                    
                    # Generic interactive labeling format (5-9 groups): use position-based mapping with validation
                    # Frontend generates patterns with fields in left-to-right order
                    # Common formats:
                    #   5-7 groups: code, description, quantity, unit, unit_price, line_total, vat_rate
                    #   7 groups (Dekos): code, description, unit_price, quantity, unit, vat_rate, line_total
                    #   9 groups (Leco): code, description, quantity, unit, unit_price, line_total, vat_rate, vat_amount, total_with_vat
                    if len(groups) >= 5 and len(groups) <= 9:
                        product_code = None
                        description = None
                        quantity = 0
                        unit_of_measure = None
                        unit_price = 0
                        line_total = 0
                        vat_rate = None
                        vat_amount = None
                        total_with_vat = None
                        
                        # Detect Dekos format: code contains dot (e.g., "35.0400") and has 7 groups
                        # Dekos order: code, description, unit_price, quantity, unit, vat_rate, line_total
                        is_dekos_format = len(groups) == 7 and groups[0] and '.' in str(groups[0])
                        
                        # Standard field order from frontend (based on left-to-right position)
                        # But we'll be flexible - map based on position first, then validate
                        if is_dekos_format:
                            # Dekos format: code, description, unit_price, quantity, unit, vat_rate, line_total
                            field_order = ['code', 'description', 'unit_price', 'quantity', 'unit', 'vat_rate', 'line_total']
                            logger.debug(f"Detected Dekos format (7 groups with code containing dot): {groups[0]}")
                        elif len(groups) == 9:
                            # Leco format: code, description, quantity, unit, unit_price, line_total, vat_rate, vat_amount, total_with_vat
                            field_order = ['code', 'description', 'quantity', 'unit', 'unit_price', 'line_total', 'vat_rate', 'vat_amount', 'total_with_vat']
                        else:
                            # Standard format: code, description, quantity, unit, unit_price, line_total, vat_rate
                            field_order = ['code', 'description', 'quantity', 'unit', 'unit_price', 'line_total', 'vat_rate', 'vat_amount', 'total_with_vat']
                        
                        # First pass: map fields based on position with validation
                        logger.debug(f"Mapping {len(groups)} groups for Dekos format: {groups}")
                        for idx, group_str in enumerate(groups):
                            if not group_str or idx >= len(field_order):
                                continue
                            group_str = str(group_str).strip()
                            field_type = field_order[idx]
                            logger.debug(f"Group {idx+1}: '{group_str}' -> field_type: {field_type}")
                            
                            if field_type == 'code':
                                # Product code: all digits, 3-7 digits, or digits with dot (Dekos format: "35.0400")
                                # Also support codes with dash (e.g., "8.5340-1", "7.6550-2", "35.2010-1")
                                if group_str.isdigit() and len(group_str) >= 3 and len(group_str) <= 7:
                                    product_code = group_str
                                    logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> code: {product_code}")
                                elif '.' in group_str and (re.match(r'^\d+\.\d+$', group_str) or re.match(r'^\d+\.\d+-\d+$', group_str)):
                                    # Dekos format: code with dot (e.g., "35.0400") or with dot and dash (e.g., "8.5340-1")
                                    product_code = group_str
                                    logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> code (Dekos format): {product_code}")
                                elif group_str.isdigit():
                                    # Fallback: accept any digit-only code
                                    product_code = group_str
                                    logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> code (fallback): {product_code}")
                            
                            elif field_type == 'description':
                                # Description: contains letters (even if mixed with numbers like "14g")
                                # Must have at least one letter
                                # Must NOT be a pure number with comma/dot (e.g., "79,0000" or "79.0000")
                                # Check if it's a number format: starts with digit, contains comma/dot, ends with digits
                                is_number_format = re.match(r'^\d+[,\\.]\d+$', group_str.strip())
                                if not is_number_format and any(c.isalpha() or c in 'áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ' for c in group_str):
                                    description = group_str
                                    logger.debug(f"Group {idx+1} (position {idx}): {group_str[:30]}... -> description: {description[:30] if description else ''}...")
                                elif is_dekos_format and is_number_format and idx == 1:
                                    # For Dekos format, if position 1 (description) contains a number with comma/dot,
                                    # check if it has 4 decimal places (unit_price pattern)
                                    # If so, treat this as unit_price and assign it, then we'll find description in fallback
                                    decimal_match = re.search(r'[,\\.](\d+)$', group_str.strip())
                                    decimal_places = len(decimal_match.group(1)) if decimal_match else 0
                                    if decimal_places == 4:
                                        logger.warning(f"Group {idx+1} (position {idx}, Dekos description): '{group_str}' has 4 decimals (unit_price pattern), not description. Pattern may be incorrect. Assigning as unit_price.")
                                        num_val = extract_number(group_str)
                                        if num_val > 0 and not unit_price:
                                            unit_price = num_val
                                            logger.debug(f"Group {idx+1} (position {idx}, reassigned from description to unit_price): {group_str} -> unit_price: {unit_price} (4 decimals)")
                                    else:
                                        logger.warning(f"Group {idx+1} (position {idx}, Dekos description): '{group_str}' is a number but doesn't match unit_price (4 decimals) or quantity (3 decimals) pattern. Pattern may be incorrect.")
                                # If description position doesn't match, we'll try to find it later
                            
                            elif field_type == 'quantity':
                                # Quantity: number, typically 0.1 - 10000
                                # For Dekos format: quantity has exactly 3 decimal places (e.g., "8,000" or "1 000,000" with spaces between thousands)
                                # Quantity may contain spaces between thousands in Czech format (e.g., "1 000,000")
                                quantity_str = group_str.strip()
                                # For Czech format, spaces are thousands separators, so extract_number will handle them correctly
                                decimal_match = re.search(r'[,\\.](\d+)$', quantity_str)
                                decimal_places = len(decimal_match.group(1)) if decimal_match else 0
                                num_val = extract_number(quantity_str)
                                if num_val > 0 and num_val <= 10000:
                                    if is_dekos_format:
                                        # Check decimal places for Dekos format
                                        # Quantity should have 3 decimals (e.g., "8,000" or "1 000,000")
                                        # Should NOT have 4 decimals (that's unit_price) or 2 decimals (that's line_total)
                                        if decimal_places == 3:
                                            quantity = num_val
                                            logger.debug(f"Group {idx+1} (position {idx}): '{quantity_str}' -> quantity: {quantity} (3 decimals - Dekos format)")
                                        elif decimal_places == 0:
                                            # Integer quantity is also valid
                                            quantity = num_val
                                            logger.debug(f"Group {idx+1} (position {idx}): '{quantity_str}' -> quantity: {quantity} (integer - Dekos format)")
                                        elif decimal_places == 4:
                                            # This might be unit_price, not quantity
                                            logger.debug(f"Group {idx+1} (position {idx}): '{quantity_str}' -> skipping quantity (has 4 decimals, likely unit_price)")
                                            continue
                                        elif decimal_places == 2:
                                            # This might be line_total, not quantity
                                            logger.debug(f"Group {idx+1} (position {idx}): '{quantity_str}' -> skipping quantity (has 2 decimals, likely line_total)")
                                            continue
                                        else:
                                            logger.debug(f"Group {idx+1} (position {idx}): '{quantity_str}' -> skipping quantity (has {decimal_places} decimals, expected 3 for Dekos)")
                                            continue
                                    else:
                                        quantity = num_val
                                        logger.debug(f"Group {idx+1} (position {idx}): '{quantity_str}' -> quantity: {quantity}")
                            
                            elif field_type == 'unit':
                                # Unit: short string (1-10 chars), letters or combination of digits and letters (e.g., "1ks", "bal", "tis")
                                # Must contain at least one letter to distinguish from pure numbers
                                if len(group_str) <= 10 and any(c.isalpha() or c in 'áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ' for c in group_str):
                                    unit_of_measure = group_str.lower()
                                    logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> unit: {unit_of_measure}")
                            
                            elif field_type == 'unit_price':
                                # Unit price: number, typically 1-10000
                                # For Dekos format: unit_price has exactly 4 decimal places (e.g., "79,0000")
                                # Unit_price may contain spaces or additional numbers (e.g., "1,6600 1")
                                # Extract only the part before space or before any additional number
                                unit_price_str = group_str.strip()
                                # Remove any trailing numbers after space (e.g., "1,6600 1" → "1,6600")
                                unit_price_str = re.sub(r'\s+\d+$', '', unit_price_str).strip()
                                num_val = extract_number(unit_price_str)
                                if num_val > 0:
                                    if is_dekos_format:
                                        # Check decimal places for Dekos format
                                        decimal_match = re.search(r'[,\\.](\d+)$', unit_price_str)
                                        decimal_places = len(decimal_match.group(1)) if decimal_match else 0
                                        if decimal_places == 4:
                                            unit_price = num_val
                                            logger.debug(f"Group {idx+1} (position {idx}): '{group_str}' -> cleaned: '{unit_price_str}' -> unit_price: {unit_price} (4 decimals - Dekos format)")
                                        elif decimal_places == 0:
                                            # Integer unit_price is also valid (fallback)
                                            unit_price = num_val
                                            logger.debug(f"Group {idx+1} (position {idx}): '{group_str}' -> cleaned: '{unit_price_str}' -> unit_price: {unit_price} (integer - Dekos format)")
                                        else:
                                            logger.debug(f"Group {idx+1} (position {idx}): '{group_str}' -> cleaned: '{unit_price_str}' -> skipping unit_price (has {decimal_places} decimals, expected 4 for Dekos)")
                                            continue
                                    else:
                                        unit_price = num_val
                                        logger.debug(f"Group {idx+1} (position {idx}): '{group_str}' -> unit_price: {unit_price}")
                            
                            elif field_type == 'line_total':
                                # Line total: number, typically larger
                                # For Dekos format: line_total has exactly 2 decimal places (e.g., "632,00" or "1 660,00")
                                num_val = extract_number(group_str)
                                if num_val > 0:
                                    if is_dekos_format:
                                        # Check decimal places for Dekos format
                                        decimal_match = re.search(r'[,\\.](\d+)$', group_str.strip())
                                        decimal_places = len(decimal_match.group(1)) if decimal_match else 0
                                        if decimal_places == 2:
                                            line_total = num_val
                                            logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> line_total: {line_total} (2 decimals - Dekos format)")
                                        elif decimal_places == 0:
                                            # Integer line_total is also valid (fallback)
                                            line_total = num_val
                                            logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> line_total: {line_total} (integer - Dekos format)")
                                        else:
                                            logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> skipping line_total (has {decimal_places} decimals, expected 2 for Dekos)")
                                            continue
                                    else:
                                        line_total = num_val
                                        logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> line_total: {line_total}")
                            
                            elif field_type == 'vat_rate':
                                # VAT rate: small number (10-25), typically "12" or "21"
                                if group_str.isdigit():
                                    vat_num = extract_number(group_str)
                                    if vat_num >= 10 and vat_num <= 25:
                                        vat_rate = vat_num
                                        logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> vat_rate: {vat_rate}")
                            
                            elif field_type == 'vat_amount':
                                # VAT amount: number (for Le-co format)
                                num_val = extract_number(group_str)
                                if num_val > 0:
                                    vat_amount = num_val
                                    logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> vat_amount: {vat_amount}")
                            
                            elif field_type == 'total_with_vat':
                                # Total with VAT: number (for Le-co format)
                                num_val = extract_number(group_str)
                                if num_val > 0:
                                    total_with_vat = num_val
                                    logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> total_with_vat: {total_with_vat}")
                                    # Use total_with_vat as line_total if line_total is smaller (sometimes line_total is before VAT)
                                    if num_val > line_total:
                                        line_total = num_val
                                        logger.debug(f"Using total_with_vat as line_total: {line_total}")
                        
                        # Second pass: if description wasn't found, look for it in any remaining groups
                        # Also check if description position was assigned incorrectly (has number instead of text)
                        if not description:
                            for idx, group_str in enumerate(groups):
                                if not group_str:
                                    continue
                                group_str = str(group_str).strip()
                                
                                # Skip already assigned fields (code, quantity, unit_price, line_total)
                                # For Dekos format: code (0), description (1), unit_price (2), quantity (3), unit (4), vat_rate (5), line_total (6)
                                # For standard format: code (0), description (1), quantity (2), unit (3), unit_price (4), line_total (5), vat_rate (6)
                                if idx == 0 and group_str == product_code:
                                    continue  # Skip code
                                num_val = extract_number(group_str)
                                if is_dekos_format:
                                    # Dekos format: unit_price at idx 2, quantity at idx 3, line_total at idx 6
                                    # But if regex pattern is wrong, unit_price might be at idx 1 (description position)
                                    # Check if position 1 contains a number with comma/dot - if so, skip it (it's unit_price)
                                    is_number_format = re.match(r'^\d+[,\\.]\d+$', group_str.strip())
                                    if idx == 1 and is_number_format:
                                        logger.warning(f"Group {idx+1} (position {idx}, Dekos description): '{group_str}' is unit_price, not description. Skipping.")
                                        continue  # Skip unit_price at description position
                                    if idx == 2 and num_val == unit_price and unit_price > 0:
                                        continue  # Skip unit_price
                                    if idx == 3 and num_val == quantity and quantity > 0:
                                        continue  # Skip quantity
                                    if idx == 6 and num_val == line_total and line_total > 0:
                                        continue  # Skip line_total
                                else:
                                    # Standard format: quantity at idx 2, unit_price at idx 4, line_total at idx 5
                                    if idx == 2 and num_val == quantity and quantity > 0:
                                        continue  # Skip quantity
                                    if idx == 4 and num_val == unit_price and unit_price > 0:
                                        continue  # Skip unit_price
                                    if idx == 5 and num_val == line_total and line_total > 0:
                                        continue  # Skip line_total
                                
                                # Look for description: contains letters (must have at least one letter)
                                # Must NOT be a pure number with comma/dot (e.g., "79,0000" or "79.0000")
                                is_number_format = re.match(r'^\d+[,\\.]\d+$', group_str.strip())
                                if not is_number_format and any(c.isalpha() or c in 'áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ' for c in group_str):
                                    description = group_str
                                    logger.debug(f"Group {idx+1} (fallback): {group_str[:30]}... -> description: {description[:30] if description else ''}...")
                                    break
                        
                        # Special case for Dekos format: if quantity was split between groups[2] and groups[3]
                        # Check if groups[2] (unit_price position) contains "1,6600 1" and groups[3] (quantity position) contains "000,000"
                        # This happens when pattern splits "1 000,000" into "1" (end of groups[2]) and "000,000" (groups[3])
                        if is_dekos_format and quantity == 0 and len(groups) >= 4:
                            unit_price_group = groups[2].strip() if len(groups) > 2 else ""
                            quantity_group = groups[3].strip() if len(groups) > 3 else ""
                            
                            # Check if groups[2] ends with space+number and groups[3] is "000,000"
                            if re.match(r'^000,000$', quantity_group):
                                trailing_match = re.search(r'\s+(\d+)$', unit_price_group)
                                if trailing_match:
                                    trailing_num = trailing_match.group(1)
                                    # Combine trailing_num + groups[3] to get full quantity: "1 000,000"
                                    combined_quantity_str = f"{trailing_num} {quantity_group}"
                                    quantity_val = extract_number(combined_quantity_str)
                                    decimal_match = re.search(r'[,\\.](\d+)$', combined_quantity_str)
                                    decimal_places = len(decimal_match.group(1)) if decimal_match else 0
                                    if quantity_val > 0 and (decimal_places == 3 or decimal_places == 0):
                                        quantity = quantity_val
                                        logger.info(f"Detected split quantity in Dekos format: groups[2]='{unit_price_group}' contains '{trailing_num}', groups[3]='{quantity_group}' -> combined: '{combined_quantity_str}' -> quantity: {quantity}")
                                        
                                        # Also update unit_price if it wasn't extracted yet
                                        if unit_price == 0:
                                            # Remove the trailing number part from unit_price_str
                                            cleaned_unit_price_str = re.sub(r'\s+\d+$', '', unit_price_group).strip()
                                            decimal_match = re.search(r'[,\\.](\d+)$', cleaned_unit_price_str)
                                            decimal_places = len(decimal_match.group(1)) if decimal_match else 0
                                            if decimal_places == 4:
                                                unit_price = extract_number(cleaned_unit_price_str)
                                                logger.info(f"Updated unit_price from split quantity: '{unit_price_group}' -> cleaned: '{cleaned_unit_price_str}' -> unit_price: {unit_price}")
                        
                        # Third pass: if quantity is still 0, check if description position has a number
                        # If description position (idx=1) has a number instead of text, use it as quantity
                        if quantity == 0 and len(groups) > 1:
                            desc_pos_value = str(groups[1]).strip() if groups[1] else ""
                            if desc_pos_value and not any(c.isalpha() or c in 'áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ' for c in desc_pos_value):
                                # Description position has a number, use it as quantity
                                num_val = extract_number(desc_pos_value)
                                if num_val > 0 and num_val <= 10000 and num_val != unit_price and num_val != line_total:
                                    quantity = num_val
                                    logger.debug(f"Group 2 (description position, repurposed): {desc_pos_value} -> quantity: {quantity}")
                        
                        # Fourth pass: if quantity is still 0, look for any unassigned numeric group
                        if quantity == 0:
                            for idx, group_str in enumerate(groups):
                                if not group_str:
                                    continue
                                group_str = str(group_str).strip()
                                
                                # Skip if already assigned or is code/vat_rate
                                if idx == 0 and group_str == product_code:
                                    continue
                                if idx == 1 and not description:  # Skip description position if not yet assigned
                                    num_val = extract_number(group_str)
                                    if num_val > 0 and num_val != unit_price and num_val != line_total:
                                        quantity = num_val
                                        logger.debug(f"Group {idx+1} (fallback quantity from description pos): {group_str} -> quantity: {quantity}")
                                        break
                                if group_str.isdigit() and extract_number(group_str) >= 10 and extract_number(group_str) <= 25:
                                    continue  # Probably VAT rate
                                
                                # Check if this looks like quantity (smaller number, early position)
                                num_val = extract_number(group_str)
                                if num_val > 0 and num_val <= 10000 and num_val != unit_price and num_val != line_total:
                                    # For Dekos format, check decimal places
                                    if is_dekos_format:
                                        decimal_match = re.search(r'[,\\.](\d+)$', group_str.strip())
                                        decimal_places = len(decimal_match.group(1)) if decimal_match else 0
                                        
                                        # Quantity should have 3 decimals (e.g., "8,000" or "1 000,000") or be integer
                                        # Should NOT have 4 decimals (that's unit_price) or 2 decimals (that's line_total)
                                        if decimal_places == 3 or decimal_places == 0:
                                            # If it's in position 3 (expected quantity position) or if it's reasonable for quantity
                                            # Also check: if groups[3] was 0, and this value is reasonable, it might be quantity
                                            if idx == 3 or (idx <= 3 and (unit_price == 0 or num_val < unit_price)) or (num_val >= 10 and num_val < line_total if line_total > 0 else True):
                                                quantity = num_val
                                                logger.debug(f"Group {idx+1} (fallback, Dekos): '{group_str}' -> quantity: {quantity} ({decimal_places} decimals, position {idx})")
                                                break
                                        # Explicitly skip if it has 4 decimals (unit_price) or 2 decimals (line_total)
                                        elif decimal_places == 4:
                                            logger.debug(f"Group {idx+1} (fallback, Dekos): '{group_str}' -> skipping quantity (has 4 decimals, likely unit_price)")
                                            continue
                                        elif decimal_places == 2:
                                            logger.debug(f"Group {idx+1} (fallback, Dekos): '{group_str}' -> skipping quantity (has 2 decimals, likely line_total)")
                                            continue
                                        # Special case: if groups[3] was 0, and we have a number that could be quantity, use it
                                        # But make sure it's not line_total (line_total has 2 decimals) or unit_price (unit_price has 4 decimals)
                                        elif decimal_places != 2 and decimal_places != 4 and num_val > 0 and (idx == 3 or num_val < line_total if line_total > 0 else True):
                                            # This might be quantity if groups[3] was 0
                                            quantity = num_val
                                            logger.debug(f"Group {idx+1} (fallback, Dekos, special case): '{group_str}' -> quantity: {quantity} ({decimal_places} decimals, position {idx})")
                                            break
                                    else:
                                        # Standard format: if it's in an early position (0-3) or smaller than unit_price, it's likely quantity
                                        if idx <= 3 or (unit_price > 0 and num_val < unit_price):
                                            quantity = num_val
                                            logger.debug(f"Group {idx+1} (fallback): '{group_str}' -> quantity: {quantity}")
                                            break
                        
                        # Fifth pass: if unit_price is still 0, look for any unassigned numeric group with 4 decimals (Dekos format)
                        if unit_price == 0 and is_dekos_format:
                            for idx, group_str in enumerate(groups):
                                if not group_str:
                                    continue
                                group_str = str(group_str).strip()
                                
                                # Skip if already assigned or is code/quantity/vat_rate/line_total
                                if idx == 0 and group_str == product_code:
                                    continue
                                if group_str.isdigit() and extract_number(group_str) >= 10 and extract_number(group_str) <= 25:
                                    continue  # Probably VAT rate
                                
                                # Check if this looks like unit_price (4 decimals for Dekos)
                                num_val = extract_number(group_str)
                                if idx == 3 and num_val == quantity and quantity > 0:
                                    continue  # Skip quantity
                                if idx == 6 and num_val == line_total and line_total > 0:
                                    continue  # Skip line_total
                                if num_val > 0 and num_val != quantity and num_val != line_total:
                                    decimal_match = re.search(r'[,\\.](\d+)$', group_str.strip())
                                    decimal_places = len(decimal_match.group(1)) if decimal_match else 0
                                    # Unit_price should have 4 decimals for Dekos, or be integer
                                    if decimal_places == 4 or decimal_places == 0:
                                        # If it's in position 2 (expected unit_price position) or larger than quantity, it's likely unit_price
                                        if idx == 2 or (quantity > 0 and num_val > quantity):
                                            unit_price = num_val
                                            logger.debug(f"Group {idx+1} (fallback unit_price, Dekos): {group_str} -> unit_price: {unit_price} ({decimal_places} decimals)")
                                            break
                        
                        # If we found product_code or at least some fields, use this format
                        if product_code or description or quantity > 0:
                            # For Leco format (9 groups), calculate line_total = quantity * unit_price for accuracy
                            if len(groups) == 9 and quantity > 0 and unit_price > 0:
                                calculated_line_total = quantity * unit_price
                                logger.info(f"Leco format detected (9 groups) - calculating line_total: {quantity} * {unit_price} = {calculated_line_total} (was: {line_total})")
                                line_total = calculated_line_total
                            
                            logger.info(f"Extracting interactive labeling format ({len(groups)} groups) - code: {product_code}, description: {description}, quantity: {quantity} {unit_of_measure}, unit_price: {unit_price}, total: {line_total}, vat_rate: {vat_rate}, vat_amount: {vat_amount}, total_with_vat: {total_with_vat}")
                            
                            # Apply code corrections if configured
                            corrected_code = apply_code_corrections(product_code, code_corrections) if product_code else None
                            
                            # Apply description corrections if configured
                            description_corrections = table_columns.get('description_corrections', {})
                            corrected_description = apply_description_corrections(description, description_corrections) if description else None
                            
                            return InvoiceItem(
                                product_code=corrected_code,
                                description=corrected_description,
                                quantity=quantity,
                                unit_of_measure=unit_of_measure,
                                unit_price=unit_price,
                                line_total=line_total,
                                vat_rate=vat_rate,
                                vat_amount=vat_amount,
                                total_with_vat=total_with_vat,
                                line_number=line_number,
                            )
                    
                    # MAKRO format: 10 captures (full format with VAT)
                    # code, quantity, description, base_price, units_in_mu, price_per_mu, total, vat_rate, vat_amount, total_with_vat
                    
                    base_price_val = extract_number(groups[3]) if len(groups) > 3 else None
                    units_in_mu_val = extract_number(groups[4]) if len(groups) > 4 else None
                    description = groups[2].strip() if len(groups) > 2 else None
                    quantity_field = extract_number(groups[1]) if len(groups) > 1 else 0
                    line_total = extract_number(groups[6]) if len(groups) > 6 else 0
                    
                    logger.info(f"Extracting 10-group MAKRO format - base_price: {base_price_val}, units_in_mu: {units_in_mu_val}")
                    
                    # Detect format: items starting with "*" are sold by weight (Format B)
                    is_weight_format = description and description.startswith('*')
                    
                    # Extract weight from description and calculate price per kg
                    package_weight_kg = extract_weight_from_description(description)
                    total_weight_kg = None
                    price_per_kg = None
                    quantity = quantity_field
                    
                    if is_weight_format:
                        # Format B: quantity field is actually total weight in kg
                        total_weight_kg = quantity_field
                        price_per_kg = base_price_val  # base_price is actually price per kg
                        quantity = 1  # No package count, just weight
                        logger.info(f"Format B (by weight): total_weight={total_weight_kg} kg, price_per_kg={price_per_kg} Kč/kg")
                    elif package_weight_kg:
                        # Format A: calculate total weight based on units_in_mu or quantity
                        # If units_in_mu > 1, it means multiple units per package (e.g., "100g 12x" = 1.2 kg)
                        # If units_in_mu = 1, use quantity as package count
                        if units_in_mu_val and units_in_mu_val > 1:
                            total_weight_kg = package_weight_kg * units_in_mu_val
                            logger.info(f"Format A (multi-unit package): {package_weight_kg} kg × {units_in_mu_val} units = {total_weight_kg:.3f} kg")
                        elif quantity_field > 0:
                            total_weight_kg = package_weight_kg * quantity_field
                            logger.info(f"Format A (by quantity): {package_weight_kg} kg × {quantity_field} packages = {total_weight_kg:.3f} kg")
                        
                        if total_weight_kg and total_weight_kg > 0 and line_total > 0:
                            price_per_kg = line_total / total_weight_kg
                            logger.info(f"Calculated price per kg: {price_per_kg:.2f} Kč/kg (total: {line_total}, weight: {total_weight_kg:.3f} kg)")
                    
                    # Apply code corrections if configured
                    raw_code = groups[0] if len(groups) > 0 else None
                    corrected_code = apply_code_corrections(raw_code, code_corrections) if raw_code else None
                    
                    # Apply description corrections if configured
                    description_corrections = table_columns.get('description_corrections', {})
                    corrected_description = apply_description_corrections(description, description_corrections) if description else None
                    
                    return InvoiceItem(
                        product_code=corrected_code,
                        quantity=quantity,
                        description=corrected_description,
                        unit_of_measure=None,  # Unit is in description, not separate
                        base_price=base_price_val,
                        units_in_mu=units_in_mu_val,
                        unit_price=extract_number(groups[5]) if len(groups) > 5 else 0,
                        line_total=line_total,
                        vat_rate=extract_number(groups[7]) if len(groups) > 7 else None,
                        vat_amount=extract_number(groups[8]) if len(groups) > 8 else None,
                        total_with_vat=extract_number(groups[9]) if len(groups) > 9 else None,
                        line_number=line_number,
                        package_weight_kg=package_weight_kg,
                        total_weight_kg=total_weight_kg,
                        price_per_kg=price_per_kg,
                    )
                elif len(groups) >= 7:
                    # Check if this is Dekos format (code contains dot, e.g., "35.0400" or "8.5340-1")
                    # Dekos format should use interactive labeling, not MAKRO format
                    first_group = groups[0] if len(groups) > 0 else ""
                    # Support codes with dot only (e.g., "35.0400") or with dot and dash (e.g., "8.5340-1")
                    is_dekos_format = first_group and '.' in str(first_group) and re.match(r'^\d+\.\d+(-?\d*)?$', str(first_group))
                    
                    if is_dekos_format:
                        # This is Dekos format - should have been handled by interactive labeling above
                        # If we reach here, interactive labeling didn't extract fields correctly
                        # Force use of interactive labeling logic by re-processing with Dekos field order
                        logger.warning(f"Dekos format detected (code: {first_group}) but interactive labeling didn't extract fields correctly. Retrying with Dekos format detection.")
                        
                        # Re-process using Dekos format logic
                        product_code = first_group
                        description = groups[1].strip() if len(groups) > 1 else None
                        unit_price = 0
                        quantity = 0
                        unit_of_measure = None
                        vat_rate = None
                        line_total = 0
                        
                        # Dekos format: code, description, unit_price, quantity, unit, vat_rate, line_total
                        if len(groups) >= 3:
                            # Check decimal places for unit_price (should have 4 decimals)
                            # Unit_price may contain spaces or additional numbers (e.g., "1,6600 1")
                            # Extract only the part before space or before any additional number
                            unit_price_str = groups[2].strip() if len(groups) > 2 else ""
                            
                            # Special case: if unit_price_str contains "1,6600 1", it means quantity "1 000,000" is split
                            # Pattern captured "1,6600 1" where "1" is the start of "1 000,000"
                            # Check if groups[2] ends with a space and number, and groups[3] starts with "000,000"
                            quantity_prefix = None
                            if len(groups) >= 4:
                                quantity_str_check = groups[3].strip() if len(groups) > 3 else ""
                                # If groups[2] ends with space+number and groups[3] is "000,000", combine them
                                if re.match(r'^000,000$', quantity_str_check):
                                    # groups[2] probably contains "1,6600 1" where "1" is the start of "1 000,000"
                                    # Extract the trailing number after space in groups[2]
                                    trailing_match = re.search(r'\s+(\d+)$', unit_price_str)
                                    if trailing_match:
                                        trailing_num = trailing_match.group(1)
                                        # Combine trailing_num + groups[3] to get full quantity: "1 000,000"
                                        quantity_prefix = trailing_num
                                        logger.debug(f"Detected split quantity: groups[2]='{groups[2]}' contains '{trailing_num}', groups[3]='{quantity_str_check}' -> quantity='{trailing_num} {quantity_str_check}'")
                            
                            # Remove any trailing numbers after space (e.g., "1,6600 1" → "1,6600")
                            if quantity_prefix:
                                # Remove the trailing number part (it belongs to quantity)
                                unit_price_str = re.sub(r'\s+\d+$', '', unit_price_str).strip()
                            
                            decimal_match = re.search(r'[,\\.](\d+)$', unit_price_str)
                            decimal_places = len(decimal_match.group(1)) if decimal_match else 0
                            if decimal_places == 4:
                                unit_price = extract_number(unit_price_str)
                                logger.debug(f"Group 3 (unit_price): '{groups[2]}' -> cleaned: '{unit_price_str}' -> unit_price: {unit_price} (4 decimals)")
                            else:
                                logger.warning(f"Group 3 (unit_price): '{groups[2]}' -> cleaned: '{unit_price_str}' has {decimal_places} decimals, expected 4 for Dekos")
                        
                        if len(groups) >= 4:
                            # Check decimal places for quantity (should have 3 decimals)
                            # Quantity may contain spaces between thousands (e.g., "1 000,000")
                            quantity_str = groups[3].strip() if len(groups) > 3 else ""
                            
                            # If quantity_prefix was found, combine it with groups[3] to get full quantity
                            if quantity_prefix:
                                quantity_str = f"{quantity_prefix} {quantity_str}"
                                logger.debug(f"Combining quantity: '{quantity_prefix}' + '{groups[3]}' -> '{quantity_str}'")
                            
                            # For Czech format, spaces are thousands separators, so extract_number will handle them correctly
                            decimal_match = re.search(r'[,\\.](\d+)$', quantity_str)
                            decimal_places = len(decimal_match.group(1)) if decimal_match else 0
                            quantity_val = extract_number(quantity_str)
                            if quantity_val > 0 and (decimal_places == 3 or decimal_places == 0):
                                quantity = quantity_val
                                logger.debug(f"Group 4 (quantity): '{groups[3]}' -> full: '{quantity_str}' -> quantity: {quantity} ({decimal_places} decimals)")
                            elif quantity_val == 0:
                                # If groups[3] is 0, try to find quantity elsewhere
                                # Look for a number that could be quantity (has 3 decimals or integer, not 2 decimals)
                                # Quantity may have spaces between thousands (e.g., "1 000,000")
                                logger.debug(f"Group 4 (quantity position) is 0, looking for quantity elsewhere")
                                for check_idx in range(len(groups)):
                                    if check_idx == 3:
                                        continue  # Skip position 3 (quantity position, already checked)
                                    check_group = groups[check_idx].strip() if check_idx < len(groups) else ""
                                    if not check_group:
                                        continue
                                    # For Czech format, spaces are thousands separators
                                    check_decimal_match = re.search(r'[,\\.](\d+)$', check_group)
                                    check_decimal_places = len(check_decimal_match.group(1)) if check_decimal_match else 0
                                    check_val = extract_number(check_group)
                                    # Quantity should have 3 decimals or be integer, but NOT 2 decimals (that's line_total)
                                    if check_val > 0 and check_val <= 10000 and check_decimal_places != 2 and (check_decimal_places == 3 or check_decimal_places == 0):
                                        # Check if it's not unit_price (unit_price has 4 decimals)
                                        if check_decimal_places != 4:
                                            quantity = check_val
                                            logger.debug(f"Group {check_idx+1} (fallback for quantity): '{check_group}' -> quantity: {quantity} ({check_decimal_places} decimals)")
                                            break
                        
                        if len(groups) >= 5:
                            unit_of_measure = groups[4].strip() if len(groups) > 4 else None
                        
                        if len(groups) >= 6:
                            vat_rate = extract_number(groups[5]) if len(groups) > 5 else None
                        
                        if len(groups) >= 7:
                            # Check decimal places for line_total (should have 2 decimals)
                            line_total_str = groups[6].strip() if len(groups) > 6 else ""
                            decimal_match = re.search(r'[,\\.](\d+)$', line_total_str)
                            decimal_places = len(decimal_match.group(1)) if decimal_match else 0
                            if decimal_places == 2:
                                line_total = extract_number(line_total_str)
                                logger.debug(f"Group 7 (line_total): {line_total_str} -> line_total: {line_total} (2 decimals - Dekos format)")
                            elif decimal_places == 0:
                                # Integer line_total is also valid (fallback)
                                line_total = extract_number(line_total_str)
                                logger.debug(f"Group 7 (line_total): {line_total_str} -> line_total: {line_total} (integer - Dekos format)")
                            else:
                                logger.warning(f"Group 7 (line_total): {line_total_str} has {decimal_places} decimals, expected 2 for Dekos format")
                                line_total = extract_number(line_total_str)  # Use anyway as fallback
                        
                        # Apply code corrections
                        corrected_code = apply_code_corrections(product_code, code_corrections) if product_code else None
                        
                        # Apply description corrections
                        description_corrections = table_columns.get('description_corrections', {})
                        corrected_description = apply_description_corrections(description, description_corrections) if description else None
                        
                        logger.info(f"Extracting Dekos format (fallback) - code: {corrected_code}, description: {corrected_description}, quantity: {quantity} {unit_of_measure}, unit_price: {unit_price}, total: {line_total}, vat_rate: {vat_rate}")
                        
                        # Check for ambiguous OCR pattern: capacity indicator + potential thousands separator
                        # Pattern: description ending with "5L" and unit_price starting with "51" (e.g., "STOP BAKTER 5L" + "51 108,1300")
                        # This could mean: OCR correctly captured "5L" but also the thousands separator looks suspicious
                        matching_confidence = 100
                        if corrected_description and unit_price:
                            # Check if description ends with capacity indicator (digit + L or I)
                            capacity_match = re.search(r'(\d)[LI]\s*$', corrected_description)
                            if capacity_match:
                                # Check if unit_price starts with a 2-digit number ending in 1
                                price_str = str(unit_price).replace(',', '').replace('.', '').replace(' ', '')
                                if price_str and len(price_str) >= 2:
                                    # Get first 2 digits
                                    first_two = price_str[:2]
                                    if first_two.endswith('1'):
                                        digit_before = capacity_match.group(1)
                                        # If they match (e.g., "5L" and price starts with "51"), it's ambiguous
                                        if first_two == f"{digit_before}1":
                                            matching_confidence = 75
                                            logger.warning(f"⚠️  Ambiguous OCR pattern detected: description ends with '{capacity_match.group(0)}' and unit_price starts with '{first_two}...'")
                                            logger.warning(f"   This could be: 1) Correct (5L + price 51,108), or 2) OCR duplicate (5L read as both '5L' and '51')")
                                            logger.warning(f"   Confidence reduced to {matching_confidence}% - MANUAL REVIEW RECOMMENDED")
                        
                        return InvoiceItem(
                            product_code=corrected_code,
                            description=corrected_description,
                            quantity=quantity,
                            unit_of_measure=unit_of_measure,
                            unit_price=unit_price,
                            line_total=line_total,
                            vat_rate=vat_rate,
                            line_number=line_number,
                            matching_confidence=matching_confidence,
                        )
                    
                    # MAKRO format: 7 captures (without VAT columns)
                    # code, quantity, description, base_price, units_in_mu, price_per_mu, total
                    
                    base_price_val = extract_number(groups[3]) if len(groups) > 3 else None
                    units_in_mu_val = extract_number(groups[4]) if len(groups) > 4 else None
                    
                    logger.info(f"Extracting 7-group MAKRO format - base_price: {base_price_val}, units_in_mu: {units_in_mu_val}")
                    
                    # Apply code corrections if configured
                    raw_code = groups[0] if len(groups) > 0 else None
                    corrected_code = apply_code_corrections(raw_code, code_corrections) if raw_code else None
                    
                    return InvoiceItem(
                        product_code=corrected_code,
                        quantity=extract_number(groups[1]) if len(groups) > 1 else 0,
                        description=groups[2].strip() if len(groups) > 2 else None,
                        unit_of_measure=None,
                        base_price=base_price_val,
                        units_in_mu=units_in_mu_val,
                        unit_price=extract_number(groups[5]) if len(groups) > 5 else 0,
                        line_total=extract_number(groups[6]) if len(groups) > 6 else 0,
                        line_number=line_number,
                    )
                elif len(groups) == 4:
                    # Albert format (4 groups): description, weight, price, vat_letter
                    # Example: "RYBÍZ ČERVENÝ 1250 39,90 A"
                    # No product code - retail format
                    description = groups[0].strip() if groups[0] else None
                    weight_raw = groups[1].strip() if len(groups) > 1 else None
                    unit_price = extract_number(groups[2]) if len(groups) > 2 else 0
                    vat_letter = groups[3].strip() if len(groups) > 3 else None
                    
                    # Convert VAT letter to percentage: A=12%, B=21%, C=10%, D=0%
                    vat_mapping = {'A': 12, 'B': 21, 'C': 10, 'D': 0}
                    vat_rate = vat_mapping.get(vat_letter, 12) if vat_letter else None
                    
                    # Calculate line_total: quantity=1 (one package), price = unit_price
                    quantity = 1
                    line_total = unit_price
                    
                    # Apply description corrections to weight (e.g., "1250" → "125g")
                    description_corrections = table_columns.get('description_corrections', {})
                    corrected_weight = apply_description_corrections(weight_raw, description_corrections) if weight_raw else None
                    
                    logger.info(f"Extracting Albert format (4 groups) - description: {description}, weight: {weight_raw} → {corrected_weight}, unit_price: {unit_price}, vat_letter: {vat_letter} ({vat_rate}%)")
                    
                    # Apply description corrections to name as well
                    corrected_description = apply_description_corrections(description, description_corrections) if description else None
                    
                    return InvoiceItem(
                        product_code=None,  # No product codes for Albert
                        description=corrected_description,
                        quantity=quantity,
                        unit_of_measure="ks",  # Pieces/packages
                        unit_price=unit_price,
                        line_total=line_total,
                        vat_rate=vat_rate,
                        line_number=line_number,
                        item_weight=corrected_weight,  # Store corrected weight (e.g., "125g")
                    )
                else:
                    # Original 6-group format
                    # Apply code corrections if configured
                    raw_code = groups[0] if len(groups) > 0 else None
                    corrected_code = apply_code_corrections(raw_code, code_corrections) if raw_code else None
                    
                    # Apply description corrections if configured
                    description_corrections = table_columns.get('description_corrections', {})
                    raw_description = groups[1] if len(groups) > 1 else None
                    corrected_description = apply_description_corrections(raw_description, description_corrections) if raw_description else None
                    
                    return InvoiceItem(
                        product_code=corrected_code,
                        description=corrected_description,
                        quantity=extract_number(groups[2]) if len(groups) > 2 else 0,
                        unit_of_measure=groups[3] if len(groups) > 3 else None,
                        unit_price=extract_number(groups[4]) if len(groups) > 4 else 0,
                        line_total=extract_number(groups[5]) if len(groups) > 5 else 0,
                        line_number=line_number,
                    )
        except Exception as e:
            logger.error(f"Error matching line pattern: {e}")
        return None
    
    # No pattern configured or pattern did not match - return None
    logger.warning(f"❌ No pattern configured or pattern did not match for line: {line[:80]}")
    return None

def calculate_confidence(extracted_data: Dict) -> float:
    """
    Calculate confidence score based on extracted data quality
    """
    score = 0
    max_score = 0
    
    # Invoice number
    max_score += 20
    if extracted_data.get('invoice_number'):
        score += 20
    
    # Date
    max_score += 20
    if extracted_data.get('date'):
        score += 20
    
    # Items
    max_score += 60
    items = extracted_data.get('items', [])
    if items:
        # Score based on completeness of item data
        complete_items = sum(
            1 for item in items 
            if item.product_code and item.quantity > 0
        )
        score += (complete_items / len(items)) * 60
    
    return (score / max_score) * 100 if max_score > 0 else 0

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

