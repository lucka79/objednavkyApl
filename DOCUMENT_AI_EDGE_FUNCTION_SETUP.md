# Document AI Edge Function Setup

## Overview
The Document AI functionality has been moved from client-side to server-side processing using Supabase Edge Functions. This resolves the "process is not defined" error that occurred when trying to use Google Cloud libraries in the browser.

## Architecture
- **Client**: Sends file (as base64) to Edge Function
- **Edge Function**: Processes document using Google Cloud Document AI
- **Response**: Parsed invoice data returned to client

## Setup Steps

### 1. Install Supabase CLI
If you haven't already:
```bash
npm install -g supabase
```

### 2. Get Google Cloud Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (832370309522)
3. Navigate to **IAM & Admin** → **Service Accounts**
4. Find or create a service account with Document AI permissions
5. Create a JSON key for the service account
6. Download the JSON key file

### 3. Set Environment Variables

Create or update your `.env` file in the project root:

```bash
# Google Cloud credentials as a JSON string
GOOGLE_CLOUD_CREDENTIALS='{"type":"service_account","project_id":"832370309522",...}'
```

For Supabase, set the secret:

```bash
supabase secrets set GOOGLE_CLOUD_CREDENTIALS='{"type":"service_account","project_id":"832370309522",...}'
```

**Important**: Replace the `'...'` with your actual JSON key content. The entire JSON should be on one line or properly escaped.

### 4. Deploy the Edge Function

```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy process-document

# Verify deployment
supabase functions list
```

### 5. Test the Function

You can test locally before deploying:

```bash
# Start Supabase locally with the Edge Function
supabase functions serve process-document --env-file .env

# In another terminal, test with curl:
curl -i --location --request POST 'http://localhost:54321/functions/v1/process-document' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "fileData": "BASE64_ENCODED_FILE_DATA",
    "fileName": "test.pdf",
    "mimeType": "application/pdf",
    "supplierId": "pesek-rambousek"
  }'
```

## Processor Configuration

The Edge Function currently supports:

| Supplier ID | Processor ID | Type |
|------------|-------------|------|
| `pesek-rambousek` | `b5de41a4cf52cc70` | Invoice Parser |
| `default` | `b5de41a4cf52cc70` | Invoice Parser |

To add more processors, edit `supabase/functions/process-document/index.ts` and update the `getProcessorId()` function.

## Troubleshooting

### Error: "Invalid credentials"
- Verify that `GOOGLE_CLOUD_CREDENTIALS` is set correctly
- Make sure the service account has Document AI permissions
- Check that the JSON is properly formatted (no line breaks)

### Error: "Function not found"
- Verify deployment: `supabase functions list`
- Check project linking: `supabase projects list`
- Redeploy: `supabase functions deploy process-document`

### Error: "CORS error"
- The Edge Function includes CORS headers
- If issues persist, check your Supabase project settings

### Testing Locally
When testing locally, you need to:
1. Have Docker running (for Supabase local development)
2. Start local Supabase: `supabase start`
3. Serve the function: `supabase functions serve process-document --env-file .env`

## Client Usage

The client-side hook (`useDocumentAI`) automatically handles:
- Converting files to base64
- Calling the Edge Function
- Parsing responses
- Error handling with toast notifications

Example usage:
```typescript
import { useDocumentAI } from "@/hooks/useDocumentAI";

function MyComponent() {
  const { processDocument, isProcessing } = useDocumentAI();

  const handleFileUpload = async (file: File) => {
    const result = await processDocument(file, "pesek-rambousek");
    
    if (result.success) {
      console.log("Parsed data:", result.data);
    } else {
      console.error("Error:", result.error);
    }
  };

  return (
    <input 
      type="file" 
      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
      disabled={isProcessing}
    />
  );
}
```

## Security Notes

1. **Never commit credentials**: Keep `.env` files out of version control
2. **Use secrets management**: Store credentials in Supabase secrets, not in code
3. **Limit permissions**: Service account should have only Document AI access
4. **Rotate keys**: Regularly rotate service account keys

## Performance Considerations

- File size limit: Edge Functions have a payload limit (check Supabase docs)
- Processing time: Large PDFs may take 5-10 seconds
- Rate limits: Google Cloud Document AI has rate limits (check your quota)

## Cost Optimization

- Document AI pricing is per page processed
- Cache results when possible
- Consider implementing a queue for batch processing
- Monitor usage in Google Cloud Console

## Next Steps

After setup:
1. Test with sample invoices
2. Monitor Edge Function logs: `supabase functions logs process-document`
3. Update processor mappings as needed
4. Consider adding authentication checks in the Edge Function

