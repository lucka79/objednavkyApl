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
      
      // Fetch all orders for the selected date to show in UI
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
