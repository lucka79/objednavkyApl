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
    console.log(`Template patterns:`, {
      invoice_number: template.config?.patterns?.invoice_number ? 'present' : 'missing',
      date: template.config?.patterns?.date ? 'present' : 'missing',
      supplier: template.config?.patterns?.supplier ? 'present' : 'missing',
      total_amount: template.config?.patterns?.total_amount ? 'present' : 'missing',
      payment_type: template.config?.patterns?.payment_type ? `present: "${template.config.patterns.payment_type}"` : 'missing',
    });

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    console.log(`File downloaded: ${fileData.size} bytes`);

    // Convert to base64 for Python service (in chunks to avoid stack overflow)
    const arrayBuffer = await fileData.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);
    
    // Convert in chunks to avoid "Maximum call stack size exceeded"
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < fileBytes.length; i += chunkSize) {
      const chunk = fileBytes.slice(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64File = btoa(binaryString);

    // Call Python OCR service
    const pythonServiceUrl = Deno.env.get("PYTHON_OCR_SERVICE_URL") || "http://localhost:8000";
    
    console.log(`Calling OCR service: ${pythonServiceUrl}`);
    console.log(`Template config for OCR:`, {
      has_line_pattern: !!template.config?.table_columns?.line_pattern,
      line_pattern_length: template.config?.table_columns?.line_pattern?.length || 0,
      line_pattern_sample: template.config?.table_columns?.line_pattern?.substring(0, 100) || 'none',
    });
    
    // Add timeout handling for fetch request (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    let ocrResponse;
    try {
      ocrResponse = await fetch(`${pythonServiceUrl}/process-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_base64: base64File,
          file_name: fileName,
          template_config: template.config,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error(`OCR service timeout after 30 seconds. Service may be overloaded or unresponsive.`);
      }
      throw new Error(`Failed to call OCR service: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
    }

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      console.error(`OCR service returned error ${ocrResponse.status}:`, errorText);
      throw new Error(`OCR service error: ${ocrResponse.status} - ${errorText}`);
    }

    let ocrResult;
    try {
      const responseText = await ocrResponse.text();
      console.log(`OCR response length: ${responseText.length} characters`);
      ocrResult = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse OCR response:", parseError);
      throw new Error(`Failed to parse OCR service response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
    console.log(`OCR extracted ${ocrResult.items?.length || 0} items`);
    console.log(`OCR result keys:`, Object.keys(ocrResult));
    console.log(`Payment type from OCR:`, {
      'payment_type': ocrResult.payment_type,
      'type': typeof ocrResult.payment_type,
      'isNull': ocrResult.payment_type === null,
      'isUndefined': ocrResult.payment_type === undefined,
      'isEmpty': ocrResult.payment_type === '',
      'value': JSON.stringify(ocrResult.payment_type)
    });
    
    // Log full OCR result structure for debugging
    if (!ocrResult.payment_type || ocrResult.payment_type === '') {
      console.warn(`⚠️ Payment type not found in OCR result. Available fields:`, Object.keys(ocrResult));
      console.warn(`⚠️ Full OCR result sample:`, {
        invoice_number: ocrResult.invoice_number,
        date: ocrResult.date,
        supplier: ocrResult.supplier,
        total_amount: ocrResult.total_amount,
        payment_type: ocrResult.payment_type,
        items_count: ocrResult.items?.length || 0,
      });
    }

    // Log OCR extracted items
    console.log(`\n=== OCR EXTRACTION RESULTS ===`);
    console.log(`Extracted ${ocrResult.items?.length || 0} items from OCR`);
    ocrResult.items?.forEach((item: any, idx: number) => {
      console.log(`\nOCR Item ${idx + 1}:`);
      console.log(`  product_code: ${item.product_code || 'null'}`);
      console.log(`  description: ${item.description || 'null'}`);
      console.log(`  quantity: ${item.quantity}`);
      console.log(`  unit_price: ${item.unit_price}`);
      console.log(`  line_total: ${item.line_total}`);
    });
    console.log(`\n=== END OCR RESULTS ===\n`);

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

    // Handle payment_type - check both snake_case and camelCase
    // Python service may return None which becomes null in JSON, or empty string
    let paymentType = '';
    
    if (ocrResult.payment_type !== null && ocrResult.payment_type !== undefined && ocrResult.payment_type !== '') {
      paymentType = String(ocrResult.payment_type).trim();
    } else if (ocrResult.paymentType !== null && ocrResult.paymentType !== undefined && ocrResult.paymentType !== '') {
      paymentType = String(ocrResult.paymentType).trim();
    }
    
    console.log(`Final payment_type processing:`, {
      'input_payment_type': ocrResult.payment_type,
      'input_paymentType': ocrResult.paymentType,
      'final_payment_type': paymentType,
      'isEmpty': paymentType === '',
    });

    const result = {
      success: true,
      data: {
        supplier: ocrResult.supplier || supplierId,
        invoiceNumber: ocrResult.invoice_number || '',
        date: ocrResult.date || new Date().toISOString().split('T')[0],
        totalAmount: ocrResult.total_amount || 0,
        payment_type: paymentType,
        items: matchedItems,
        confidence: ocrResult.confidence || 0,
        template_used: template.template_name,
        unmapped_codes: matchedItems.filter((item: any) => !item.matched_ingredient_id).length,
        raw_text: ocrResult.raw_text || '', // Include raw OCR text for debugging
        qr_codes: ocrResult.qr_codes || [], // Include QR codes detected from all pages
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
  console.log(`\n=== Starting ingredient matching for supplier: ${supplierId} ===`);
  console.log(`Total items to match: ${items.length}`);
  
  const matchedItems = [];

  for (const item of items) {
    const productCode = item.product_code?.trim();
    const description = item.description?.trim();
    
    // For items without product_code (e.g., Albert retail), try matching by description
    if (!productCode) {
      if (!description) {
        matchedItems.push({ ...item, match_status: 'no_code' });
        continue;
      }

      console.log(`\nNo product code - trying to match by description: "${description}"`);
      
      // Try to match by description (Albert stores description as product_code)
      let { data: match, error } = await supabase
        .from('ingredient_supplier_codes')
        .select(`
          ingredient_id,
          product_code,
          supplier_ingredient_name,
          ingredients!inner(id, name, unit, category_id)
        `)
        .ilike('product_code', description)
        .eq('supplier_id', supplierId)
        .maybeSingle();

      if (error) {
        console.error(`Error searching by description "${description}":`, error);
      }

      if (match) {
        console.log(`✓ Match found by description: ${match.ingredients.name}`);
        matchedItems.push({
          ...item,
          matched_ingredient_id: match.ingredients.id,
          matched_ingredient_name: match.ingredients.name,
          matched_ingredient_unit: match.ingredients.unit,
          matched_ingredient_category: match.ingredients.category_id,
          match_status: 'exact',
          match_confidence: 1.0,
        });
        continue;
      } else {
        console.log(`✗ No match found for description: "${description}"`);
        matchedItems.push({ ...item, match_status: 'no_code' });
        continue;
      }
    }

    // Try exact match first (case-insensitive, trimmed)
    const trimmedCode = productCode.trim();
    console.log(`\nSearching for code: "${trimmedCode}" (original: "${productCode}", length: ${trimmedCode.length})`);
    
    let { data: match, error } = await supabase
      .from('ingredient_supplier_codes')
      .select(`
        ingredient_id,
        product_code,
        supplier_ingredient_name,
        ingredients!inner(id, name, unit, category_id)
      `)
      .ilike('product_code', trimmedCode)
      .eq('supplier_id', supplierId)
      .maybeSingle();

    if (error) {
      console.error(`Error searching for code "${productCode}":`, error);
    }

    if (match) {
      console.log(`✓ Exact match found for "${trimmedCode}": ${match.ingredients.name} (DB code: "${match.product_code}")`);
      matchedItems.push({
        ...item,
        matched_ingredient_id: match.ingredients.id,
        matched_ingredient_name: match.ingredients.name,
        matched_ingredient_unit: match.ingredients.unit,
        matched_ingredient_category: match.ingredients.category_id,
        match_status: 'exact',
        match_confidence: 1.0,
      });
      continue;
    } else {
      console.log(`✗ No exact match for "${trimmedCode}" (supplier: ${supplierId})`);
      
      // Debug: Show some existing codes for this supplier
      const { data: existingCodes } = await supabase
        .from('ingredient_supplier_codes')
        .select('product_code')
        .eq('supplier_id', supplierId)
        .limit(10);
      
      if (existingCodes && existingCodes.length > 0) {
        console.log(`  Available codes for this supplier (first 10): ${existingCodes.map((c: any) => `"${c.product_code}"`).join(', ')}`);
      } else {
        console.log(`  No codes found in database for supplier: ${supplierId}`);
      }
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
          ingredients!inner(id, name, unit, category_id)
        `)
        .eq('supplier_id', supplierId)
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
        matched_ingredient_category: fuzzyMatch.ingredients.category_id,
        match_status: 'fuzzy',
        match_confidence: 0.7,
      });
      continue;
    }

    // Try fuzzy name matching on ingredient names
    if (item.description) {
      console.log(`Trying fuzzy name match for: "${item.description}"`);
      
      // Get first few words of description (remove size/quantity info)
      const descWords = item.description.trim().split(/\s+/).slice(0, 3).join(' ').toLowerCase();
      
      const { data: nameMatches, error: nameError } = await supabase
        .from('ingredient_supplier_codes')
        .select(`
          ingredient_id,
          supplier_ingredient_name,
          product_code,
          ingredients!inner(id, name, unit, category_id)
        `)
        .eq('supplier_id', supplierId)
        .limit(100);  // Get more records for better fuzzy matching

      if (nameMatches && nameMatches.length > 0) {
        // Score each match based on name similarity
        let bestMatch = null;
        let bestScore = 0;

        for (const candidate of nameMatches) {
          const candidateName = (candidate.supplier_ingredient_name || candidate.ingredients.name).toLowerCase();
          const score = calculateSimilarity(descWords, candidateName);
          
          if (score > bestScore && score > 0.6) {  // Threshold: 60% similarity
            bestScore = score;
            bestMatch = candidate;
          }
        }

        if (bestMatch) {
          console.log(`✓ Fuzzy name match found for "${item.description}": ${bestMatch.ingredients.name} (score: ${bestScore})`);
          matchedItems.push({
            ...item,
            matched_ingredient_id: bestMatch.ingredients.id,
            matched_ingredient_name: bestMatch.ingredients.name,
            matched_ingredient_unit: bestMatch.ingredients.unit,
            matched_ingredient_category: bestMatch.ingredients.category_id,
            match_status: 'fuzzy_name',
            match_confidence: bestScore,
          });
          continue;
        }
      }
    }

    // No match found - suggest based on product code and description
    const suggestion = await suggestIngredient(supabase, productCode, item.description, supplierId);
    
    matchedItems.push({
      ...item,
      matched_ingredient_id: null,
      suggested_ingredient_id: suggestion?.id || null,
      suggested_ingredient_name: suggestion?.name || null,
      match_status: 'unmapped',
      match_confidence: suggestion?.confidence || 0,
    });
  }

  return matchedItems;
}

