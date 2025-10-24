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
        
        # Process first page (most invoices are single page or data is on first page)
        image = images[0]
        
        # Get OCR settings from template
        ocr_config = request.template_config.get('ocr_settings', {})
        dpi = ocr_config.get('dpi', 300)
        language = ocr_config.get('language', 'ces')
        psm = ocr_config.get('psm', 6)
        
        # Perform OCR
        custom_config = f'--oem 3 --psm {psm}'
        raw_text = pytesseract.image_to_string(image, lang=language, config=custom_config)
        
        logger.info(f"OCR completed, text length: {len(raw_text)}")
        
        # Extract data using template patterns
        patterns = request.template_config.get('patterns', {})
        
        invoice_number = extract_pattern(raw_text, patterns.get('invoice_number'))
        date = extract_pattern(raw_text, patterns.get('date'))
        supplier = extract_pattern(raw_text, patterns.get('supplier'))
        total_amount = extract_number(extract_pattern(raw_text, patterns.get('total_amount')))
        
        # Extract line items
        items = extract_line_items(
            raw_text,
            image,
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
            raw_text=raw_text if len(raw_text) < 5000 else raw_text[:5000] + "...",
        )
        
    except Exception as e:
        logger.error(f"Error processing invoice: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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
        end_match = re.search(table_end_pattern, raw_text, re.IGNORECASE | re.MULTILINE) if table_end_pattern else None
        
        if start_match:
            start_pos = start_match.end()
            end_pos = end_match.start() if end_match else len(raw_text)
            table_text = raw_text[start_pos:end_pos]
            
            logger.info(f"Extracted table section: {len(table_text)} characters")
            
            # Extract items from table text
            items = extract_items_from_text(table_text, table_columns)
    except Exception as e:
        logger.error(f"Error extracting table section: {e}")
    
    return items

def extract_items_from_text(text: str, table_columns: Dict) -> List[InvoiceItem]:
    """
    Extract items from table text using line-by-line parsing
    """
    items = []
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

