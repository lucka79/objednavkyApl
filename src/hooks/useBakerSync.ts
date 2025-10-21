import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface SyncResult {
  baker_id: number;
  category_name: string;
  total_products: number;
  total_quantity: number;
}

interface DateRangeSyncResult {
  date_processed: string;
  bakers_created: number;
  bakers_updated: number;
}

/**
 * Calculate COST PER UNIT for multiple baker items in batch (recipes and ingredients only)
 * Note: Product parts (pastry_id) are excluded from cost calculation
 */
const calculateBakerItemCostsBatch = async (
  items: Array<{ product_id: number; recipe_quantity: number }>
): Promise<Map<number, number>> => {
  console.log(`💰 Calculating costs for ${items.length} baker items in batch`);
  
  const costMap = new Map<number, number>();
  const uniqueProductIds = [...new Set(items.map(item => item.product_id))];
  
  try {
    // Fetch recipe and ingredient parts only for all products at once (exclude product parts)
    const { data: productParts, error: partsError } = await supabase
      .from("product_parts")
      .select(`
        id,
        product_id,
        recipe_id,
        ingredient_id,
        quantity,
        productOnly,
        recipes (id, pricePerKilo),
        ingredients (id, price)
      `)
      .in("product_id", uniqueProductIds)
      .or("recipe_id.not.is.null,ingredient_id.not.is.null");

    if (partsError) {
      console.error("❌ Error fetching product parts in batch:", partsError);
      return costMap;
    }

    // Group parts by product_id
    const partsByProduct = new Map<number, any[]>();
    productParts?.forEach(part => {
      if (!partsByProduct.has(part.product_id)) {
        partsByProduct.set(part.product_id, []);
      }
      partsByProduct.get(part.product_id)?.push(part);
    });

    // Calculate cost for each item (only recipes and ingredients)
    for (const item of items) {
      const parts = partsByProduct.get(item.product_id) || [];
      let totalCostPerUnit = 0;

      for (const part of parts) {
        const partQuantity = part.quantity || 0;

        // Skip productOnly parts
        if (part.productOnly) continue;

        if (part.recipe_id && part.recipes) {
          const pricePerKilo = (part.recipes as any).pricePerKilo || 0;
          totalCostPerUnit += partQuantity * pricePerKilo;
        } else if (part.ingredient_id && part.ingredients) {
          const ingredientPrice = (part.ingredients as any).price || 0;
          totalCostPerUnit += partQuantity * ingredientPrice;
        }
      }

      // Store cost per unit (not total cost)
      costMap.set(item.product_id, Math.round(totalCostPerUnit * 100) / 100);
    }

    console.log(`✅ Calculated costs for ${costMap.size} unique products`);
    return costMap;
  } catch (error) {
    console.error("❌ Error calculating costs in batch:", error);
    return costMap;
  }
};