/**
 * Calculate similarity between two strings (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // Exact match
  if (s1 === s2) return 1.0;
  
  // Contains match
  if (s2.includes(s1) || s1.includes(s2)) return 0.9;
  
  // Word overlap
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  
  let matchingWords = 0;
  for (const word1 of words1) {
    if (word1.length < 3) continue;  // Skip short words
    for (const word2 of words2) {
      if (word2.includes(word1) || word1.includes(word2)) {
        matchingWords++;
        break;
      }
    }
  }
  
  const maxWords = Math.max(words1.length, words2.length);
  return matchingWords / maxWords;
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
 * Suggest ingredient based on product code and description
 */
async function suggestIngredient(supabase: any, productCode: string, description: string, supplierId: string) {
  if (!productCode && (!description || description.length < 3)) {
    return null;
  }

  console.log(`Suggesting ingredient for code: "${productCode}", description: "${description}"`);
  
  // PRIORITY 1: Try to find by similar product_code in ingredient_supplier_codes (this supplier)
  if (productCode && productCode.length >= 3) {
    const { data: codeMatches, error: codeError } = await supabase
      .from('ingredient_supplier_codes')
      .select(`
        ingredient_id,
        product_code,
        ingredients!inner(id, name, unit, category_id)
      `)
      .eq('supplier_id', supplierId)
      .limit(50);

    if (codeMatches && codeMatches.length > 0) {
      // Find best code match using similarity
      let bestMatch = null;
      let bestScore = 0;

      for (const candidate of codeMatches) {
        const candidateCode = candidate.product_code.toLowerCase();
        const searchCode = productCode.toLowerCase();
        
        // Calculate code similarity
        let score = 0;
        
        // Exact match (shouldn't happen, but just in case)
        if (candidateCode === searchCode) {
          score = 1.0;
        }
        // Starts with
        else if (candidateCode.startsWith(searchCode) || searchCode.startsWith(candidateCode)) {
          score = 0.8;
        }
        // Contains
        else if (candidateCode.includes(searchCode) || searchCode.includes(candidateCode)) {
          score = 0.6;
        }
        // First 3 chars match
        else if (candidateCode.substring(0, 3) === searchCode.substring(0, 3)) {
          score = 0.5;
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = candidate;
        }
      }

      // If we found a decent match by code, use it
      if (bestMatch && bestScore >= 0.5) {
        console.log(`✓ Suggested by code similarity (${Math.round(bestScore * 100)}%): ${bestMatch.ingredients.name}`);
        return {
          id: bestMatch.ingredients.id,
          name: bestMatch.ingredients.name,
          unit: bestMatch.ingredients.unit,
          category: bestMatch.ingredients.category,
          confidence: bestScore,
        };
      }
    }
  }

  // PRIORITY 2: Try to find by name similarity
  if (description && description.length >= 3) {
    // Get first few words of description (remove size/quantity info)
    const keywords = description.trim().split(/\s+/).slice(0, 3).join(' ');
    
    // Search ingredients by name similarity
    const { data, error } = await supabase
      .from('ingredients')
      .select('id, name, unit, category')
      .ilike('name', `%${keywords}%`)
      .limit(1)
      .maybeSingle();

    if (data) {
      console.log(`✓ Suggested by name similarity: ${data.name}`);
      return { ...data, confidence: 0.5 };
    }
  }

  return null;
}

