import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface DailyConsumptionItem {
  date: string;
  ingredientId: number;
  ingredientName: string;
  productId: number;
  productName: string;
  quantity: number;
  unit: string;
  source: 'recipe' | 'direct';
  orderCount: number;
}

export interface DailyConsumptionSummary {
  date: string;
  items: DailyConsumptionItem[];
  totalIngredients: number;
  totalProducts: number;
}

/**
 * Hook to fetch daily ingredient consumption from the database
 */
export const useDailyIngredientConsumption = (date: Date) => {
  const dateStr = date.toISOString().split('T')[0];
  
  return useQuery({
    queryKey: ["dailyIngredientConsumption", dateStr],
    queryFn: async (): Promise<DailyConsumptionSummary> => {
      const { data, error } = await supabase
        .from("daily_ingredient_consumption")
        .select(`
          id,
          date,
          ingredient_id,
          product_id,
          quantity,
          source,
          order_count,
          ingredients(id, name, unit),
          products(id, name)
        `)
        .eq("date", dateStr);

      if (error) {
        console.error("Error fetching daily consumption:", error);
        throw error;
      }

      const items: DailyConsumptionItem[] = (data || []).map((item: any) => ({
        date: item.date,
        ingredientId: item.ingredient_id,
        ingredientName: item.ingredients?.name || "Unknown",
        productId: item.product_id,
        productName: item.products?.name || "Unknown",
        quantity: item.quantity,
        unit: item.ingredients?.unit || "kg",
        source: item.source,
        orderCount: item.order_count,
      }));

      const totalIngredients = new Set(items.map(i => i.ingredientId)).size;
      const totalProducts = new Set(items.map(i => i.productId)).size;

      return {
        date: dateStr,
        items,
        totalIngredients,
        totalProducts,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook to calculate and save daily ingredient consumption
 * This calculates consumption from orders and saves it to the database
 */
export const useCalculateDailyConsumption = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (date: Date) => {
      const dateStr = date.toISOString().split('T')[0];
      
      console.log(`Calculating daily consumption for ${dateStr}...`);

      // Fetch all order items for this date
      const { data: orderItems, error: orderItemsError } = await supabase
        .from("order_items")
        .select(`
          id,
          quantity,
          product_id,
          orders!inner(
            id,
            date
          ),
          products!inner(
            id,
            name
          )
        `)
        .eq('orders.date', dateStr);

      if (orderItemsError) {
        console.error("Error fetching order items:", orderItemsError);
        throw orderItemsError;
      }

      if (!orderItems || orderItems.length === 0) {
        console.log(`No order items found for ${dateStr}`);
        return { success: true, message: "No orders to process", count: 0 };
      }

      console.log(`Order items found for ${dateStr}:`, orderItems.length);

      // Get unique product IDs
      const productIds = [...new Set(orderItems.map((item) => item.product_id))];

      // Fetch ALL product parts (including those with recipes)
      const { data: allProductParts, error: productPartsError } = await supabase
        .from("product_parts")
        .select(`
          id,
          product_id,
          ingredient_id,
          recipe_id,
          quantity,
          productOnly,
          bakerOnly,
          ingredients(id, name, unit),
          recipes(id, name)
        `)
        .in("product_id", productIds);

      if (productPartsError) {
        console.error("Error fetching product parts:", productPartsError);
        throw productPartsError;
      }

      console.log(`Product parts found (all):`, allProductParts?.length || 0);

      // Get unique recipe IDs to fetch their ingredients
      const recipeIds = [...new Set(
        (allProductParts || [])
          .filter(part => part.recipe_id)
          .map(part => part.recipe_id)
      )].filter(Boolean) as number[];

      console.log(`Unique recipes found:`, recipeIds.length);

      // Fetch recipe ingredients for all recipes
      const { data: recipeIngredients, error: recipeIngredientsError } = await supabase
        .from("recipe_ingredients")
        .select(`
          recipe_id,
          ingredient_id,
          quantity,
          ingredients(id, name, unit)
        `)
        .in("recipe_id", recipeIds);

      if (recipeIngredientsError) {
        console.error("Error fetching recipe ingredients:", recipeIngredientsError);
        throw recipeIngredientsError;
      }

      console.log(`Recipe ingredients found:`, recipeIngredients?.length || 0);

      // Create a map of recipe_id to its ingredients
      const recipeIngredientsMap = new Map<number, any[]>();
      if (recipeIngredients) {
        recipeIngredients.forEach((ri) => {
          if (!recipeIngredientsMap.has(ri.recipe_id)) {
            recipeIngredientsMap.set(ri.recipe_id, []);
          }
          recipeIngredientsMap.get(ri.recipe_id)!.push(ri);
        });
      }

      // Create a map of product_id to its parts (for debugging)
      const productPartsMap = new Map<number, any[]>();
      
      if (allProductParts) {
        allProductParts.forEach((part) => {
          if (!productPartsMap.has(part.product_id)) {
            productPartsMap.set(part.product_id, []);
          }
          productPartsMap.get(part.product_id)!.push(part);
        });
      }

      // Debug first product with both recipe and direct ingredients
      const debugProductId = productIds.find(pid => {
        const parts = productPartsMap.get(pid) || [];
        const hasRecipe = parts.some(p => p.recipe_id);
        const hasDirectIngredient = parts.some(p => p.ingredient_id && !p.recipe_id);
        return hasRecipe || hasDirectIngredient;
      });

      if (debugProductId) {
        const debugParts = productPartsMap.get(debugProductId) || [];
        const debugProduct = orderItems.find(oi => oi.product_id === debugProductId);
        const productName = (debugProduct?.products as any)?.name || 'Unknown';
        console.log(`\n=== DEBUG PRODUCT: ${productName} (ID: ${debugProductId}) ===`);
        console.log(`Order quantity: ${debugProduct?.quantity || 0}`);
        console.log(`Product parts:`, debugParts.length);
        debugParts.forEach((part, idx) => {
          console.log(`  Part ${idx + 1}:`);
          console.log(`    - Has recipe: ${!!part.recipe_id} ${part.recipe_id ? `(Recipe: ${part.recipes?.name})` : ''}`);
          console.log(`    - Has direct ingredient: ${!!part.ingredient_id && !part.recipe_id} ${part.ingredient_id && !part.recipe_id ? `(${part.ingredients?.name})` : ''}`);
          console.log(`    - Quantity per product: ${part.quantity}`);
          
          if (part.recipe_id) {
            const recipeIngs = recipeIngredientsMap.get(part.recipe_id) || [];
            console.log(`    - Recipe ingredients (${recipeIngs.length}):`);
            recipeIngs.forEach((ri) => {
              const totalForOrder = (debugProduct?.quantity || 0) * part.quantity * ri.quantity;
              console.log(`      * ${ri.ingredients?.name}: ${ri.quantity} ${ri.ingredients?.unit} per recipe unit → ${totalForOrder.toFixed(2)} ${ri.ingredients?.unit} for order`);
            });
          }
        });
        console.log(`=== END DEBUG ===\n`);
      }

      // Calculate daily consumption
      const consumptionMap = new Map<string, {
        date: string;
        ingredient_id: number;
        product_id: number;
        quantity: number;
        source: 'recipe' | 'direct';
        order_count: number;
      }>();

      orderItems.forEach((orderItem) => {
        const parts = productPartsMap.get(orderItem.product_id) || [];

        parts.forEach((part) => {
          // Handle direct ingredients (ingredient_id set, no recipe_id)
          if (part.ingredient_id && !part.recipe_id) {
            const consumption = orderItem.quantity * part.quantity;
            const key = `${dateStr}-${part.ingredient_id}-${orderItem.product_id}-direct`;

            if (consumptionMap.has(key)) {
              const existing = consumptionMap.get(key)!;
              existing.quantity += consumption;
              existing.order_count += 1;
            } else {
              consumptionMap.set(key, {
                date: dateStr,
                ingredient_id: part.ingredient_id,
                product_id: orderItem.product_id,
                quantity: consumption,
                source: 'direct',
                order_count: 1,
              });
            }
          }

          // Handle recipe-based ingredients
          if (part.recipe_id) {
            const recipeIngs = recipeIngredientsMap.get(part.recipe_id) || [];
            
            recipeIngs.forEach((recipeIngredient) => {
              if (!recipeIngredient.ingredient_id) return;

              // Calculate: order_quantity * product_part_quantity * recipe_ingredient_quantity
              const consumption = orderItem.quantity * part.quantity * recipeIngredient.quantity;
              const key = `${dateStr}-${recipeIngredient.ingredient_id}-${orderItem.product_id}-recipe`;

              if (consumptionMap.has(key)) {
                const existing = consumptionMap.get(key)!;
                existing.quantity += consumption;
                existing.order_count += 1;
              } else {
                consumptionMap.set(key, {
                  date: dateStr,
                  ingredient_id: recipeIngredient.ingredient_id,
                  product_id: orderItem.product_id,
                  quantity: consumption,
                  source: 'recipe',
                  order_count: 1,
                });
              }
            });
          }
        });
      });

      // Convert to array for database insert
      const consumptionRecords = Array.from(consumptionMap.values());

      if (consumptionRecords.length === 0) {
        console.log("No consumption records to save");
        return { success: true, message: "No consumption to record", count: 0 };
      }

      console.log(`Saving ${consumptionRecords.length} consumption records...`);

      // Delete existing records for this date (to avoid duplicates)
      const { error: deleteError } = await supabase
        .from("daily_ingredient_consumption")
        .delete()
        .eq("date", dateStr);

      if (deleteError) {
        console.error("Error deleting old records:", deleteError);
        // Continue anyway, upsert might handle it
      }

      // Insert new records
      const { error: insertError } = await supabase
        .from("daily_ingredient_consumption")
        .insert(consumptionRecords);

      if (insertError) {
        console.error("Error inserting consumption records:", insertError);
        throw insertError;
      }

      console.log(`Successfully saved ${consumptionRecords.length} consumption records for ${dateStr}`);

      return {
        success: true,
        message: `Saved ${consumptionRecords.length} consumption records`,
        count: consumptionRecords.length,
      };
    },
    onSuccess: (_data, variables) => {
      const dateStr = variables.toISOString().split('T')[0];
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["dailyIngredientConsumption", dateStr] });
      queryClient.invalidateQueries({ queryKey: ["monthlyIngredientConsumption"] });
    },
  });
};

