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

      // Process each order item
      for (const orderItem of orderItems) {
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
      const recipeByProduct = new Map<number, any>();
      if (productParts && !productPartsError) {
        for (const part of productParts) {
          const recipe = (part as any).recipes;
          if (recipe) {
            recipeByProduct.set(part.product_id, {
              ...recipe,
              quantity: part.quantity // Add quantity from product_parts
            });
          }
        }
      }

      console.log('Product quantities calculated:', Array.from(productQuantities.values()));

      // Convert to production items (for new planning)
      const result: ProductionItem[] = Array.from(productQuantities.values()).map(item => {
        // Only use recipe from product_parts table, no category fallback
        const recipe = recipeByProduct.get(item.productId);
        const hasRecipe = !!recipe;
        
        // Calculate planned quantity based on ingredient needs
        let plannedQuantity = item.totalOrdered; // Default to ordered quantity
        
        if (recipe) {
          // Use product_parts quantity for this specific product
          const partQuantity = parseFloat(recipe.quantity) || 1;
          const ingredientNeeded = item.totalOrdered * partQuantity;
          plannedQuantity = Math.max(1, Math.ceil(ingredientNeeded));
        }
        
        return {
          productId: item.productId,
          productName: item.productName,
          totalOrdered: item.totalOrdered,
          plannedQuantity: plannedQuantity,
          category: item.categoryName,
          hasRecipe,
          recipeId: recipe?.id,
          recipeName: recipe?.name || 'Bez receptu',
        };
      });

      return result;
    },
    enabled: !!date,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
