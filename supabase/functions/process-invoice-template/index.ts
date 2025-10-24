import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessRequest {
  storagePath: string;
  fileName: string;
  supplierId: string;
  templateId?: string; // Optional: specific template to use
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as ProcessRequest;
    const { storagePath, fileName, supplierId, templateId } = body;

    console.log(`Processing invoice: ${fileName} for supplier: ${supplierId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get active template for supplier
    const template = await getTemplate(supabase, supplierId, templateId);
    
    if (!template) {
      throw new Error(`No active template found for supplier: ${supplierId}`);
    }

    console.log(`Using template: ${template.template_name} (v${template.version})`);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    console.log(`File downloaded: ${fileData.size} bytes`);

    // Convert to base64 for Python service
    const arrayBuffer = await fileData.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);
    const base64File = btoa(String.fromCharCode(...fileBytes));

    // Call Python OCR service
    const pythonServiceUrl = Deno.env.get("PYTHON_OCR_SERVICE_URL") || "http://localhost:8000";
    
    console.log(`Calling OCR service: ${pythonServiceUrl}`);
    
    const ocrResponse = await fetch(`${pythonServiceUrl}/process-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_base64: base64File,
        file_name: fileName,
        template_config: template.config,
      }),
    });

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      throw new Error(`OCR service error: ${ocrResponse.status} - ${errorText}`);
    }

    const ocrResult = await ocrResponse.json();
    console.log(`OCR extracted ${ocrResult.items?.length || 0} items`);

    // Match product codes with ingredients
    const matchedItems = await matchIngredientsWithCodes(
      supabase,
      ocrResult.items || [],
      supplierId
    );

    // Track unmapped codes
    await trackUnmappedCodes(supabase, matchedItems, supplierId);

    // Save test result for template improvement
    await saveTemplateTestResult(supabase, template.id, {
      ...ocrResult,
      items: matchedItems,
    });

    const result = {
      success: true,
      data: {
        supplier: ocrResult.supplier || supplierId,
        invoiceNumber: ocrResult.invoice_number || '',
        date: ocrResult.date || new Date().toISOString().split('T')[0],
        totalAmount: ocrResult.total_amount || 0,
        items: matchedItems,
        confidence: ocrResult.confidence || 0,
        template_used: template.template_name,
        unmapped_codes: matchedItems.filter((item: any) => !item.matched_ingredient_id).length,
      },
    };

    console.log(`Processing complete: ${matchedItems.length} items, ${result.data.unmapped_codes} unmapped`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error processing invoice:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Get template for supplier
 */
async function getTemplate(supabase: any, supplierId: string, templateId?: string) {
  if (templateId) {
    const { data, error } = await supabase
      .from('invoice_templates')
      .select('*')
      .eq('id', templateId)
      .single();
    
    if (error) {
      console.error('Error fetching template by ID:', error);
      return null;
    }
    
    return data;
  }

  // Get most recently used active template
  const { data, error } = await supabase
    .from('invoice_templates')
    .select('*')
    .eq('supplier_id', supplierId)
    .eq('is_active', true)
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching template:', error);
    return null;
  }

  return data;
}

/**
 * Match extracted items with ingredients in database
 */
