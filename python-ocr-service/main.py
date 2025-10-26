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

class ProcessInvoiceResponse(BaseModel):
    invoice_number: Optional[str] = None
    date: Optional[str] = None
    supplier: Optional[str] = None
    total_amount: float = 0
    items: List[InvoiceItem] = []
    confidence: float = 0
    raw_text: Optional[str] = None

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
        
        # Extract line items (use cleaned text for seamless multi-page extraction)
        items = extract_line_items(
            raw_text_display,
            images[0],
            request.template_config,
            language,
            psm
        )
        
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
            items=items,
            confidence=confidence,
            raw_text=raw_text_display if len(raw_text_display) < 20000 else raw_text_display[:20000] + "\n\n... (text truncated for display)",
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
        
        # Try to extract item from line
        item = extract_item_from_line(line, table_columns, line_no)
        
        if item and item.product_code:
            items.append(item)
            logger.debug(f"Extracted item: {item.product_code} - {item.description}")
    
    logger.info(f"Extracted {len(items)} valid items")
    return items

def extract_item_from_line(line: str, table_columns: Dict, line_number: int) -> Optional[InvoiceItem]:
    """
    Extract single item from a line of text
    Uses configurable patterns or whitespace splitting
    """
    
    # Method 1: Use regex patterns if configured
    item_pattern = table_columns.get('line_pattern')
    if item_pattern:
        try:
            match = re.match(item_pattern, line)
            if match:
                groups = match.groups()
                return InvoiceItem(
                    product_code=groups[0] if len(groups) > 0 else None,
                    description=groups[1] if len(groups) > 1 else None,
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
        return InvoiceItem(
            product_code=product_code,
            description=description,
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