/**
 * Hook to calculate consumption from PRODUCTION data (bakers & baker_items)
 * This uses actual production quantities rather than order quantities
 */
export const useCalculateDailyConsumptionFromProduction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (date: Date) => {
      const dateStr = date.toISOString().split('T')[0];
      
      console.log(`Calculating daily consumption from PRODUCTION for ${dateStr}...`);

      // Fetch all baker productions for this date
      const { data: bakers, error: bakersError } = await supabase
        .from("bakers")
        .select(`
          id,
          date,
          recipe_id,
          status,
          recipes(id, name)
        `)
        .eq('date', dateStr);

      if (bakersError) {
        console.error("Error fetching bakers:", bakersError);
        throw bakersError;
      }

      if (!bakers || bakers.length === 0) {
        console.log(`No baker productions found for ${dateStr}`);
        return { success: true, message: "No production data to process", count: 0 };
      }

      console.log(`Baker productions found for ${dateStr}:`, bakers.length);

      // Get all baker IDs
      const bakerIds = bakers.map(b => b.id);

      // Fetch all baker items for these productions
      const { data: bakerItems, error: bakerItemsError } = await supabase
        .from("baker_items")
        .select(`
          id,
          production_id,
          product_id,
          planned_quantity,
          actual_quantity,
          completed_quantity,
          recipe_quantity,
          products(id, name)
        `)
        .in('production_id', bakerIds);

      if (bakerItemsError) {
        console.error("Error fetching baker items:", bakerItemsError);
        throw bakerItemsError;
      }

      console.log(`Baker items found:`, bakerItems?.length || 0);

      // Get unique recipe IDs from bakers
      const recipeIds = [...new Set(bakers.map(b => b.recipe_id).filter(Boolean))] as number[];

      console.log(`Unique recipes in production:`, recipeIds.length);

      // Fetch recipe ingredients for all recipes
      const { data: recipeIngredients, error: recipeIngredientsError } = await supabase
        .from("recipe_ingredients")
        .select(`
          recipe_id,
          ingredient_id,
          quantity,
          ingredients(id, name, unit)
        `)
        .in("recipe_id", recipeIds);

      if (recipeIngredientsError) {
        console.error("Error fetching recipe ingredients:", recipeIngredientsError);
        throw recipeIngredientsError;
      }

      console.log(`Recipe ingredients found:`, recipeIngredients?.length || 0);

      // Create a map of recipe_id to its ingredients
      const recipeIngredientsMap = new Map<number, any[]>();
      if (recipeIngredients) {
        recipeIngredients.forEach((ri) => {
          if (!recipeIngredientsMap.has(ri.recipe_id)) {
            recipeIngredientsMap.set(ri.recipe_id, []);
          }
          recipeIngredientsMap.get(ri.recipe_id)!.push(ri);
        });
      }

      // Create a map of production_id to recipe_id
      const productionRecipeMap = new Map<number, number>();
      bakers.forEach(baker => {
        if (baker.recipe_id) {
          productionRecipeMap.set(baker.id, baker.recipe_id);
        }
      });

      // Fetch ONE recipe detail to understand the structure
      if (recipeIds.length > 0) {
        const sampleRecipeId = recipeIds[0];
        const { data: sampleRecipe, error: sampleRecipeError } = await supabase
          .from("recipes")
          .select("id, name, baker")
          .eq("id", sampleRecipeId)
          .single();

        if (!sampleRecipeError && sampleRecipe) {
          console.log(`\n=== RECIPE STRUCTURE DEBUG ===`);
          console.log(`Sample Recipe: ${sampleRecipe.name} (ID: ${sampleRecipe.id})`);
          console.log(`Baker field (recipe batch size?): ${sampleRecipe.baker}`);
          
          const sampleIngs = recipeIngredientsMap.get(sampleRecipeId) || [];
          console.log(`Recipe ingredients (${sampleIngs.length}):`);
          const totalIngredientWeight = sampleIngs.reduce((sum, ri) => sum + ri.quantity, 0);
          console.log(`Sum of all ingredient quantities: ${totalIngredientWeight.toFixed(2)} kg`);
          console.log(`Ingredients:`);
          sampleIngs.forEach((ri) => {
            console.log(`  * ${ri.ingredients?.name}: ${ri.quantity} ${ri.ingredients?.unit}`);
          });
          console.log(`=== END RECIPE DEBUG ===\n`);
        }
      }

      // Debug first baker item
      if (bakerItems && bakerItems.length > 0) {
        const debugItem = bakerItems[0];
        const recipeId = productionRecipeMap.get(debugItem.production_id);
        const recipe = bakers.find(b => b.id === debugItem.production_id);
        console.log(`\n=== DEBUG BAKER ITEM: ${(debugItem.products as any)?.name} (ID: ${debugItem.product_id}) ===`);
        console.log(`Recipe: ${(recipe?.recipes as any)?.name} (ID: ${recipeId})`);
        console.log(`Planned quantity: ${debugItem.planned_quantity}`);
        console.log(`Actual quantity: ${debugItem.actual_quantity}`);
        console.log(`Completed quantity: ${debugItem.completed_quantity}`);
        console.log(`Recipe quantity (total dough weight): ${debugItem.recipe_quantity} kg`);
        
        if (recipeId) {
          const recipeIngs = recipeIngredientsMap.get(recipeId) || [];
          const totalRecipeWeight = recipeIngs.reduce((sum, ri) => sum + ri.quantity, 0);
          console.log(`Recipe total weight (sum of ingredients): ${totalRecipeWeight.toFixed(2)} kg`);
          console.log(`Ratio: recipe_quantity / recipe_total_weight = ${debugItem.recipe_quantity} / ${totalRecipeWeight.toFixed(2)} = ${(debugItem.recipe_quantity / totalRecipeWeight).toFixed(4)}`);
          console.log(`\nRecipe ingredients (${recipeIngs.length}):`);
          recipeIngs.forEach((ri) => {
            const ratio = ri.quantity / totalRecipeWeight;
            const consumption = debugItem.recipe_quantity * ratio;
            console.log(`  * ${ri.ingredients?.name}:`);
            console.log(`    Recipe: ${ri.quantity} ${ri.ingredients?.unit}`);
            console.log(`    Ratio: ${(ratio * 100).toFixed(2)}% of total`);
            console.log(`    Consumption: ${debugItem.recipe_quantity} kg × ${(ratio * 100).toFixed(2)}% = ${consumption.toFixed(2)} ${ri.ingredients?.unit}`);
          });
        }
        console.log(`=== END DEBUG ===\n`);
      }

      // Calculate consumption based on recipe_quantity from baker_items
      const consumptionMap = new Map<string, {
        date: string;
        ingredient_id: number;
        product_id: number;
        quantity: number;
        source: 'recipe' | 'direct';
        order_count: number;
      }>();

      // Debug tracking for specific ingredient
      const debugIngredientName = "Pšen.mouka světlá T530";
      const debugTracking: Array<{
        productName: string;
        recipeName: string;
        recipeQuantity: number;
        ingredientPerKg: number;
        totalConsumption: number;
      }> = [];

      // Process baker_items to calculate ingredient consumption
      if (bakerItems) {
        bakerItems.forEach((bakerItem) => {
          const recipeId = productionRecipeMap.get(bakerItem.production_id);
          
          if (!recipeId) {
            console.warn(`No recipe found for production ${bakerItem.production_id}`);
            return;
          }

          const recipeIngs = recipeIngredientsMap.get(recipeId) || [];
          
          // Calculate total recipe weight (sum of all ingredients in the recipe)
          const totalRecipeWeight = recipeIngs.reduce((sum, ri) => sum + ri.quantity, 0);
          
          if (totalRecipeWeight === 0) {
            console.warn(`Recipe ${recipeId} has zero total weight`);
            return;
          }

          // recipe_quantity is the TOTAL dough weight produced
          const totalDoughWeight = bakerItem.recipe_quantity || 0;
          const recipe = bakers.find(b => b.id === bakerItem.production_id);

          recipeIngs.forEach((recipeIngredient) => {
            if (!recipeIngredient.ingredient_id) return;

            // Calculate ingredient consumption using ratio method:
            // consumption = total_dough_weight × (ingredient_amount / total_recipe_weight)
            const ingredientRatio = recipeIngredient.quantity / totalRecipeWeight;
            const consumption = totalDoughWeight * ingredientRatio;
            
            const key = `${dateStr}-${recipeIngredient.ingredient_id}-${bakerItem.product_id}-recipe`;

            // Track specific ingredient for debugging
            if (recipeIngredient.ingredients?.name === debugIngredientName) {
              debugTracking.push({
                productName: (bakerItem.products as any)?.name || 'Unknown',
                recipeName: (recipe?.recipes as any)?.name || 'Unknown',
                recipeQuantity: totalDoughWeight,
                ingredientPerKg: ingredientRatio,
                totalConsumption: consumption,
              });
            }

            if (consumptionMap.has(key)) {
              const existing = consumptionMap.get(key)!;
              existing.quantity += consumption;
              existing.order_count += 1;
            } else {
              consumptionMap.set(key, {
                date: dateStr,
                ingredient_id: recipeIngredient.ingredient_id,
                product_id: bakerItem.product_id,
                quantity: consumption,
                source: 'recipe',
                order_count: 1,
              });
            }
          });
        });
      }

      // Log debug tracking for specific ingredient
      if (debugTracking.length > 0) {
        console.log(`\n=== DEBUG INGREDIENT: ${debugIngredientName} ===`);
        console.log(`Total occurrences: ${debugTracking.length}`);
        const totalConsumption = debugTracking.reduce((sum, item) => sum + item.totalConsumption, 0);
        console.log(`Total consumption: ${totalConsumption.toFixed(2)} kg`);
        console.log(`\nTop 10 contributors:`);
        debugTracking
          .sort((a, b) => b.totalConsumption - a.totalConsumption)
          .slice(0, 10)
          .forEach((item, idx) => {
            console.log(`  ${idx + 1}. ${item.productName} (${item.recipeName})`);
            console.log(`     Dough weight: ${item.recipeQuantity.toFixed(2)} kg × ${(item.ingredientPerKg * 100).toFixed(2)}% (ratio) = ${item.totalConsumption.toFixed(2)} kg`);
          });
        
        // Group by product and show totals
        const byProduct = new Map<string, number>();
        debugTracking.forEach(item => {
          const current = byProduct.get(item.productName) || 0;
          byProduct.set(item.productName, current + item.totalConsumption);
        });
        
        console.log(`\nConsumption by product:`);
        Array.from(byProduct.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .forEach(([product, total]) => {
            console.log(`  ${product}: ${total.toFixed(2)} kg`);
          });
        console.log(`=== END DEBUG ===\n`);
      }

      // Convert to array for database insert
      const consumptionRecords = Array.from(consumptionMap.values());

      if (consumptionRecords.length === 0) {
        console.log("No consumption records to save from production");
        return { success: true, message: "No consumption to record from production", count: 0 };
      }

      console.log(`Saving ${consumptionRecords.length} consumption records from PRODUCTION...`);

      // Delete existing records for this date (to avoid duplicates)
      const { error: deleteError } = await supabase
        .from("daily_ingredient_consumption")
        .delete()
        .eq("date", dateStr);

      if (deleteError) {
        console.error("Error deleting old records:", deleteError);
      }

      // Insert new records
      const { error: insertError } = await supabase
        .from("daily_ingredient_consumption")
        .insert(consumptionRecords);

      if (insertError) {
        console.error("Error inserting consumption records:", insertError);
        throw insertError;
      }

      console.log(`Successfully saved ${consumptionRecords.length} consumption records from PRODUCTION for ${dateStr}`);

      return {
        success: true,
        message: `Saved ${consumptionRecords.length} consumption records from production`,
        count: consumptionRecords.length,
        source: 'production',
      };
    },
    onSuccess: (_data, variables) => {
      const dateStr = variables.toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: ["dailyIngredientConsumption", dateStr] });
      queryClient.invalidateQueries({ queryKey: ["monthlyIngredientConsumption"] });
    },
  });
};

