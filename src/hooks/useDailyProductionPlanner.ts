import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

interface ProductionItem {
  productId: number;
  productName: string;
  totalOrdered: number;
  plannedQuantity: number;
  actualQuantity?: number;
  completedQuantity?: number;
  category: string;
  hasRecipe: boolean;
  recipeId?: number;
  recipeName?: string;
  bakerId?: number;
  bakerStatus?: string;
  bakerNotes?: string;
  isCompleted?: boolean;
}

export const useDailyProductionPlanner = (date: Date) => {
  return useQuery({
    queryKey: ["dailyProductionPlanner", date.toISOString().split('T')[0]],
    queryFn: async (): Promise<ProductionItem[]> => {
      const dateStr = date.toISOString().split('T')[0];
      
      // First, check if baker productions already exist for this date
      const { data: bakersOnly, error: bakersOnlyError } = await supabase
        .from('bakers')
        .select('id, date, recipe_id, status, notes, user_id')
        .eq('date', dateStr);
      
      if (bakersOnlyError) throw bakersOnlyError;
      
      if (!bakersOnly || bakersOnly.length === 0) {
        // Continue to orders logic below...
      } else {
        // Now fetch baker_items separately
        const { data: bakerItems, error: bakerItemsError } = await supabase
          .from('baker_items')
          .select(`
            id,
            production_id,
            product_id,
            planned_quantity,
            recipe_quantity,
            actual_quantity,
            completed_quantity,
            products(
              id,
              name,
              category_id,
              categories(
                id,
                name
              )
            )
          `)
          .in('production_id', bakersOnly.map(b => b.id));
        
        if (bakerItemsError) throw bakerItemsError;
        
        // Combine the data
        const existingBakers = bakersOnly.map(baker => ({
          ...baker,
          baker_items: bakerItems?.filter(item => item.production_id === baker.id) || []
        }));

        // If baker productions exist, use them
        if (existingBakers && existingBakers.length > 0) {
          // Fetch recipe names for existing bakers
          const recipeIds = [...new Set(existingBakers.map(baker => baker.recipe_id))];
          const { data: recipes, error: recipesError } = await supabase
            .from('recipes')
            .select('id, name')
            .in('id', recipeIds);
          
          if (recipesError) throw recipesError;
          
          const recipeMap = new Map();
          for (const recipe of recipes || []) {
            recipeMap.set(recipe.id, recipe.name);
          }
          
          const result: ProductionItem[] = [];
          
          for (const baker of existingBakers) {
            if (baker.baker_items && baker.baker_items.length > 0) {
              for (const bakerItem of baker.baker_items) {
                const product = bakerItem.products as any;
                const category = product.categories as any;
                
                result.push({
                  productId: product.id,
                  productName: product.name,
                  totalOrdered: 0, // We don't have order data in this case
                  plannedQuantity: bakerItem.planned_quantity,
                  actualQuantity: bakerItem.actual_quantity,
                  completedQuantity: bakerItem.completed_quantity,
                  category: category.name,
                  hasRecipe: true, // If it's in baker_items, it has a recipe
                  recipeId: baker.recipe_id,
                  recipeName: recipeMap.get(baker.recipe_id) || `Recipe ${baker.recipe_id}`,
                  bakerId: baker.id,
                  bakerStatus: baker.status,
                  bakerNotes: baker.notes,
                  isCompleted: baker.status === 'completed',
                });
              }
            }
          }
          
          return result;
        }
      }

      // If no bakers exist, fetch orders for planning
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
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
        // Remove status filter to include all orders

      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) {
        console.log('No orders found for date:', dateStr);
        return [];
      }

      console.log('Orders found for date:', dateStr, 'Count:', orders.length);

      // Aggregate order quantities by product
      const productQuantities = new Map<number, {
        productId: number;
        productName: string;
        categoryId: number;
        categoryName: string;
        totalOrdered: number;
      }>();

      // Process each order
      for (const order of orders) {
        for (const orderItem of order.order_items) {
          const product = orderItem.products as any;
          const category = product.categories as any;
          
          if (productQuantities.has(product.id)) {
            const existing = productQuantities.get(product.id)!;
            existing.totalOrdered += orderItem.quantity;
          } else {
            productQuantities.set(product.id, {
              productId: product.id,
              productName: product.name,
              categoryId: category.id,
              categoryName: category.name,
              totalOrdered: orderItem.quantity,
            });
          }
        }
      }

      // Fetch product parts to get actual recipes for each product
      const productIds = Array.from(productQuantities.keys());
      const { data: productParts, error: productPartsError } = await supabase
        .from('product_parts')
        .select(`
          product_id,
          recipe_id,
          quantity,
          recipes!inner(
            id,
            name,
            baker,
            category_id,
            categories!inner(
              id,
              name
            )
          )
        `)
        .in('product_id', productIds);

      // Create recipe lookup by product ID (from product_parts)
      const recipeByProduct = new Map<number, any>();
      if (productParts && !productPartsError) {
        for (const part of productParts) {
          const recipe = (part as any).recipes;
          if (recipe) {
            recipeByProduct.set(part.product_id, recipe);
          }
        }
      }

      // Fallback: Fetch recipes by category for products without product_parts
      const { data: recipes, error: recipesError } = await supabase
        .from('recipes')
        .select(`
          id,
          name,
          category_id,
          baker,
          categories!inner(
            id,
            name
          )
        `);

      if (recipesError) throw recipesError;

      // Create recipe lookup by category ID (fallback)
      const recipeByCategory = new Map<number, any>();
      for (const recipe of recipes || []) {
        const category = (recipe as any).categories;
        if (category) {
          recipeByCategory.set(category.id, recipe);
        }
      }


      console.log('Product quantities calculated:', Array.from(productQuantities.values()));

      // Convert to production items (for new planning)
      const result: ProductionItem[] = Array.from(productQuantities.values()).map(item => {
        let recipe = recipeByProduct.get(item.productId);
        let hasRecipe = !!recipe;
        
        // If no product-specific recipe, try category-based fallback
        if (!recipe) {
          recipe = recipeByCategory.get(item.categoryId);
          hasRecipe = !!recipe;
        }
        
        // Calculate planned quantity based on ingredient needs
        let plannedQuantity = item.totalOrdered; // Default to ordered quantity
        
        if (recipe) {
          // Try to find product_parts quantity for this specific product
          const productPart = recipeByProduct.get(item.productId);
          if (productPart) {
            const partQuantity = parseFloat(productPart.quantity) || 1;
            const ingredientNeeded = item.totalOrdered * partQuantity;
            plannedQuantity = Math.max(1, Math.ceil(ingredientNeeded));
          }
        }
        
        return {
          productId: item.productId,
          productName: item.productName,
          totalOrdered: item.totalOrdered,
          plannedQuantity: plannedQuantity,
          category: item.categoryName,
          hasRecipe,
          recipeId: recipe?.id,
          recipeName: recipe?.name || 'Produkt bez receptu',
        };
      });

      return result;
    },
    enabled: !!date,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
