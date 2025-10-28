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
            
            qr_codes.append(QRCodeData(
                data=qr_data,
                type=qr_type,
                page=page_num
            ))
            
            logger.info(f"Detected {qr_type} on page {page_num}: {qr_data[:100]}")
    
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
    """Extract number from text"""
    if not text:
        return 0
    
    # Remove spaces and replace Czech decimal comma with period
    cleaned = text.replace(' ', '').replace(',', '.')
    
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
            if table_end_pattern:
                # Find all matches
                end_matches = list(re.finditer(table_end_pattern, raw_text, re.IGNORECASE | re.MULTILINE))
                if end_matches:
                    # Use the last match (for multi-page tables)
                    end_pos = end_matches[-1].start()
                    logger.info(f"Found {len(end_matches)} table end markers, using the last one")
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
    
    # Check if it's a multi-line pattern (contains \n in pattern)
    if item_pattern and '\\n' in item_pattern:
        logger.info(f"Using multi-line pattern extraction")
        
        # Use regex with MULTILINE and DOTALL flags
        try:
            matches = re.finditer(item_pattern, text, re.MULTILINE)
            
            for match_no, match in enumerate(matches, 1):
                groups = match.groups()
                if len(groups) >= 5:
                    # Multi-line format: description, code, quantity, unit, price, total
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
                        product_code=groups[1].strip() if groups[1] else None,
                        quantity=quantity,
                        unit_of_measure=unit,
                        unit_price=extract_number(groups[4]) if len(groups) > 4 else 0,
                        line_total=extract_number(groups[5]) if len(groups) > 5 else 0,
                        line_number=match_no,
                    )
                    
                    if item.product_code:
                        items.append(item)
                        logger.debug(f"Extracted item: {item.product_code} - {item.description}")
            
            logger.info(f"Extracted {len(items)} items using multi-line pattern")
            return items
            
        except Exception as e:
            logger.error(f"Error with multi-line pattern: {e}")
            # Fall back to line-by-line
    
    # Single-line processing (original method)
    lines = text.strip().split('\n')
    logger.info(f"Processing {len(lines)} lines for items")
    
    for line_no, line in enumerate(lines, 1):
        line = line.strip()
        
        if not line or len(line) < 5:
            continue
        
        # Skip metadata/info lines that don't start with a product code
        # Examples: "BC GTIN...", "OVOCE A ZELENINA", section headers, etc.
        if re.match(r'^[A-Z]{2,}\s+(GTIN|Šarže)', line, re.IGNORECASE):
            logger.debug(f"Skipping metadata line: {line[:50]}")
            continue
        
        # Skip section headers (lines with only uppercase letters and spaces)
        if re.match(r'^[A-ZĚŠČŘŽÝÁÍÉÚŮĎŤŇĹ\s]+$', line) and len(line) < 50:
            logger.debug(f"Skipping header line: {line}")
            continue
        
        # Skip lines that don't start with a digit (product codes should be numeric)
        if not re.match(r'^\d', line):
            logger.debug(f"Skipping non-product line: {line[:50]}")
            continue
        
        # Try to extract item from line
        item = extract_item_from_line(line, table_columns, line_no)
        
        if item and item.product_code:
            items.append(item)
            logger.debug(f"Extracted item: {item.product_code} - {item.description}")
    
    logger.info(f"Extracted {len(items)} valid items")
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
        try:
            match = re.match(item_pattern, line)
            if match:
                groups = match.groups()
                logger.debug(f"Pattern matched with {len(groups)} groups: {groups}")
                
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
                    
                    logger.info(f"Extracting Zeelandia format - quantity: {quantity}, unit: {unit_of_measure}, package_weight: {package_weight}, total_weight: {total_weight}, unit_price: {unit_price}, total: {line_total}")
                    
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
                        package_weight_kg=package_weight if package_weight_unit == 'KG' else None,
                        total_weight_kg=total_weight if total_weight_unit == 'KG' else None,
                        vat_rate=vat_rate,
                        line_number=line_number,
                    )
                elif len(groups) >= 10:
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
    
    # Method 2: Smart whitespace splitting (default)
    # Split by multiple spaces (assumes columns are separated by 2+ spaces)
    parts = re.split(r'\s{2,}', line)
    
    if len(parts) < 2:
        # Try single space split for tightly packed data
        parts = line.split()
    
    if len(parts) < 2:
        return None
    
    # Try to identify product code (usually first numeric field or alphanumeric)
    product_code = None
    description = None
    quantity = 0
    unit_price = 0
    line_total = 0
    unit = None
    
    # Look for product code (numeric or alphanumeric at start)
    if re.match(r'^[\d\w-]+$', parts[0]):
        product_code = parts[0]
        remaining_parts = parts[1:]
    else:
        remaining_parts = parts
    
    # Extract numbers from remaining parts
    numbers = []
    text_parts = []
    
    for part in remaining_parts:
        # Check if it's a number
        cleaned = part.replace(',', '.').replace(' ', '')
        try:
            num = float(cleaned)
            numbers.append(num)
        except:
            # It's text
            if part.strip() and not re.match(r'^[.,\s]+$', part):
                text_parts.append(part)
    
    # Description is the text parts
    if text_parts:
        description = ' '.join(text_parts)
    
    # Assign numbers to fields (typically: quantity, unit_price, line_total)
    if len(numbers) >= 1:
        quantity = numbers[0]
    if len(numbers) >= 2:
        unit_price = numbers[1]
    if len(numbers) >= 3:
        line_total = numbers[2]
    elif len(numbers) == 2:
        # Calculate line total if not present
        line_total = quantity * unit_price
    
    # Only return if we have at least a product code or meaningful data
    if not product_code and not description:
        return None
    
    # Fix OCR issue: "t" unit is actually "lt" (l looks like 1)
    if unit == 't' and quantity > 10:
        # Last digit of quantity is actually "l" in unit
        quantity_str = str(int(quantity))
        if len(quantity_str) >= 2:
            quantity = float(quantity_str[:-1])  # Remove last digit
            unit = 'lt'  # Change t to lt
            logger.info(f"Fixed OCR: {quantity_str}t → {quantity} lt")
    
    # Validate that we have meaningful data
    if product_code and (quantity > 0 or unit_price > 0):
        # Apply code corrections if configured
        corrected_code = apply_code_corrections(product_code, code_corrections)
        
        # Apply description corrections if configured
        description_corrections = table_columns.get('description_corrections', {})
        corrected_description = apply_description_corrections(description, description_corrections) if description else None
        
        return InvoiceItem(
            product_code=corrected_code,
            description=corrected_description,
            quantity=quantity,
            unit_of_measure=unit,
            unit_price=unit_price,
            line_total=line_total,
            line_number=line_number,
        )
    
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

