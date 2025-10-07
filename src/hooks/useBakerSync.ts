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

      // Group by user and create bakers for each user
      const usersWithOrders = new Set(orders.map(order => order.user_id));
      const results = [];

      for (const userId of usersWithOrders) {
        const userOrders = orders.filter(order => order.user_id === userId);
        
        // Get all product IDs for this user's orders
        const productIds = userOrders.flatMap(order => 
          order.order_items.map(item => item.product_id)
        );
        
        // Batch fetch all product_parts data
        const { data: allProductParts, error: productPartsError } = await supabase
          .from('product_parts')
          .select(`
            product_id,
            recipe_id,
            quantity
          `)
          .in('product_id', productIds);

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

        // Group products by recipe_id
        const recipeMap = new Map();
        
        for (const order of userOrders) {
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

        // Batch: Get all unique recipe IDs we need to process
        const recipeIds = Array.from(recipeMap.keys()).filter(id => id !== 'no-recipe');
        
        if (recipeIds.length === 0) {
          console.warn('No recipes with valid recipe_id found');
          continue;
        }

        // Batch: Find all existing bakers for these recipes and user
        const { data: existingBakers } = await supabase
          .from('bakers')
          .select('id, recipe_id')
          .eq('date', dateStr)
          .eq('user_id', userId)
          .in('recipe_id', recipeIds);

        // Create a map of recipe_id -> baker_id
        const existingBakerMap = new Map();
        if (existingBakers) {
          for (const baker of existingBakers) {
            existingBakerMap.set(baker.recipe_id, baker.id);
          }
        }

        // Prepare arrays for batch operations
        const bakersToCreate = [];
        const bakersToUpdate = [];
        const bakerIdsToDelete = [];

        // Create bakers for each recipe
        for (const [recipeId, recipeData] of recipeMap) {

          if (recipeId === 'no-recipe') {
            console.warn(`Skipping products without recipes: ${recipeData.recipe_name}`);
            continue;
          }

          const existingBakerId = existingBakerMap.get(recipeId);

          if (existingBakerId) {
            // Update existing baker
            bakersToUpdate.push({
              id: existingBakerId,
              notes: `Manuálně synchronizováno pro recept: ${recipeData.recipe_name}`,
              updated_at: new Date().toISOString()
            });
            bakerIdsToDelete.push(existingBakerId);
          } else {
            // Prepare new baker for creation
            bakersToCreate.push({
              date: dateStr,
              user_id: userId,
              recipe_id: recipeId,
              notes: `Manuálně vytvořené pro recept: ${recipeData.recipe_name}`,
              _recipeData: recipeData  // Temporary field to track recipe data
            });
          }
        }

        // Batch: Update existing bakers
        if (bakersToUpdate.length > 0) {
          for (const baker of bakersToUpdate) {
            await supabase
              .from('bakers')
              .update({
                notes: baker.notes,
                updated_at: baker.updated_at
              })
              .eq('id', baker.id);
          }
        }

        // Batch: Delete old baker_items
        if (bakerIdsToDelete.length > 0) {
          await supabase
            .from('baker_items')
            .delete()
            .in('production_id', bakerIdsToDelete);
        }

        // Batch: Create new bakers
        let newBakers: Array<{ id: number; recipe_id: number }> = [];
        if (bakersToCreate.length > 0) {
          const bakersData = bakersToCreate.map(b => ({
            date: b.date,
            user_id: b.user_id,
            recipe_id: b.recipe_id,
            notes: b.notes
          }));
          
          const { data, error: createError } = await supabase
            .from('bakers')
            .insert(bakersData)
            .select('id, recipe_id');

          if (createError) throw createError;
          newBakers = data || [];
        }

        // Map new bakers to their recipe_ids
        for (const newBaker of newBakers) {
          existingBakerMap.set(newBaker.recipe_id, newBaker.id);
        }

        // Now create baker_items for all recipes
        const allBakerItems = [];
        
        for (const [recipeId, recipeData] of recipeMap) {
          if (recipeId === 'no-recipe') continue;

          const bakerId = existingBakerMap.get(recipeId);
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

          const bakerId = existingBakerMap.get(recipeId);
          if (!bakerId) continue;

          const recipeItems = allBakerItems.filter(item => item.production_id === bakerId);
          
          results.push({
            baker_id: bakerId,
            category_name: recipeData.recipe_name,
            total_products: recipeItems.length,
            total_quantity: recipeItems.reduce((sum, item) => sum + item.planned_quantity, 0)
          });
        }
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
