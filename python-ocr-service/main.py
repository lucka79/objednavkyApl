"""
Template-based Invoice OCR Service
Extracts data from invoices using supplier-specific templates
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
        
        invoice_number = extract_pattern(raw_text_display, patterns.get('invoice_number'))
        date = extract_pattern(raw_text_display, patterns.get('date'))
        supplier = extract_pattern(raw_text_display, patterns.get('supplier'))
        total_amount = extract_number(extract_pattern(raw_text_display, patterns.get('total_amount')))
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
        return None
    
    try:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            return match.group(1) if match.groups() else match.group(0)
    except Exception as e:
        logger.error(f"Error extracting pattern '{pattern}': {e}")
    
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
    import re
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
    for line_no, line in enumerate(lines, 1):
        line = line.strip()
        
        if not line or len(line) < 5:
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
        
        # Skip section headers (lines with only uppercase letters and spaces)
        if re.match(r'^[A-ZĚŠČŘŽÝÁÍÉÚŮĎŤŇĹ\s]+$', line) and len(line) < 50:
            logger.debug(f"Skipping header line: {line}")
            continue
        
        # Skip lines that don't start with a digit (product codes should be numeric)
        if not re.match(r'^\d', line):
            logger.debug(f"Skipping non-product line: {line[:50]}")
            continue
        
        # Log lines from second page for debugging
        if '01395050' in line or '01250120' in line or 'Vídeňské chlebové koření' in line or 'BAS tmavý' in line:
            logger.info(f"⚠️ Processing line from second page (line {line_no}): {line[:100]}")
        
        # Try to extract item from line
        item = extract_item_from_line(line, table_columns, line_no)
        
        if item and item.product_code:
            items.append(item)
            logger.debug(f"Extracted item: {item.product_code} - {item.description}")
        elif '01395050' in line or '01250120' in line:
            # Log if second page items don't match
            logger.warning(f"❌ Line from second page did not match pattern (line {line_no}): {line[:100]}")
            logger.warning(f"   Pattern used: {table_columns.get('line_pattern', 'None')}")
        elif line_no % 50 == 0:  # Log every 50th line to see progress
            logger.debug(f"Line {line_no} did not match pattern: {line[:80]}")
    
    logger.info(f"Extracted {len(items)} valid items (started with {items_before_extraction}, processed {len(lines)} lines)")
    
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
        logger.info(f"Using line_pattern: {item_pattern}")
        logger.info(f"Testing against line: {line[:80]}")
        try:
            # Validate pattern before using it
            try:
                re.compile(item_pattern)
            except re.error as pattern_error:
                logger.error(f"Invalid regex pattern: {pattern_error}")
                logger.error(f"Pattern: {item_pattern}")
                return None
            
            match = re.match(item_pattern, line)
            
            # If primary pattern doesn't match, try alternative Backaldrin patterns for edge cases
            if not match and r'\d{8}' in item_pattern:
                # This looks like a Backaldrin pattern - try alternative formats
                # Format 1: "5 kg 5kg" (space optional between qty and unit)
                # Format 2: "12 kg 0004260834 12 kg" (batch number between)
                alternative_pattern = r'^(\d{8})\s+([A-Za-zá-žÁ-Ž]+(?:\s+[A-Za-zá-žÁ-Ž]+)*(?:\s+\d+\s*%)?)\s+([\d,]+)\s*([a-zA-Z]{1,5})\s+(?:\d{8,}\s+)?([\d,]+)\s*([a-zA-Z]{1,5})\s+([\d,\s]+)\s+([\d\s,]+)\s*\|\s*(\d+)%'
                match = re.match(alternative_pattern, line)
                if match:
                    logger.info(f"✅ Alternative Backaldrin pattern matched (flexible spacing + optional batch): {line[:80]}")
            
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
                                if group_str.isdigit() and len(group_str) >= 3 and len(group_str) <= 7:
                                    product_code = group_str
                                    logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> code: {product_code}")
                                elif '.' in group_str and re.match(r'^\d+\.\d+$', group_str):
                                    # Dekos format: code with dot (e.g., "35.0400")
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
                                # For Dekos format: quantity has exactly 3 decimal places (e.g., "8,000")
                                num_val = extract_number(group_str)
                                if num_val > 0 and num_val <= 10000:
                                    if is_dekos_format:
                                        # Check decimal places for Dekos format
                                        decimal_match = re.search(r'[,\\.](\d+)$', group_str.strip())
                                        decimal_places = len(decimal_match.group(1)) if decimal_match else 0
                                        if decimal_places == 3:
                                            quantity = num_val
                                            logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> quantity: {quantity} (3 decimals - Dekos format)")
                                        elif decimal_places == 0:
                                            # Integer quantity is also valid
                                            quantity = num_val
                                            logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> quantity: {quantity} (integer - Dekos format)")
                                        else:
                                            logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> skipping quantity (has {decimal_places} decimals, expected 3 for Dekos)")
                                            continue
                                    else:
                                        quantity = num_val
                                        logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> quantity: {quantity}")
                            
                            elif field_type == 'unit':
                                # Unit: short string (1-10 chars), letters or combination of digits and letters (e.g., "1ks", "bal", "tis")
                                # Must contain at least one letter to distinguish from pure numbers
                                if len(group_str) <= 10 and any(c.isalpha() or c in 'áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ' for c in group_str):
                                    unit_of_measure = group_str.lower()
                                    logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> unit: {unit_of_measure}")
                            
                            elif field_type == 'unit_price':
                                # Unit price: number, typically 1-10000
                                # For Dekos format: unit_price has exactly 4 decimal places (e.g., "79,0000")
                                num_val = extract_number(group_str)
                                if num_val > 0:
                                    if is_dekos_format:
                                        # Check decimal places for Dekos format
                                        decimal_match = re.search(r'[,\\.](\d+)$', group_str.strip())
                                        decimal_places = len(decimal_match.group(1)) if decimal_match else 0
                                        if decimal_places == 4:
                                            unit_price = num_val
                                            logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> unit_price: {unit_price} (4 decimals - Dekos format)")
                                        elif decimal_places == 0:
                                            # Integer unit_price is also valid (fallback)
                                            unit_price = num_val
                                            logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> unit_price: {unit_price} (integer - Dekos format)")
                                        else:
                                            logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> skipping unit_price (has {decimal_places} decimals, expected 4 for Dekos)")
                                            continue
                                    else:
                                        unit_price = num_val
                                        logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> unit_price: {unit_price}")
                            
                            elif field_type == 'line_total':
                                # Line total: number, typically larger
                                num_val = extract_number(group_str)
                                if num_val > 0:
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
                                # VAT amount: number (extracted for logging, but not stored in InvoiceItem)
                                num_val = extract_number(group_str)
                                if num_val > 0:
                                    logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> vat_amount: {num_val}")
                            
                            elif field_type == 'total_with_vat':
                                # Total with VAT: number (extracted for logging, but line_total is already set)
                                num_val = extract_number(group_str)
                                if num_val > 0:
                                    logger.debug(f"Group {idx+1} (position {idx}): {group_str} -> total_with_vat: {num_val}")
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
                                        # Quantity should have 3 decimals for Dekos, or be integer
                                        if decimal_places == 3 or decimal_places == 0:
                                            # If it's in an early position (0-3) or smaller than unit_price, it's likely quantity
                                            if idx <= 3 or (unit_price > 0 and num_val < unit_price):
                                                quantity = num_val
                                                logger.debug(f"Group {idx+1} (fallback, Dekos): {group_str} -> quantity: {quantity} ({decimal_places} decimals)")
                                                break
                                    else:
                                        # Standard format: if it's in an early position (0-3) or smaller than unit_price, it's likely quantity
                                        if idx <= 3 or (unit_price > 0 and num_val < unit_price):
                                            quantity = num_val
                                            logger.debug(f"Group {idx+1} (fallback): {group_str} -> quantity: {quantity}")
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
                            # For Leco format (9 groups), calculate line_total = quantity * unit_price
                            # This is more accurate than OCR extraction, especially with Czech number formatting
                            if len(groups) == 9 and quantity > 0 and unit_price > 0:
                                calculated_line_total = quantity * unit_price
                                logger.info(f"Leco format detected (9 groups) - calculating line_total: {quantity} * {unit_price} = {calculated_line_total} (was: {line_total})")
                                line_total = calculated_line_total
                            
                            logger.info(f"Extracting interactive labeling format ({len(groups)} groups) - code: {product_code}, description: {description}, quantity: {quantity} {unit_of_measure}, unit_price: {unit_price}, total: {line_total}, vat_rate: {vat_rate}")
                            
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