/**
 * Track unmapped codes for manual mapping
 * For suppliers without product codes (e.g., Albert), use description as the identifier
 */
async function trackUnmappedCodes(supabase: any, items: any[], supplierId: string) {
  console.log(`\n=== TRACKING UNMAPPED CODES ===`);
  console.log(`Total items: ${items.length}`);
  console.log(`Items by match_status:`);
  const statusCounts = items.reduce((acc: any, item: any) => {
    acc[item.match_status || 'undefined'] = (acc[item.match_status || 'undefined'] || 0) + 1;
    return acc;
  }, {});
  console.log(statusCounts);
  
  // Track both 'unmapped' (no match found) and 'no_code' (no product code to match)
  const unmappedItems = items.filter(item => 
    item.match_status === 'unmapped' || item.match_status === 'no_code'
  );
  console.log(`\nUnmapped items to track: ${unmappedItems.length}`);

  for (const item of unmappedItems) {
    // For items without product_code (e.g., Albert retail), use description as identifier
    // This allows unmapped codes tracking for suppliers that don't use product codes
    const productCodeOrDescription = item.product_code || item.description || 'UNKNOWN';
    
    console.log(`\n--- Tracking item ${unmappedItems.indexOf(item) + 1}/${unmappedItems.length} ---`);
    console.log(`  product_code: ${item.product_code || 'null'}`);
    console.log(`  description: ${item.description || 'null'}`);
    console.log(`  using as code: ${productCodeOrDescription}`);
    console.log(`  quantity: ${item.quantity}`);
    console.log(`  unit_price: ${item.unit_price}`);
    console.log(`  unit_of_measure: ${item.unit_of_measure}`);
    console.log(`  match_status: ${item.match_status}`);
    
    const { data, error } = await supabase
      .from('unmapped_product_codes')
      .upsert({
        supplier_id: supplierId,
        product_code: productCodeOrDescription,  // Use description when code is missing
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
      })
      .select();

    if (error) {
      console.error('  ❌ ERROR tracking unmapped code:', error.message);
      console.error('  Error details:', {
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
    } else {
      console.log(`  ✅ Successfully tracked: ${data ? data.length : 0} row(s)`);
    }
  }
  
  console.log(`\n=== TRACKING COMPLETE ===\n`);
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

