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
        raw_text: ocrResult.raw_text || '', // Include raw OCR text for debugging
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
    
    if (!productCode) {
      matchedItems.push({ ...item, match_status: 'no_code' });
      continue;
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

