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
      
      // Get all unique users for the results
      const usersWithOrders = new Set(orders.map(order => order.user_id));
      const results: SyncResult[] = [];

      // Batch fetch all product_parts data for all products (including cost calculation data)
      console.log(`\n🔍 Querying product_parts for ${allProductIds.length} unique product IDs`);
      
      const { data: allProductParts, error: productPartsError } = await supabase
        .from('product_parts')
        .select(`
          product_id,
          recipe_id,
          pastry_id,
          quantity,
          productOnly,
          bakerOnly,
          recipes (
            id,
            quantity,
            price,
            recipe_ingredients (
              ingredient_id,
              quantity,
              ingredients (id, price, kiloPerUnit, unit)
            )
          ),
          ingredients (id, price, kiloPerUnit, unit)
        `)
        .in('product_id', allProductIds);
      
      console.log(`🔍 Received ${allProductParts?.length || 0} product_parts records`);

      if (productPartsError) {
        console.warn('Error fetching product_parts:', productPartsError);
      }

      // Note: Nested recipes (recipes that use other recipes as ingredients) are handled
      // at the ingredient consumption level, not production grouping level.
      // Each recipe remains its own production group for bakers.

      // Create lookup map for product_parts and calculate costs
      const productPartsMap = new Map();
      const productCostMap = new Map<number, number>();
      
      if (allProductParts) {
        
        // Calculate cost for each product
        const costsByProduct = new Map<number, number>();
        
        for (const part of allProductParts as any[]) {
          const productId = part.product_id;
          let partCost = 0;
          
          // Skip productOnly parts (excluded from cost calculation)
          if (!part.productOnly) {
            // Calculate cost for direct ingredients
            if (part.ingredient_id && part.ingredients) {
              const ingredient = part.ingredients;
              const quantityInKg = part.quantity * (ingredient.kiloPerUnit || 1);
              partCost = quantityInKg * (ingredient.price || 0);
            }
            
            // Calculate cost for recipe-based ingredients
            if (part.recipe_id && part.recipes && part.recipes.recipe_ingredients) {
              const recipe = part.recipes;
              
              // Calculate total weight and price from recipe ingredients
              let totalRecipeWeight = 0;
              let totalRecipePrice = 0;
              
              recipe.recipe_ingredients.forEach((recipeIng: any) => {
                if (recipeIng.ingredients && recipeIng.quantity > 0) {
                  const ingredient = recipeIng.ingredients;
                  const weightInKg = recipeIng.quantity * (ingredient.kiloPerUnit || 1);
                  totalRecipeWeight += weightInKg;
                  
                  if (ingredient.price) {
                    totalRecipePrice += weightInKg * ingredient.price;
                  }
                }
              });
              
              // Calculate price per kg and multiply by part quantity
              if (totalRecipeWeight > 0) {
                const recipePricePerKg = totalRecipePrice / totalRecipeWeight;
                partCost = recipePricePerKg * part.quantity;
              } else if (recipe.price) {
                // Fallback to stored recipe price
                partCost = recipe.price * part.quantity;
              }
            }
          }
          
          // Add to product total cost
          const existingCost = costsByProduct.get(productId) || 0;
          costsByProduct.set(productId, existingCost + partCost);
          
          // Store in productPartsMap for recipe mapping
          // Use direct recipe_id for production grouping (don't resolve nested recipes)
          if (part.recipe_id !== null && part.recipe_id !== undefined) {
            productPartsMap.set(part.product_id, {
              recipe_id: part.recipe_id, // Use direct recipe, not nested
              quantity: parseFloat(part.quantity)
            });
          }
        }
        
        // Store costs in productCostMap
        for (const [productId, cost] of costsByProduct.entries()) {
          productCostMap.set(productId, cost);
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

        // Check if baker already exists for this recipe and date (regardless of user)
        const { data: existingBaker, error: bakerCheckError } = await supabase
          .from('bakers')
          .select('id, user_id')
          .eq('date', dateStr)
          .eq('recipe_id', recipeId)
          .maybeSingle();

        // If there's an error that's not "not found", throw it
        if (bakerCheckError && bakerCheckError.code !== 'PGRST116') {
          throw bakerCheckError;
        }


        let bakerId: number;

        if (existingBaker) {
          // Update existing baker (change user_id to first user if different)
          bakerId = existingBaker.id;
          const firstUserId = Array.from(usersWithOrders)[0]; // Use first user
          await supabase
            .from('bakers')
            .update({
              user_id: firstUserId, // Update to first user
              notes: `Manuálně synchronizováno pro recept: ${recipeData.recipe_name}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', bakerId);

          // Don't delete baker_items - we'll upsert them instead
        } else {
          // Create new baker
          const firstUserId = Array.from(usersWithOrders)[0]; // Use first user
          const { data: newBaker, error: createError } = await supabase
            .from('bakers')
            .insert({
              date: dateStr,
              user_id: firstUserId,
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

      // Now create baker_items for all recipes
      const allBakerItems = [];
      
      for (const [recipeId, recipeData] of recipeMap) {
        if (recipeId === 'no-recipe') continue;

        const bakerId = bakerMap.get(recipeId);
        if (!bakerId) continue;

        // Sum all products for this recipe before inserting
        let totalIngredientNeeded = 0;
        const productDetails = [];
        
        for (const product of recipeData.products.values()) {
          if (product.quantity > 0) {
            // Get the product_parts quantity from our pre-fetched data
            const productPart = productPartsMap.get(product.product_id);
            const partQuantity = productPart?.quantity || 1; // Default to 1 if no product_parts data
            const ingredientForThisProduct = product.quantity * partQuantity;
            
            totalIngredientNeeded += ingredientForThisProduct;
            productDetails.push({
              product_id: product.product_id,
              product_name: product.product_name,
              ordered_quantity: product.quantity,
              part_quantity: partQuantity,
              ingredient_needed: ingredientForThisProduct
            });
          }
        }
        
        // Create baker_items for each product in this recipe
        for (const product of recipeData.products.values()) {
          if (product.quantity > 0) {
            // Get the product_parts quantity from our pre-fetched data
            const productPart = productPartsMap.get(product.product_id);
            const partQuantity = productPart?.quantity || 1; // Default to 1 if no product_parts data
            const ingredientForThisProduct = product.quantity * partQuantity;
            
            // Round to 2 decimal places to avoid floating point precision issues
            const roundedRecipeQuantity = Math.round(ingredientForThisProduct * 100) / 100;
            
            // Planned quantity: ceil of ingredient needed, minimum 1 (since we have orders)
            const ceiledQuantity = Math.max(1, Math.ceil(ingredientForThisProduct));
            
            // Get the cost for this product
            const productCost = productCostMap.get(product.product_id) || 0;
            
            allBakerItems.push({
              production_id: bakerId,
              product_id: product.product_id, // Use actual product ID
              planned_quantity: ceiledQuantity,
              recipe_quantity: roundedRecipeQuantity,
              cost: productCost
            });
          }
        }
      }

      // Batch: Update or insert baker_items (preserving existing records)
      let totalUpdated = 0;
      let totalInserted = 0;
      let totalDeleted = 0;
      
      if (allBakerItems.length > 0) {
        // Group items by baker for efficient processing
        const bakerIds = Array.from(bakerMap.values());
        
        for (const bakerId of bakerIds) {
          const itemsForThisBaker = allBakerItems.filter(item => item.production_id === bakerId);
          
          if (itemsForThisBaker.length === 0) continue;
          
          // Fetch existing baker_items for this baker
          const { data: existingItems, error: fetchError } = await supabase
            .from('baker_items')
            .select('id, product_id, planned_quantity, recipe_quantity, cost')
            .eq('production_id', bakerId);
          
          if (fetchError) throw fetchError;
          
          const existingMap = new Map(
            (existingItems || []).map(item => [item.product_id, item])
          );
          
          const itemsToInsert = [];
          const itemsToUpdate = [];
          
          // Categorize items as update or insert
          for (const newItem of itemsForThisBaker) {
            const existing = existingMap.get(newItem.product_id);
            
            if (existing) {
              // Update existing item
              itemsToUpdate.push({
                id: existing.id,
                planned_quantity: newItem.planned_quantity,
                recipe_quantity: newItem.recipe_quantity,
                cost: newItem.cost
              });
            } else {
              // Insert new item
              itemsToInsert.push(newItem);
            }
          }
          
          // Perform batch updates - update each item individually
          if (itemsToUpdate.length > 0) {
            for (const item of itemsToUpdate) {
              const { error: updateError } = await supabase
                .from('baker_items')
                .update({
                  planned_quantity: item.planned_quantity,
                  recipe_quantity: item.recipe_quantity,
                  cost: item.cost,
                  updated_at: new Date().toISOString()
                })
                .eq('id', item.id);
              
              if (updateError) {
                console.error(`❌ ERROR updating item:`, updateError);
                throw updateError;
              }
            }
            
            totalUpdated += itemsToUpdate.length;
          }
          
          // Perform batch inserts
          if (itemsToInsert.length > 0) {
            const { error: insertError } = await supabase
              .from('baker_items')
              .insert(itemsToInsert);
            
            if (insertError) throw insertError;
            totalInserted += itemsToInsert.length;
          }
          
          // Cleanup: Remove baker_items for products no longer in current orders
          const currentProductIds = itemsForThisBaker.map(item => item.product_id);
          
          if (currentProductIds.length > 0 && existingItems && existingItems.length > 0) {
            const itemsToDelete = existingItems
              .filter(item => !currentProductIds.includes(item.product_id))
              .map(item => item.id);
            
            if (itemsToDelete.length > 0) {
              await supabase
                .from('baker_items')
                .delete()
                .in('id', itemsToDelete);
              totalDeleted += itemsToDelete.length;
            }
          }
        }
      }

      // Log summary
      console.log(`\n✅ SYNC COMPLETE: ${totalUpdated} updated, ${totalInserted} inserted, ${totalDeleted} deleted\n`);

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