async function matchIngredientsWithCodes(
  supabase: any,
  items: any[],
  supplierId: string
) {
  const matchedItems = [];

  for (const item of items) {
    const productCode = item.product_code?.trim();
    
    if (!productCode) {
      matchedItems.push({ ...item, match_status: 'no_code' });
      continue;
    }

    // Try exact match first
    let { data: match, error } = await supabase
      .from('ingredient_supplier_codes')
      .select(`
        ingredient_id,
        supplier_ingredient_name,
        ingredients!inner(id, name, unit, category)
      `)
      .eq('product_code', productCode)
      .eq('supplier_id', supplierId)
      .eq('is_active', true)
      .maybeSingle();

    if (match) {
      matchedItems.push({
        ...item,
        matched_ingredient_id: match.ingredients.id,
        matched_ingredient_name: match.ingredients.name,
        matched_ingredient_unit: match.ingredients.unit,
        matched_ingredient_category: match.ingredients.category,
        match_status: 'exact',
        match_confidence: 1.0,
      });
      continue;
    }

    // Try fuzzy matching (remove leading zeros, spaces, etc.)
    const codeVariations = generateCodeVariations(productCode);
    let fuzzyMatch = null;

    for (const variation of codeVariations) {
      const { data, error } = await supabase
        .from('ingredient_supplier_codes')
        .select(`
          ingredient_id,
          product_code,
          supplier_ingredient_name,
          ingredients!inner(id, name, unit, category)
        `)
        .eq('supplier_id', supplierId)
        .eq('is_active', true)
        .ilike('product_code', `%${variation}%`)
        .limit(1)
        .maybeSingle();

      if (data) {
        fuzzyMatch = data;
        break;
      }
    }

    if (fuzzyMatch) {
      matchedItems.push({
        ...item,
        matched_ingredient_id: fuzzyMatch.ingredients.id,
        matched_ingredient_name: fuzzyMatch.ingredients.name,
        matched_ingredient_unit: fuzzyMatch.ingredients.unit,
        matched_ingredient_category: fuzzyMatch.ingredients.category,
        match_status: 'fuzzy',
        match_confidence: 0.7,
      });
      continue;
    }

    // No match found - suggest based on description
    const suggestion = await suggestIngredient(supabase, item.description);
    
    matchedItems.push({
      ...item,
      matched_ingredient_id: null,
      suggested_ingredient_id: suggestion?.id || null,
      suggested_ingredient_name: suggestion?.name || null,
      match_status: 'unmapped',
      match_confidence: suggestion ? 0.5 : 0,
    });
  }

  return matchedItems;
}

/**
 * Generate code variations for fuzzy matching
 */
function generateCodeVariations(code: string): string[] {
  const variations = new Set<string>();
  
  // Original
  variations.add(code);
  
  // Remove leading zeros
  variations.add(code.replace(/^0+/, ''));
  
  // Remove spaces and dashes
  variations.add(code.replace(/[\s-]/g, ''));
  
  // Fix common OCR errors
  const ocrFixes = code
    .replace(/O/g, '0')
    .replace(/o/g, '0')
    .replace(/I/g, '1')
    .replace(/l/g, '1')
    .replace(/S/g, '5')
    .replace(/s/g, '5')
    .replace(/Z/g, '2')
    .replace(/B/g, '8');
  
  variations.add(ocrFixes);
  
  return Array.from(variations);
}

/**
 * Suggest ingredient based on description
 */
async function suggestIngredient(supabase: any, description: string) {
  if (!description || description.length < 3) {
    return null;
  }

  // Search ingredients by name similarity
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, name, unit, category')
    .or(`name.ilike.%${description}%`)
    .limit(1)
    .maybeSingle();

  return data;
}

/**
 * Track unmapped codes for manual mapping
 */
async function trackUnmappedCodes(supabase: any, items: any[], supplierId: string) {
  const unmappedItems = items.filter(item => item.match_status === 'unmapped');

  for (const item of unmappedItems) {
    const { error } = await supabase
      .from('unmapped_product_codes')
      .upsert({
        supplier_id: supplierId,
        product_code: item.product_code,
        description: item.description,
        unit_of_measure: item.unit_of_measure,
        last_seen_price: item.unit_price,
        last_seen_quantity: item.quantity,
        suggested_ingredient_id: item.suggested_ingredient_id,
        suggestion_confidence: item.match_confidence,
        last_seen_at: new Date().toISOString(),
      }, {
        onConflict: 'supplier_id,product_code',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('Error tracking unmapped code:', error);
    }
  }
}

/**
 * Save template test result
 */
async function saveTemplateTestResult(supabase: any, templateId: string, result: any) {
  const totalItems = result.items?.length || 0;
  const matchedItems = result.items?.filter((item: any) => item.matched_ingredient_id).length || 0;
  const confidence = totalItems > 0 ? (matchedItems / totalItems) * 100 : 0;

  const { error } = await supabase
    .from('invoice_template_tests')
    .insert({
      template_id: templateId,
      test_file_path: 'runtime_test',
      extracted_data: result,
      success: totalItems > 0,
      confidence_score: confidence,
    });

  if (error) {
    console.error('Error saving template test result:', error);
  }
}