export const useSyncBakersForDate = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ date, userId }: { date: Date; userId: string }) => {
      const dateStr = date.toISOString().split('T')[0];
      
      const { data, error } = await supabase.rpc('sync_bakers_for_date', {
        target_date: dateStr,
        target_user_id: userId
      });

      if (error) throw error;
      return data as SyncResult[];
    },
    onSuccess: (data) => {
      const totalBakers = data.length;
      const totalProducts = data.reduce((sum, item) => sum + item.total_products, 0);
      const totalQuantity = data.reduce((sum, item) => sum + item.total_quantity, 0);

      toast({
        title: "Úspěch",
        description: `Synchronizováno ${totalBakers} produkčních plánů s ${totalProducts} produkty (${totalQuantity} ks)`,
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["dailyProductionPlanner"] });
      queryClient.invalidateQueries({ queryKey: ["bakers"] });
      queryClient.invalidateQueries({ queryKey: ["baker_items"] });
    },
    onError: (error) => {
      toast({
        title: "Chyba",
        description: `Nepodařilo se synchronizovat produkční plány: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useSyncBakersForDateRange = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      startDate, 
      endDate, 
      userId 
    }: { 
      startDate: Date; 
      endDate: Date; 
      userId?: string 
    }) => {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      const { data, error } = await supabase.rpc('sync_bakers_for_date_range', {
        start_date: startDateStr,
        end_date: endDateStr,
        target_user_id: userId || null
      });

      if (error) throw error;
      return data as DateRangeSyncResult[];
    },
    onSuccess: (data) => {
      const totalDays = data.length;
      const totalCreated = data.reduce((sum, item) => sum + item.bakers_created, 0);
      const totalUpdated = data.reduce((sum, item) => sum + item.bakers_updated, 0);

      toast({
        title: "Úspěch",
        description: `Synchronizováno ${totalDays} dnů: ${totalCreated} nových, ${totalUpdated} aktualizovaných plánů`,
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["dailyProductionPlanner"] });
      queryClient.invalidateQueries({ queryKey: ["bakers"] });
      queryClient.invalidateQueries({ queryKey: ["baker_items"] });
    },
    onError: (error) => {
      toast({
        title: "Chyba",
        description: `Nepodařilo se synchronizovat produkční plány: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

export const useManualBakerSync = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ date }: { date: Date; userId?: string }) => {
      const dateStr = date.toISOString().split('T')[0];
      
      console.log(`\n🔄 SYNCING DATE: ${dateStr}`);
      
      // Fetch order_items directly to avoid Supabase nested resource limits
      const { data: orderItems, error: orderItemsError } = await supabase
        .from('order_items')
        .select(`
          id,
          product_id,
          quantity,
          order_id,
          orders!inner(
            id,
            date,
            user_id,
            status
          ),
          products!inner(
            id,
            name,
            category_id,
            categories!inner(
              id,
              name
            )
          )
        `)
        .eq('orders.date', dateStr);

      if (orderItemsError) throw orderItemsError;

      console.log(`📦 Found ${orderItems?.length || 0} order items for ${dateStr}\n`);
      
      if (!orderItems || orderItems.length === 0) {
        throw new Error(`Žádné objednávky pro vybraný den: ${dateStr}`);
      }

      // Group order items by order_id to reconstruct orders structure
      const ordersMap = new Map<number, any>();
      for (const item of orderItems) {
        const order = (item.orders as any);
        if (!ordersMap.has(order.id)) {
          ordersMap.set(order.id, {
            id: order.id,
            user_id: order.user_id,
            date: order.date,
            status: order.status,
            order_items: []
          });
        }
        ordersMap.get(order.id)!.order_items.push(item);
      }
      
      const orders = Array.from(ordersMap.values());

      // Process all orders together since uniqueness is only on (date, recipe_id)
      // Get all product IDs from all orders
      const allProductIds = orders.flatMap(order => 
        order.order_items.map((item: any) => item.product_id)
      );
      
      // Results array
      const results: SyncResult[] = [];

      // Batch fetch all product_parts data for all products
      console.log(`\n🔍 Querying product_parts for ${allProductIds.length} unique product IDs`);
      
      const { data: allProductParts, error: productPartsError } = await supabase
        .from('product_parts')
        .select(`
          product_id,
          recipe_id,
          quantity
        `)
        .in('product_id', allProductIds);
      
      console.log(`🔍 Received ${allProductParts?.length || 0} product_parts records`);

      if (productPartsError) {
        console.warn('Error fetching product_parts:', productPartsError);
      }

      // Create lookup map for product_parts
      const productPartsMap = new Map();
      
      if (allProductParts) {
        for (const part of allProductParts as any[]) {
          // Use direct recipe_id for production grouping
          if (part.recipe_id !== null && part.recipe_id !== undefined) {
            productPartsMap.set(part.product_id, {
              recipe_id: part.recipe_id,
              quantity: parseFloat(part.quantity)
            });
          }
        }
      }

      console.log(`✅ Mapped ${productPartsMap.size} products to recipes\n`);

      // Group products by recipe_id (across all users)
      const recipeMap = new Map();
      
      console.log(`\n📋 Processing ${orders.length} orders with ${orders.reduce((sum, o) => sum + o.order_items.length, 0)} order items`);
      
      for (const order of orders) {
        for (const item of order.order_items) {
          // Skip items with quantity <= 0
          if (item.quantity <= 0) continue;
          
          const product = item.products as any;
          const category = product.categories as any;
          
          // Check if product has entry in product_parts table
          let recipeId: string | number = 'no-recipe';
          let recipeName = 'Bez receptu';
          
          const productPart = productPartsMap.get(product.id);
          if (productPart) {
            recipeId = productPart.recipe_id;
            recipeName = `Recipe ${productPart.recipe_id}`;
          }
          // If no product_parts entry, product goes to "Bez receptu"
          
          if (!recipeMap.has(recipeId)) {
            recipeMap.set(recipeId, {
              recipe_id: recipeId,
              recipe_name: recipeName,
              category_id: category.id,
              category_name: category.name,
              products: new Map()
            });
          }
          
          const recipeData = recipeMap.get(recipeId);
          if (!recipeData.products.has(product.id)) {
            recipeData.products.set(product.id, {
              product_id: product.id,
              product_name: product.name,
              quantity: 0
            });
          }
          
          recipeData.products.get(product.id).quantity += item.quantity;
        }
      }

      console.log(`✅ Grouped into ${recipeMap.size} recipe categories\n`);

      // Get all unique recipe IDs we need to process
      const recipeIds = Array.from(recipeMap.keys()).filter(id => id !== 'no-recipe');
      
      if (recipeIds.length === 0) {
        console.warn('No recipes with valid recipe_id found');
        return [];
      }

      // Use upsert logic to handle existing bakers properly
      // Uniqueness is only on (date, recipe_id), not user_id
      const bakerMap = new Map(); // recipe_id -> baker_id
      
      for (const [recipeId, recipeData] of recipeMap) {
        if (recipeId === 'no-recipe') {
          console.warn(`Skipping products without recipes: ${recipeData.recipe_name}`);
          continue;
        }

        // Check if baker already exists for this recipe and date
        const { data: existingBaker, error: bakerCheckError } = await supabase
          .from('bakers')
          .select('id')
          .eq('date', dateStr)
          .eq('recipe_id', recipeId)
          .maybeSingle();

        // If there's an error that's not "not found", throw it
        if (bakerCheckError && bakerCheckError.code !== 'PGRST116') {
          throw bakerCheckError;
        }


        let bakerId: number;

        if (existingBaker) {
          // Update existing baker
          bakerId = existingBaker.id;
          await supabase
            .from('bakers')
            .update({
              notes: `Manuálně synchronizováno pro recept: ${recipeData.recipe_name}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', bakerId);

          // Don't delete baker_items - we'll upsert them instead
        } else {
          // Create new baker
          const { data: newBaker, error: createError } = await supabase
            .from('bakers')
            .insert({
              date: dateStr,
              recipe_id: recipeId,
              notes: `Manuálně vytvořené pro recept: ${recipeData.recipe_name}`
            })
            .select('id')
            .single();

          if (createError) {
            throw createError;
          }
          bakerId = newBaker.id;
        }

        bakerMap.set(recipeId, bakerId);
      }

      // Prepare all baker items for cost calculation
      const allBakerItemsForCostCalc: Array<{ product_id: number; recipe_quantity: number }> = [];
      
      for (const [recipeId, recipeData] of recipeMap) {
        if (recipeId === 'no-recipe') continue;

        const bakerId = bakerMap.get(recipeId);
        if (!bakerId) continue;

        for (const product of recipeData.products.values()) {
          if (product.quantity > 0) {
            const productPart = productPartsMap.get(product.product_id);
            const partQuantity = productPart?.quantity || 1;
            const ingredientForThisProduct = product.quantity * partQuantity;
            const roundedRecipeQuantity = Math.round(ingredientForThisProduct * 100) / 100;
            
            allBakerItemsForCostCalc.push({
              product_id: product.product_id,
              recipe_quantity: roundedRecipeQuantity
            });
          }
        }
      }
      
      // Calculate costs for all products in batch
      const costMap = await calculateBakerItemCostsBatch(allBakerItemsForCostCalc);
      
      // Now create baker_items for all recipes with costs
      const allBakerItems = [];
      
      for (const [recipeId, recipeData] of recipeMap) {
        if (recipeId === 'no-recipe') continue;

        const bakerId = bakerMap.get(recipeId);
        if (!bakerId) continue;
        
        for (const product of recipeData.products.values()) {
          if (product.quantity > 0) {
            const productPart = productPartsMap.get(product.product_id);
            const partQuantity = productPart?.quantity || 1;
            const ingredientForThisProduct = product.quantity * partQuantity;
            const roundedRecipeQuantity = Math.round(ingredientForThisProduct * 100) / 100;
            const ceiledQuantity = Math.max(1, Math.ceil(ingredientForThisProduct));
            const productCost = costMap.get(product.product_id) || 0;
            
            allBakerItems.push({
              production_id: bakerId,
              product_id: product.product_id,
              planned_quantity: ceiledQuantity,
              recipe_quantity: roundedRecipeQuantity,
              cost: productCost
            });
          }
        }
      }

      // Batch: Update or insert baker_items (preserving actual_quantity if manually set)
      let totalInserted = 0;
      let preservedCount = 0;
      
      if (allBakerItems.length > 0) {
        console.log("Upserting baker items with costs:", allBakerItems.length);
        
        // Fetch existing baker items to preserve actual_quantity
        const bakerIds = Array.from(bakerMap.values());
        const { data: existingItems } = await supabase
          .from("baker_items")
          .select("id, production_id, product_id, planned_quantity, actual_quantity")
          .in("production_id", bakerIds);

        // Create map of existing items by production_id and product_id
        const existingItemsMap = new Map<string, any>();
        if (existingItems) {
          existingItems.forEach(item => {
            const key = `${item.production_id}_${item.product_id}`;
            existingItemsMap.set(key, item);
          });
        }

        // Update allBakerItems to preserve actual_quantity if it was manually set differently
        const itemsToUpsert = allBakerItems.map(item => {
          const key = `${item.production_id}_${item.product_id}`;
          const existingItem = existingItemsMap.get(key);
          
          // If actual_quantity was manually set (differs from old planned_quantity), preserve it
          if (existingItem && 
              existingItem.actual_quantity !== null && 
              existingItem.actual_quantity !== existingItem.planned_quantity) {
            preservedCount++;
            console.log(`Preserving actual_quantity for product ${item.product_id}: ${existingItem.actual_quantity} (old planned: ${existingItem.planned_quantity}, new planned: ${item.planned_quantity})`);
            return {
              ...item,
              actual_quantity: existingItem.actual_quantity,
            };
          }
          
          return item;
        });
        
        console.log(`Preserved actual_quantity for ${preservedCount} items`);

        // Delete existing items for these productions
        await supabase
          .from("baker_items")
          .delete()
          .in("production_id", bakerIds);

        // Insert updated items with preserved actual_quantity
        const { data: insertedItems, error: itemsError } = await supabase
          .from("baker_items")
          .insert(itemsToUpsert)
          .select();

        if (itemsError) {
          console.error("Error upserting baker items:", itemsError);
          throw itemsError;
        }

        totalInserted = insertedItems?.length || 0;
        console.log(`Upserted ${totalInserted} baker items (${preservedCount} with preserved actual_quantity)`);
      }

      // Log summary
      console.log(`\n✅ SYNC COMPLETE: ${totalInserted} items upserted (${preservedCount} with preserved actual_quantity)\n`);

      // Create results summary
      for (const [recipeId, recipeData] of recipeMap) {
        if (recipeId === 'no-recipe') continue;

        const bakerId = bakerMap.get(recipeId);
        if (!bakerId) continue;

        const recipeItems = allBakerItems.filter(item => item.production_id === bakerId);
        
        results.push({
          baker_id: bakerId,
          category_name: recipeData.recipe_name,
          total_products: recipeItems.length,
          total_quantity: recipeItems.reduce((sum, item) => sum + item.planned_quantity, 0)
        });
      }

      return results;
    },
    onSuccess: (data) => {
      const totalBakers = data.length;
      const totalProducts = data.reduce((sum, item) => sum + item.total_products, 0);
      const totalQuantity = data.reduce((sum, item) => sum + item.total_quantity, 0);

      toast({
        title: "Úspěch",
        description: `Synchronizováno ${totalBakers} produkčních plánů s ${totalProducts} produkty (${totalQuantity} ks)`,
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["dailyProductionPlanner"] });
      queryClient.invalidateQueries({ queryKey: ["bakers"] });
      queryClient.invalidateQueries({ queryKey: ["baker_items"] });
    },
    onError: (error) => {
      toast({
        title: "Chyba",
        description: `Nepodařilo se manuálně synchronizovat: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

// Sync productions from orders - optimized version matching React Native
export const useSyncProductionsFromOrders = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ date, recipeMap }: { 
      date: string; 
      recipeMap: Record<number, any>;
    }) => {
      console.log("=== SYNCING PRODUCTIONS FROM ORDERS (OPTIMIZED) ===");
      console.log("Date:", date);
      console.log("Number of recipes to process:", Object.keys(recipeMap).length);

      let created = 0;
      let updated = 0;

      // Get all required recipe IDs
      const requiredRecipeIds = Object.keys(recipeMap).map(id => parseInt(id));

      // Check existing productions for all recipes at once
      const { data: existingProductions, error: existingError } = await supabase
        .from("bakers")
        .select("id, recipe_id")
        .eq("date", date)
        .in("recipe_id", requiredRecipeIds);

      if (existingError) {
        console.error("Error fetching existing productions:", existingError);
        throw existingError;
      }

      // Create a map of existing productions by recipe_id
      const existingProductionsMap = new Map();
      existingProductions?.forEach(prod => {
        existingProductionsMap.set(prod.recipe_id, prod.id);
      });

      // Prepare productions to create
      const productionsToCreate: any[] = [];
      const recipesToUpdate: any[] = [];

      requiredRecipeIds.forEach(recipeId => {
        const recipe = recipeMap[recipeId];
        if (!existingProductionsMap.has(recipeId)) {
          // Need to create new production
          productionsToCreate.push({
            recipe_id: recipeId,
            date: date,
            status: "in_progress",
          });
        } else {
          // Production exists, mark for update
          recipesToUpdate.push({
            recipeId,
            productionId: existingProductionsMap.get(recipeId),
            recipe
          });
        }
      });

      // Create new productions in batch
      if (productionsToCreate.length > 0) {
        console.log("Creating new productions:", productionsToCreate.length);
        const { data: newProductions, error: createError } = await supabase
          .from("bakers")
          .insert(productionsToCreate)
          .select("id, recipe_id");

        if (createError) {
          console.error("Error creating productions:", createError);
          throw createError;
        }

        created = newProductions?.length || 0;
        console.log("Created productions:", created);

        // Add new productions to the map for baker items creation
        newProductions?.forEach(prod => {
          existingProductionsMap.set(prod.recipe_id, prod.id);
        });
      }

      // Prepare all baker items for batch upsert and collect items for cost calculation
      const allBakerItemsForCostCalc: Array<{ product_id: number; recipe_quantity: number }> = [];
      
      requiredRecipeIds.forEach(recipeId => {
        const recipe = recipeMap[recipeId];
        const productionId = existingProductionsMap.get(recipeId);
        
        if (productionId && recipe.products) {
          recipe.products.forEach((product: any) => {
            // Only include products with positive quantities to avoid constraint violations
            if (product.totalQuantity > 0) {
              allBakerItemsForCostCalc.push({
                product_id: product.id,
                recipe_quantity: product.receptQuantity || 0
              });
            }
          });
        }
      });
      
      // Calculate costs for all products in batch
      const costMap = await calculateBakerItemCostsBatch(allBakerItemsForCostCalc);
      
      const allBakerItems: any[] = [];
      
      requiredRecipeIds.forEach(recipeId => {
        const recipe = recipeMap[recipeId];
        const productionId = existingProductionsMap.get(recipeId);
        
        if (productionId && recipe.products) {
          recipe.products.forEach((product: any) => {
            // Only include products with positive quantities to avoid constraint violations
            if (product.totalQuantity > 0) {
              const recipeQuantity = Math.round((product.receptQuantity || 0) * 100) / 100;
              const cost = costMap.get(product.id) || 0;
              
              allBakerItems.push({
                production_id: productionId,
                product_id: product.id,
                planned_quantity: product.totalQuantity,
                recipe_quantity: recipeQuantity,
                cost: cost,
                is_completed: false,
              });
            }
          });
        }
      });

      // Upsert all baker items with costs in batch, preserving actual_quantity
      let preservedCount = 0;
      
      if (allBakerItems.length > 0) {
        console.log("Upserting baker items with costs:", allBakerItems.length);
        
        // First, fetch existing baker items to preserve actual_quantity
        const productionIds = Array.from(existingProductionsMap.values());
        const { data: existingItems } = await supabase
          .from("baker_items")
          .select("id, production_id, product_id, planned_quantity, actual_quantity")
          .in("production_id", productionIds);

        // Create map of existing items by production_id and product_id
        const existingItemsMap = new Map<string, any>();
        if (existingItems) {
          existingItems.forEach(item => {
            const key = `${item.production_id}_${item.product_id}`;
            existingItemsMap.set(key, item);
          });
        }

        // Update allBakerItems to preserve actual_quantity if it was manually set differently
        const itemsToUpsert = allBakerItems.map(item => {
          const key = `${item.production_id}_${item.product_id}`;
          const existingItem = existingItemsMap.get(key);
          
          // If actual_quantity was manually set (differs from old planned_quantity), preserve it
          if (existingItem && 
              existingItem.actual_quantity !== null && 
              existingItem.actual_quantity !== existingItem.planned_quantity) {
            preservedCount++;
            console.log(`Preserving actual_quantity for product ${item.product_id}: ${existingItem.actual_quantity} (old planned: ${existingItem.planned_quantity}, new planned: ${item.planned_quantity})`);
            return {
              ...item,
              actual_quantity: existingItem.actual_quantity,
            };
          }
          
          return item;
        });
        
        console.log(`Preserved actual_quantity for ${preservedCount} items`);

        // Delete existing items for these productions
        await supabase
          .from("baker_items")
          .delete()
          .in("production_id", productionIds);

        // Insert updated items with preserved actual_quantity
        const { data: insertedItems, error: itemsError } = await supabase
          .from("baker_items")
          .insert(itemsToUpsert)
          .select();

        if (itemsError) {
          console.error("Error upserting baker items:", itemsError);
          throw itemsError;
        }

        updated = insertedItems?.length || 0;
        console.log(`Upserted ${updated} baker items (${preservedCount} with preserved actual_quantity)`);
      }

      console.log("Sync completed:", { 
        created: `${created} new productions`, 
        updated: `${updated} baker items updated`,
        preserved: `${preservedCount} actual quantities preserved`
      });
      return { created, updated };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["baker-productions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["baker-production-items"],
      });
      queryClient.invalidateQueries({
        queryKey: ["dailyProductionPlanner"],
      });
      queryClient.invalidateQueries({
        queryKey: ["bakers"],
      });
      queryClient.invalidateQueries({
        queryKey: ["baker_items"],
      });
    },
    onError: (error) => {
      toast({
        title: "Chyba",
        description: `Nepodařilo se synchronizovat: ${error.message}`,
        variant: "destructive",
      });
    },
  });
};