/**
 * Hook to calculate consumption for a date range (month)
 */
export const useCalculateMonthlyConsumption = () => {
  const calculateDaily = useCalculateDailyConsumption();

  return useMutation({
    mutationFn: async ({ startDate, endDate }: { startDate: Date; endDate: Date }) => {
      const results = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        try {
          const result = await calculateDaily.mutateAsync(new Date(currentDate));
          results.push({
            date: currentDate.toISOString().split('T')[0],
            ...result,
          });
        } catch (error) {
          console.error(`Error calculating consumption for ${currentDate.toISOString().split('T')[0]}:`, error);
          results.push({
            date: currentDate.toISOString().split('T')[0],
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return results;
    },
  });
};

/**
 * Hook to calculate consumption for a date range (month) from PRODUCTION data
 */
export const useCalculateMonthlyConsumptionFromProduction = () => {
  const calculateFromProduction = useCalculateDailyConsumptionFromProduction();

  return useMutation({
    mutationFn: async ({ startDate, endDate }: { startDate: Date; endDate: Date }) => {
      // Fix timezone issue by using local date formatting
      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const results = [];
      const currentDate = new Date(startDate);
      let totalDays = 0;
      let successfulDays = 0;
      let failedDays = 0;

      while (currentDate <= endDate) {
        const dateStr = formatLocalDate(currentDate);
        totalDays++;
        
        try {
          const result = await calculateFromProduction.mutateAsync(new Date(currentDate));
          
          results.push({
            date: dateStr,
            ...result,
          });
          
          if (result.success) {
            successfulDays++;
          } else {
            failedDays++;
          }
        } catch (error) {
          failedDays++;
          results.push({
            date: dateStr,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return results;
    },
  });
};

/**
 * Hook to delete daily ingredient consumption for a specific date
 */
export const useDeleteDailyConsumption = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (date: Date) => {
      const dateStr = date.toISOString().split('T')[0];
      console.log(`Deleting consumption records for ${dateStr}...`);

      const { error } = await supabase
        .from('daily_ingredient_consumption')
        .delete()
        .eq('date', dateStr);

      if (error) {
        console.error('Error deleting daily consumption:', error);
        throw error;
      }

      return {
        message: `Úspěšně smazáno pro ${dateStr}`,
      };
    },
    onSuccess: (_data, date) => {
      const dateStr = date.toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: ['dailyIngredientConsumption', dateStr] });
    },
  });
};

