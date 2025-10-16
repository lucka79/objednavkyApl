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
  recipeQuantity?: number; // Saved dough weight from baker_items
  calculatedRecipeWeight?: number; // Calculated weight from current orders
}

export const useDailyProductionPlanner = (date: Date) => {
  return useQuery({
    queryKey: ["dailyProductionPlanner", date.toISOString().split('T')[0]],
    queryFn: async (): Promise<ProductionItem[]> => {
      const dateStr = date.toISOString().split('T')[0];
      
      // Fetch all order_items for the selected date directly
      const { data: orderItems, error: orderItemsError } = await supabase
        .from('order_items')
        .select(`
          id,
          product_id,
          quantity,
          orders!inner(
            id,
            date
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

      if (!orderItems || orderItems.length === 0) {
        console.log('No order items found for date:', dateStr);
        return [];
      }

      console.log('Order items found for date:', dateStr, 'Count:', orderItems.length);

      // Aggregate order quantities by product
      const productQuantities = new Map<number, {
        productId: number;
        productName: string;
        categoryId: number;
        categoryName: string;
        totalOrdered: number;
      }>();

      // Process each order item (skip items with 0 quantity)
      for (const orderItem of orderItems) {
        // Skip order items with 0 quantity
        if (orderItem.quantity <= 0) continue;
        
        const product = (orderItem.products as any);
        const category = (product.categories as any);
        
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

      console.log('Total unique products:', productQuantities.size);
      console.log('Sample product quantities:', Array.from(productQuantities.values()).slice(0, 5));

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
      // Store as array since one product can have multiple recipes
      const recipesByProduct = new Map<number, any[]>();
      if (productParts && !productPartsError) {
        for (const part of productParts) {
          const recipe = (part as any).recipes;
          if (recipe) {
            if (!recipesByProduct.has(part.product_id)) {
              recipesByProduct.set(part.product_id, []);
            }
            recipesByProduct.get(part.product_id)!.push({
              ...recipe,
              quantity: part.quantity // Add quantity from product_parts
            });
          }
        }
      }

      console.log('Product quantities calculated:', Array.from(productQuantities.values()));

      // Fetch baker_items to get recipe_quantity (total dough weight)
      const { data: bakers } = await supabase
        .from('bakers')
        .select(`
          id,
          recipe_id,
          date
        `)
        .eq('date', dateStr);

      const bakerIds = bakers?.map(b => b.id) || [];
      let bakerItemsMap = new Map<string, number>(); // Key: productId-recipeId, Value: recipe_quantity

      if (bakerIds.length > 0) {
        const { data: bakerItems } = await supabase
          .from('baker_items')
          .select(`
            production_id,
            product_id,
            recipe_quantity
          `)
          .in('production_id', bakerIds);

        if (bakerItems) {
          // Get recipe_id for each production
          const productionRecipeMap = new Map(bakers?.map(b => [b.id, b.recipe_id]) || []);
          
          // Sum recipe_quantity for each product-recipe combination
          bakerItems.forEach(item => {
            const recipeId = productionRecipeMap.get(item.production_id);
            if (recipeId && item.recipe_quantity) {
              const key = `${item.product_id}-${recipeId}`;
              const current = bakerItemsMap.get(key) || 0;
              bakerItemsMap.set(key, current + item.recipe_quantity);
            }
          });
        }
      }

      // Convert to production items (for new planning)
      // If a product has multiple recipes, create one item per recipe
      const result: ProductionItem[] = [];
      
      for (const item of productQuantities.values()) {
        const recipes = recipesByProduct.get(item.productId);
        
        if (recipes && recipes.length > 0) {
          // Create one production item for each recipe
          for (const recipe of recipes) {
            const partQuantity = parseFloat(recipe.quantity) || 1;
            const ingredientNeeded = item.totalOrdered * partQuantity;
            // Only set minimum of 1 if there are actual orders
            const plannedQuantity = item.totalOrdered > 0 
              ? Math.max(1, Math.ceil(ingredientNeeded))
              : 0;
            
            // Get recipe_quantity from baker_items
            const key = `${item.productId}-${recipe.id}`;
            const recipeQuantity = bakerItemsMap.get(key);
            
            // Calculate recipe weight from current orders (rounded to 2 decimals)
            const calculatedRecipeWeight = Math.round(ingredientNeeded * 100) / 100;
            
            result.push({
              productId: item.productId,
              productName: item.productName,
              totalOrdered: item.totalOrdered,
              plannedQuantity: plannedQuantity,
              category: item.categoryName,
              hasRecipe: true,
              recipeId: recipe.id,
              recipeName: recipe.name,
              recipeQuantity: recipeQuantity,
              calculatedRecipeWeight: calculatedRecipeWeight,
            });
          }
        } else {
          // No recipe found
          result.push({
            productId: item.productId,
            productName: item.productName,
            totalOrdered: item.totalOrdered,
            plannedQuantity: item.totalOrdered,
            category: item.categoryName,
            hasRecipe: false,
            recipeId: undefined,
            recipeName: 'Bez receptu',
          });
        }
      }

      // Final filter: Remove any items with 0 or negative totalOrdered
      return result.filter(item => item.totalOrdered > 0);
    },
    enabled: !!date,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
