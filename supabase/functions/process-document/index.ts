import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { GoogleAuth } from "npm:google-auth-library@9.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessDocumentRequest {
  storagePath: string; // path in Supabase Storage
  fileName: string;
  mimeType: string;
  supplierId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Log raw request info
    console.log(`Request method: ${req.method}`);
    console.log(`Request URL: ${req.url}`);
    console.log(`Content-Type: ${req.headers.get("content-type")}`);
    
    // Get request body with better error handling
    const body = await req.text();
    console.log(`Request body length: ${body.length}`);
    
    if (!body || body.length === 0) {
      throw new Error("Request body is empty");
    }
    
    let parsedBody: ProcessDocumentRequest;
    try {
      parsedBody = JSON.parse(body);
    } catch (parseError) {
      console.error("Failed to parse JSON:", parseError);
      console.error("Body content:", body.substring(0, 500)); // Log first 500 chars
      throw new Error(`Invalid JSON in request body: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
    
    const { storagePath, fileName, mimeType, supplierId } = parsedBody;

    console.log(`Processing document: ${fileName} for supplier: ${supplierId}`);
    console.log(`Storage path: ${storagePath}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download file from storage
    console.log(`Downloading file from storage...`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file from storage: ${downloadError?.message || 'Unknown error'}`);
    }

    console.log(`File downloaded, size: ${fileData.size} bytes`);

    // Check if credentials are available
    const credentialsStr = Deno.env.get("GOOGLE_CLOUD_CREDENTIALS");
    if (!credentialsStr) {
      console.error("GOOGLE_CLOUD_CREDENTIALS not set!");
      throw new Error("Google Cloud credentials not configured. Please set GOOGLE_CLOUD_CREDENTIALS in Edge Function secrets.");
    }

    console.log("Credentials found, length:", credentialsStr.length);
    
    // Parse and validate credentials
    let credentials;
    try {
      credentials = JSON.parse(credentialsStr);
      console.log("Credentials parsed successfully");
      console.log("Project ID:", credentials.project_id);
      console.log("Client email:", credentials.client_email);
      console.log("Has private key:", !!credentials.private_key);
      console.log("Private key length:", credentials.private_key?.length || 0);
    } catch (err) {
      console.error("Failed to parse credentials:", err);
      throw new Error("Invalid Google Cloud credentials JSON");
    }

    console.log("Initializing Google Auth...");

    // Initialize Google Auth with credentials
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    
    console.log("Getting access token...");
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    
    if (!accessToken.token) {
      throw new Error("Failed to get access token");
    }
    
    console.log("Access token obtained");

    // Use project_id from credentials  
    const projectId = credentials.project_id;
    const location = "eu";
    const processorId = getProcessorId(supplierId);
    
    console.log(`Using project: ${projectId}, processor: ${processorId}`);

    console.log(`Converting file to bytes...`);
    // Convert blob to base64 (handle large files properly)
    const arrayBuffer = await fileData.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);
    
    // Convert to base64 in chunks to avoid stack overflow
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < fileBytes.length; i += chunkSize) {
      const chunk = fileBytes.slice(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64Content = btoa(binaryString);
    
    console.log(`File bytes length: ${fileBytes.length}`);

    // Create the request body
    const requestBody = {
      rawDocument: {
        content: base64Content,
        mimeType: mimeType,
      },
    };

    const apiUrl = `https://eu-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`;
    
    console.log(`Processing with processor: ${processorId} in region: ${location}`);
    console.log(`API URL: ${apiUrl}`);
    console.log(`Calling Document AI API via REST...`);

    // Call Document AI REST API with timeout
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Document processing timeout after 60 seconds")), 60000)
    );
    
    const processingPromise = fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    const response = await Promise.race([processingPromise, timeout]) as Response;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error: ${response.status} - ${errorText}`);
      throw new Error(`Document AI API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();

    console.log(`Document AI API call completed`);

    // Parse the response
    console.log(`Parsing response...`);
    const parsedData = await parseDocumentResponse(result, supplierId, supabase);

    console.log(`Processing complete. Items found: ${parsedData.items?.length || 0}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: parsedData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing document:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        details: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Get processor ID based on supplier
 */
function getProcessorId(supplierId: string): string {
  if (supplierId === "pesek-rambousek") {
    return "b5de41a4cf52cc70";
  }
  
  // Default to bakery parser
  return "b5de41a4cf52cc70";
}

/**
 * Parse Document AI response based on processor type
 */
async function parseDocumentResponse(result: any, supplierId: string, supabase: any) {
  const document = result.document;
  
  if (supplierId === "pesek-rambousek") {
    return parseBakeryAplicaResponse(document, supplierId, supabase);
  } else {
    return parseDefaultInvoiceResponse(document, supplierId, supabase);
  }
}

/**
 * Parse response from bakery_aplica_parser
 */
async function parseBakeryAplicaResponse(document: any, supplierId: string, supabase: any) {
  console.log("Parsing bakery_aplica_parser response");
  
  const entities = document.entities || [];
  
  // Find specific entities
  const supplier = findEntity(entities, "supplier_name") || 
                  findEntity(entities, "vendor_name") || 
                  findEntity(entities, "company_name") || 
                  "Pešek - Rambousek";
  
  const invoiceNumber = findEntity(entities, "invoice_number") || 
                       findEntity(entities, "document_number") || 
                       findEntity(entities, "invoice_id") || 
                       "";
  
  const date = findEntity(entities, "invoice_date") || 
               findEntity(entities, "document_date") || 
               findEntity(entities, "date") || 
               new Date().toISOString().split("T")[0];
  
  const totalAmount = parseFloat(findEntity(entities, "total_amount") || 
                                findEntity(entities, "net_amount") || 
                                findEntity(entities, "grand_total") || 
                                "0");
  
  // Extract line items with ingredient matching
  const items = await extractLineItems(entities, supabase, supplierId);
  
  // Calculate overall confidence
  const confidence = calculateOverallConfidence(entities);

  console.log("Parsed result:", { supplier, invoiceNumber, date, totalAmount, itemsCount: items.length });

  return {
    supplier,
    invoiceNumber,
    date,
    totalAmount,
    confidence,
    items,
  };
}

/**
 * Parse response from default invoice parser
 */
async function parseDefaultInvoiceResponse(document: any, supplierId: string, supabase: any) {
  const entities = document.entities || [];
  
  const supplier = findEntity(entities, "supplier_name") || "Unknown Supplier";
  const invoiceNumber = findEntity(entities, "invoice_number") || "";
  const date = findEntity(entities, "invoice_date") || new Date().toISOString().split("T")[0];
  const totalAmount = parseFloat(findEntity(entities, "total_amount") || "0");
  
  const items = await extractLineItems(entities, supabase, supplierId);
  const confidence = calculateOverallConfidence(entities);

  return {
    supplier,
    invoiceNumber,
    date,
    totalAmount,
    confidence,
    items,
  };
}

/**
 * Find entity by type
 */
function findEntity(entities: any[], type: string): string | null {
  const entity = entities.find((e: any) => e.type === type);
  return entity?.mentionText || null;
}

/**
 * Extract line items from entities with ingredient matching
 */
async function extractLineItems(entities: any[], supabase: any, supplierId: string) {
  const lineItems: any[] = [];
  
  console.log(`Extracting line items from ${entities.length} entities`);
  
  // Log all entity types to see what's available
  const entityTypes = entities.map((e: any) => e.type).filter(Boolean);
  console.log(`All entity types found:`, JSON.stringify([...new Set(entityTypes)]));
  
  // Find all line_item entities
  const lineItemEntities = entities.filter((e: any) => e.type === 'line_item');
  
  console.log(`Found ${lineItemEntities.length} line item entities`);
  
  // Process each line item
  for (const lineItemEntity of lineItemEntities) {
    console.log(`Processing line item entity:`, JSON.stringify(lineItemEntity, null, 2).substring(0, 500));
    
    // Line items have properties with sub-entities
    const properties = lineItemEntity.properties || [];
    console.log(`Line item has ${properties.length} properties`);
    
    // Extract fields from properties
    let productCode = null;
    let quantity = null;
    let unitPrice = null;
    let lineTotal = null;
    let unit = null;
    let confidenceSum = 0;
    let confidenceCount = 0;
    
    for (const prop of properties) {
      const propType = prop.type || '';
      const propValue = prop.mentionText || '';
      const propConfidence = prop.confidence || 0;
      
      console.log(`Property: ${propType} = ${propValue}`);
      
      if (propType.includes('product_code') || propType.includes('code')) {
        productCode = propValue;
        confidenceSum += propConfidence;
        confidenceCount++;
      } else if (propType.includes('quantity') || propType.includes('qty')) {
        quantity = parseFloat(propValue) || 0;
        confidenceSum += propConfidence;
        confidenceCount++;
      } else if (propType.includes('unit_price') || propType.includes('price')) {
        unitPrice = parseFloat(propValue) || 0;
        confidenceSum += propConfidence;
        confidenceCount++;
      } else if (propType.includes('line_total') || propType.includes('total')) {
        lineTotal = parseFloat(propValue) || 0;
      } else if (propType.includes('unit')) {
        unit = propValue;
      }
    }
    
    console.log(`Extracted - Code: ${productCode}, Qty: ${quantity}, Price: ${unitPrice}`);
    
    if (!productCode || !quantity || quantity <= 0) {
      console.log(`Skipping item - missing code or invalid quantity`);
      continue;
    }
    
    // Calculate line total if not provided
    if (!lineTotal && unitPrice) {
      lineTotal = quantity * unitPrice;
    }
    
    // Look up ingredient by product_code
    let matchedIngredient = null;
    try {
      const { data, error } = await supabase
        .from('ingredient_supplier_codes')
        .select(`
          ingredient_id,
          ingredients!inner(id, name, unit)
        `)
        .eq('product_code', productCode)
        .eq('supplier_id', supplierId)
        .eq('is_active', true)
        .single();
      
      if (data && !error) {
        matchedIngredient = {
          id: data.ingredients.id,
          name: data.ingredients.name,
          unit: data.ingredients.unit
        };
        console.log(`Matched ingredient: ${matchedIngredient.name} (ID: ${matchedIngredient.id})`);
      } else {
        console.log(`No ingredient found for code: ${productCode}`);
      }
    } catch (err) {
      console.error(`Error matching ingredient for code ${productCode}:`, err);
    }
    
    lineItems.push({
      product_code: productCode,
      quantity,
      unit_price: unitPrice || 0,
      line_total: lineTotal || 0,
      unit_of_measure: unit || '',
      matched_ingredient_id: matchedIngredient?.id || null,
      matched_ingredient_name: matchedIngredient?.name || null,
      matching_confidence: confidenceCount > 0 ? confidenceSum / confidenceCount : 0,
    });
  }
  
  console.log(`Extracted ${lineItems.length} valid line items`);
  
  return lineItems;
}

/**
 * Group entities by line item
 */
function groupEntitiesByLineItem(entities: any[]): any[][] {
  const groups: any[][] = [];
  let currentGroup: any[] = [];
  
  entities.forEach((entity) => {
    if (entity.type === "item_name" && currentGroup.length > 0) {
      groups.push(currentGroup);
      currentGroup = [];
    }
    currentGroup.push(entity);
  });
  
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  
  return groups;
}

/**
 * Calculate confidence for a group of entities
 */
function calculateEntityConfidence(entities: any[]): number {
  if (entities.length === 0) return 0;
  
  const totalConfidence = entities.reduce((sum: number, entity: any) => {
    return sum + (entity.confidence || 0);
  }, 0);
  
  return totalConfidence / entities.length;
}

/**
 * Calculate overall confidence for the document
 */
function calculateOverallConfidence(entities: any[]): number {
  if (entities.length === 0) return 0;
  
  const totalConfidence = entities.reduce((sum: number, entity: any) => {
    return sum + (entity.confidence || 0);
  }, 0);
  
  return totalConfidence / entities.length;
}

