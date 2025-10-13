# Document AI "process is not defined" Fix

## Problem
The application was trying to use `@google-cloud/documentai` library directly in the browser, causing the error:
```
ReferenceError: process is not defined
```

This occurred because Google Cloud libraries are designed for Node.js server environments and rely on the `process` global object which doesn't exist in browsers.

## Solution
Moved Document AI processing from client-side to server-side using Supabase Edge Functions.

## Changes Made

### 1. Created Edge Function
**File**: `supabase/functions/process-document/index.ts`
- Server-side function that handles Document AI processing
- Accepts base64-encoded files from the client
- Processes documents using Google Cloud Document AI
- Returns parsed invoice data

### 2. Updated Client Hook
**File**: `src/hooks/useDocumentAI.ts`
- Removed direct Document AI library usage
- Now calls the Edge Function instead
- Converts files to base64 before sending
- Maintains the same API for components

### 3. Removed Unused Dependencies
**File**: `package.json`
- Removed `@google-cloud/documentai` from client-side dependencies
- This library is now only used in the Edge Function (via Deno's npm: import)

### 4. Deleted Old Implementation
**File**: `src/lib/documentAI.ts` (deleted)
- Old client-side implementation removed
- All logic moved to Edge Function

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Google Cloud Credentials
Get your service account JSON key from Google Cloud Console and set it as an environment variable:

```bash
# For local development, create .env file:
echo 'GOOGLE_CLOUD_CREDENTIALS={"type":"service_account",...}' > .env

# For production, set Supabase secret:
supabase secrets set GOOGLE_CLOUD_CREDENTIALS='{"type":"service_account",...}'
```

### 3. Deploy the Edge Function
```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy
supabase functions deploy process-document
```

### 4. Test
The application should now work without the "process is not defined" error. Test by:
1. Going to the Document AI Debug page
2. Selecting a test invoice file
3. Clicking "Test Parser"
4. Verify the document is processed successfully

## Testing Locally

To test the Edge Function locally before deploying:

```bash
# Start Supabase local environment
supabase start

# Serve the Edge Function
supabase functions serve process-document --env-file .env

# In another terminal, run your React app
npm run dev
```

## Monitoring

After deployment, monitor the Edge Function:

```bash
# View logs
supabase functions logs process-document --tail

# Check function status
supabase functions list
```

## Documentation
- Full setup guide: `DOCUMENT_AI_EDGE_FUNCTION_SETUP.md`
- Original Document AI setup: `DOCUMENT_AI_SETUP.md`

## Benefits of This Approach

1. **Security**: Google Cloud credentials stay on the server
2. **Reliability**: No browser compatibility issues
3. **Performance**: Processing happens on server infrastructure
4. **Scalability**: Supabase Edge Functions can handle concurrent requests
5. **Maintainability**: Easier to update and monitor server-side code

## Troubleshooting

### Error: "Function not found"
Deploy the Edge Function: `supabase functions deploy process-document`

### Error: "Invalid credentials"
Verify `GOOGLE_CLOUD_CREDENTIALS` secret is set correctly in Supabase

### Error: "Failed to process document"
Check Edge Function logs: `supabase functions logs process-document`

## Next Steps

1. Deploy the Edge Function to production
2. Test with real invoice files
3. Monitor processing performance
4. Consider adding:
   - Authentication checks in the Edge Function
   - Rate limiting
   - Result caching
   - Batch processing support

