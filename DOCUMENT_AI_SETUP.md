# Google Document AI Integration Setup

This guide explains how to set up Google Document AI integration for the bakery invoice processing system.

## Prerequisites

1. **Google Cloud Project** with Document AI API enabled
2. **Service Account** with Document AI permissions
3. **Trained Processors** for invoice parsing

## Environment Variables

Add these environment variables to your `.env.local` file:

```bash
# Google Cloud Document AI Configuration (EU Region)
GOOGLE_CLOUD_PROJECT_ID=832370309522
GOOGLE_CLOUD_LOCATION=eu
BAKERY_APLICA_PARSER_ID=b5de41a4cf52cc70
DEFAULT_INVOICE_PARSER_ID=default_invoice_parser

# Google Cloud Service Account Key (base64 encoded)
GOOGLE_APPLICATION_CREDENTIALS_JSON=your-service-account-json-base64
```

## Google Cloud Setup

### 1. Enable Document AI API

```bash
gcloud services enable documentai.googleapis.com
```

### 2. Create Service Account

```bash
gcloud iam service-accounts create document-ai-service \
    --display-name="Document AI Service Account"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:document-ai-service@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/documentai.apiUser"
```

### 3. Create and Download Service Account Key

```bash
gcloud iam service-accounts keys create document-ai-key.json \
    --iam-account=document-ai-service@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### 4. Encode Service Account Key

```bash
# Convert to base64 for environment variable
base64 -i document-ai-key.json
```

## Document AI Processors

### 1. Bakery Aplica Parser

Create a specialized processor for Pešek - Rambousek invoices:

```bash
# Create processor
gcloud documentai processors create \
    --location=us \
    --display-name="Bakery Aplica Parser" \
    --type=INVOICE_PROCESSOR \
    --processor-version=pretrained-invoice-v1.3-2022-09-12
```

### 2. Default Invoice Parser

Create a general invoice processor for other suppliers:

```bash
# Create processor
gcloud documentai processors create \
    --location=us \
    --display-name="Default Invoice Parser" \
    --type=INVOICE_PROCESSOR \
    --processor-version=pretrained-invoice-v1.3-2022-09-12
```

## Training Custom Parser (Optional)

For better accuracy with Pešek - Rambousek invoices, you can train a custom parser:

### 1. Prepare Training Data

- Collect 10-20 sample invoices from Pešek - Rambousek
- Annotate key fields: supplier name, invoice number, date, line items, totals
- Export annotations in Document AI format

### 2. Create Custom Processor

```bash
# Create custom processor
gcloud documentai processors create \
    --location=us \
    --display-name="Bakery Aplica Custom Parser" \
    --type=CUSTOM_PROCESSOR
```

### 3. Train the Processor

```bash
# Import training data
gcloud documentai processors import-processor-version \
    --processor=projects/YOUR_PROJECT_ID/locations/us/processors/YOUR_PROCESSOR_ID \
    --processor-version-source=gs://your-bucket/training-data.json
```

## API Integration

The system uses the following components:

### 1. Document AI Service (`src/lib/documentAI.ts`)
- Handles Google Cloud Document AI API calls
- Processes different invoice formats
- Extracts structured data from invoices

### 2. API Endpoint (`src/api/document-ai/process.ts`)
- Receives file uploads
- Validates file types and sizes
- Calls Document AI service
- Returns parsed invoice data

### 3. React Hook (`src/hooks/useDocumentAI.ts`)
- Provides easy integration with React components
- Handles loading states and error handling
- Manages file upload and processing

## Usage

### Basic Usage

```typescript
import { useDocumentAI } from '@/hooks/useDocumentAI';

function InvoiceUpload() {
  const { processDocument, isProcessing } = useDocumentAI();

  const handleUpload = async (file: File, supplierId: string) => {
    const result = await processDocument(file, supplierId);
    
    if (result.success) {
      console.log('Parsed invoice:', result.data);
    }
  };
}
```

### Supplier-Specific Processing

```typescript
// For Pešek - Rambousek invoices
const result = await processDocument(file, 'pesek-rambousek');

// For other suppliers
const result = await processDocument(file, 'other-supplier');
```

## Error Handling

The system includes comprehensive error handling:

- **File validation**: Type and size checks
- **API errors**: Network and processing errors
- **Parsing errors**: Invalid or unreadable documents
- **User feedback**: Toast notifications for all error states

## Testing

### 1. Test with Sample Invoices

Upload sample invoices to test the integration:

```bash
# Test API endpoint
curl -X POST http://localhost:3000/api/document-ai/process \
  -F "file=@sample-invoice.pdf" \
  -F "supplierId=pesek-rambousek"
```

### 2. Monitor Processing

Check Google Cloud Console for:
- API usage and quotas
- Processing errors and logs
- Processor performance metrics

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify service account key is correct
   - Check IAM permissions
   - Ensure Document AI API is enabled

2. **Processor Not Found**
   - Verify processor IDs in environment variables
   - Check processor exists in Google Cloud Console
   - Ensure correct project and location

3. **File Processing Errors**
   - Check file format (PDF, JPG, PNG only)
   - Verify file size (max 10MB)
   - Ensure document is readable and not corrupted

### Debug Mode

Enable debug logging by setting:

```bash
NODE_ENV=development
DEBUG=document-ai:*
```

## Performance Optimization

### 1. Caching
- Cache processor configurations
- Store frequently used entity types
- Implement response caching for similar documents

### 2. Batch Processing
- Process multiple documents in parallel
- Use async/await for better performance
- Implement queue system for high volume

### 3. Error Recovery
- Retry failed requests with exponential backoff
- Implement fallback to mock data for testing
- Log errors for analysis and improvement

## Security Considerations

### 1. File Security
- Validate file types and sizes
- Scan for malicious content
- Store files securely during processing

### 2. API Security
- Rate limiting for API endpoints
- Authentication for sensitive operations
- Audit logging for compliance

### 3. Data Privacy
- Process documents in secure environment
- Don't store sensitive invoice data
- Implement data retention policies
