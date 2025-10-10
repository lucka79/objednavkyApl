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
      
      // First, get all orders for this date
      let { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          user_id,
          date,
          status,
          order_items!inner(
            id,
            product_id,
            quantity,
            products!inner(
              id,
              name,
              category_id,
              categories!inner(
                id,
                name
              )
            )
          )
        `)
        .eq('date', dateStr);

      if (ordersError) throw ordersError;

      console.log('Debug - Orders found:', orders?.length || 0);
      console.log('Debug - Date:', dateStr);
      console.log('Debug - Processing all users');
      console.log('Debug - Selected date from UI:', date.toISOString().split('T')[0]);
      
      // Debug: Check what dates have orders
      const { data: availableDates } = await supabase
        .from('orders')
        .select('date')
        .order('date', { ascending: false })
        .limit(10);
      console.log('Debug - Available order dates:', availableDates?.map(d => d.date));
      
      if (!orders || orders.length === 0) {
        const availableDatesList = availableDates?.map(d => d.date).join(', ') || 'none';
        throw new Error(`Žádné objednávky pro vybraný den: ${dateStr}. Dostupné dny: ${availableDatesList}`);
      }

      // Process all orders together since uniqueness is only on (date, recipe_id)
      // Get all product IDs from all orders
      const allProductIds = orders.flatMap(order => 
        order.order_items.map(item => item.product_id)
      );
      
      // Get all unique users for the results
      const usersWithOrders = new Set(orders.map(order => order.user_id));
      const results: SyncResult[] = [];

      // Batch fetch all product_parts data for all products
      const { data: allProductParts, error: productPartsError } = await supabase
        .from('product_parts')
        .select(`
          product_id,
          recipe_id,
          quantity
        `)
        .in('product_id', allProductIds);

      if (productPartsError) {
        console.warn('Error fetching product_parts:', productPartsError);
      }

      // Create lookup map for product_parts
      const productPartsMap = new Map();
      if (allProductParts) {
        console.log(`Debug - Product parts found: ${allProductParts.length}`);
        for (const part of allProductParts) {
          // Only add to map if recipe_id is not null
          if (part.recipe_id !== null && part.recipe_id !== undefined) {
            productPartsMap.set(part.product_id, {
              recipe_id: part.recipe_id,
              quantity: parseFloat(part.quantity)
            });
          } else {
            console.log(`Debug - Skipping product ${part.product_id} - has NULL recipe_id`);
          }
        }
        console.log(`Debug - Product parts map size: ${productPartsMap.size}`);
        console.log(`Debug - Sample entries:`, Array.from(productPartsMap.entries()).slice(0, 5));
      } else {
        console.warn('Debug - No product parts data received');
      }

      // Group products by recipe_id (across all users)
      const recipeMap = new Map();
      
      for (const order of orders) {
        for (const item of order.order_items) {
          const product = item.products as any;
          const category = product.categories as any;
          
          // Check if product has entry in product_parts table
          let recipeId = 'no-recipe';
          let recipeName = 'Bez receptu';
          
          const productPart = productPartsMap.get(product.id);
          if (productPart) {
            recipeId = productPart.recipe_id;
            recipeName = `Recipe ${productPart.recipe_id}`;
            console.log(`Debug - Product ${product.id} (${product.name}) found in product_parts: Recipe ${recipeId}`);
          } else {
            console.log(`Debug - Product ${product.id} (${product.name}) NOT found in product_parts - goes to Bez receptu`);
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

        console.log(`Debug - Checking baker for date ${dateStr}, recipe ${recipeId}:`, existingBaker ? `Found ID ${existingBaker.id} (user: ${existingBaker.user_id})` : 'Not found');

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

          // Delete existing baker_items for this baker
          await supabase
            .from('baker_items')
            .delete()
            .eq('production_id', bakerId);
        } else {
          // Create new baker
          const firstUserId = Array.from(usersWithOrders)[0]; // Use first user
          console.log(`Debug - Creating new baker for user ${firstUserId}, date ${dateStr}, recipe ${recipeId}`);
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
            console.error(`Debug - Error creating baker:`, createError);
            throw createError;
          }
          bakerId = newBaker.id;
          console.log(`Debug - Created baker with ID ${bakerId}`);
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
            
            allBakerItems.push({
              production_id: bakerId,
              product_id: product.product_id, // Use actual product ID
              planned_quantity: Math.max(1, Math.ceil(ingredientForThisProduct)),
              recipe_quantity: Math.max(1, Math.ceil(ingredientForThisProduct))
            });
          }
        }
      }

      // Batch: Insert all baker_items at once
      if (allBakerItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('baker_items')
          .insert(allBakerItems);

        if (itemsError) throw itemsError;
      }

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
        description: `Manuálně synchronizováno ${totalBakers} produkčních plánů s ${totalProducts} produkty (${totalQuantity} ks)`,
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
