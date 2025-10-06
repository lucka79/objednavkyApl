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
            quantity,
            recipes!product_parts_recipe_id_fkey(
              id,
              name
            )
          `)
          .in('product_id', productIds);

        if (productPartsError) {
          console.warn('Error fetching product_parts:', productPartsError);
        }

        // Batch fetch all category-based recipes
        const categoryIds = [...new Set(userOrders.flatMap(order => 
          order.order_items.map(item => item.products[0]?.categories[0]?.id)
        ))];
        
        const { data: categoryRecipes, error: categoryRecipesError } = await supabase
          .from('recipes')
          .select('id, name, category_id')
          .in('category_id', categoryIds);

        if (categoryRecipesError) {
          console.warn('Error fetching category recipes:', categoryRecipesError);
        }

        // Create lookup maps
        const productPartsMap = new Map();
        if (allProductParts) {
          for (const part of allProductParts) {
            const recipe = (part as any).recipes;
            if (recipe) {
              productPartsMap.set(part.product_id, {
                recipe_id: part.recipe_id,
                quantity: parseFloat(part.quantity),
                recipe_name: recipe.name
              });
            }
          }
        }

        const categoryRecipeMap = new Map();
        if (categoryRecipes) {
          for (const recipe of categoryRecipes) {
            categoryRecipeMap.set(recipe.category_id, {
              id: recipe.id,
              name: recipe.name
            });
          }
        }

        // Group products by recipe_id
        const recipeMap = new Map();
        
        for (const order of userOrders) {
          for (const item of order.order_items) {
            const product = item.products as any;
            const category = product.categories as any;
            
            // Try to find recipe for this specific product first
            let recipeId = 'no-recipe';
            let recipeName = 'Produkt bez receptu';
            
            const productPart = productPartsMap.get(product.id);
            if (productPart) {
              recipeId = productPart.recipe_id;
              recipeName = productPart.recipe_name;
            } else {
              // Fall back to category-based lookup
              const categoryRecipe = categoryRecipeMap.get(category.id);
              if (categoryRecipe) {
                recipeId = categoryRecipe.id;
                recipeName = categoryRecipe.name;
              } else {
                console.warn(`No recipe found for product ${product.name} (category: ${category.name})`);
              }
            }
            
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

        // Create bakers for each recipe
        for (const [recipeId, recipeData] of recipeMap) {

          let bakerId;
          
          if (recipeId === 'no-recipe') {
            // For products without recipes, create a special "Bez receptu" baker
            // First, try to find or create a special recipe for "Bez receptu"
            let { data: bezReceptuRecipe } = await supabase
              .from('recipes')
              .select('id')
              .eq('name', 'Bez receptu')
              .eq('baker', true)
              .single();

            if (!bezReceptuRecipe) {
              // Create a special "Bez receptu" recipe
              const { data: newRecipe, error: recipeCreateError } = await supabase
                .from('recipes')
                .insert({
                  name: 'Bez receptu',
                  baker: true,
                  category_id: recipeData.category_id,
                  quantity: 1,
                  price: 0
                })
                .select('id')
                .single();

              if (recipeCreateError) throw recipeCreateError;
              bezReceptuRecipe = newRecipe;
            }

            // Check if baker already exists for "Bez receptu"
            const { data: existingBaker } = await supabase
              .from('bakers')
              .select('id')
              .eq('date', dateStr)
              .eq('user_id', userId)
              .eq('recipe_id', bezReceptuRecipe.id)
              .single();

            if (existingBaker) {
              bakerId = existingBaker.id;
              // Delete existing baker_items
              const { error: deleteError } = await supabase
                .from('baker_items')
                .delete()
                .eq('production_id', bakerId);
              
              if (deleteError) throw deleteError;
            } else {
              // Create new "Bez receptu" baker
              const { data: newBaker, error: createError } = await supabase
                .from('bakers')
                .insert({
                  date: dateStr,
                  user_id: userId,
                  recipe_id: bezReceptuRecipe.id,
                  notes: `Bez receptu - kategorie: ${recipeData.category_name}`
                })
                .select('id')
                .single();

              if (createError) throw createError;
              bakerId = newBaker.id;
            }
          } else {
            // Check if baker already exists for this recipe
            const { data: existingBaker } = await supabase
              .from('bakers')
              .select('id')
              .eq('date', dateStr)
              .eq('user_id', userId)
              .eq('recipe_id', recipeId)
              .single();

            if (existingBaker) {
              // Update existing baker
              const { error: updateError } = await supabase
                .from('bakers')
                .update({
                  notes: `Manuálně synchronizováno pro recept: ${recipeData.recipe_name}`,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingBaker.id);
              
              if (updateError) throw updateError;
              bakerId = existingBaker.id;

              // Delete existing baker_items
              const { error: deleteError } = await supabase
                .from('baker_items')
                .delete()
                .eq('production_id', bakerId);
              
              if (deleteError) throw deleteError;
            } else {
              // Create new baker
              const { data: newBaker, error: createError } = await supabase
                .from('bakers')
                .insert({
                  date: dateStr,
                  user_id: userId,
                  recipe_id: recipeId,
                  notes: `Manuálně vytvořené pro recept: ${recipeData.recipe_name}`
                })
                .select('id')
                .single();

              if (createError) throw createError;
              bakerId = newBaker.id;
            }
          }

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
          
          // Create single baker_item with summed quantities
          const bakerItems = [{
            production_id: bakerId,
            product_id: null, // No specific product since we're summing all
            planned_quantity: Math.max(1, Math.ceil(totalIngredientNeeded)), // Total ingredient quantity needed
            recipe_quantity: Math.max(1, Math.ceil(totalIngredientNeeded)),
            notes: `Sum of all products: ${productDetails.map(p => `${p.product_name}(${p.ordered_quantity}×${p.part_quantity}=${p.ingredient_needed.toFixed(2)})`).join(', ')}`
          }];

          if (bakerItems.length > 0) {
            const { error: itemsError } = await supabase
              .from('baker_items')
              .insert(bakerItems);

            if (itemsError) throw itemsError;
          }

          results.push({
            baker_id: bakerId,
            category_name: recipeData.recipe_name,
            total_products: bakerItems.length,
            total_quantity: bakerItems.reduce((sum, item) => sum + item.planned_quantity, 0)
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
