import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface MonthlyConsumption {
  month: string; // YYYY-MM format
  ingredientId: number;
  ingredientName: string;
  totalQuantity: number;
  unit: string;
  categoryName?: string;
  supplierName?: string;
}

export interface MonthlyConsumptionSummary {
  month: string;
  ingredients: {
    ingredientId: number;
    ingredientName: string;
    totalQuantity: number;
    unit: string;
    categoryName?: string;
    supplierName?: string;
  }[];
}

export const useMonthlyIngredientConsumption = (startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: ["monthlyIngredientConsumption", startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<MonthlyConsumptionSummary[]> => {
      // Generate list of months to fetch
      const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth() - 6, 1);
      const end = endDate || new Date();
      
      const months: string[] = [];
      const currentMonth = new Date(start.getFullYear(), start.getMonth(), 1);
      
      while (currentMonth <= end) {
        const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
        months.push(monthKey);
        currentMonth.setMonth(currentMonth.getMonth() + 1);
      }

      console.log("Fetching data for months:", months);

      // Calculate consumption by month and ingredient
      const monthlyConsumptionMap = new Map<string, Map<number, MonthlyConsumption>>();

      // Fetch data month by month to avoid hitting row limits
      for (const monthKey of months) {
        const [year, month] = monthKey.split('-');
        const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
        const monthEnd = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
        
        const startDateStr = monthStart.toISOString().split('T')[0];
        const endDateStr = monthEnd.toISOString().split('T')[0];

        console.log(`Fetching orders for ${monthKey}: ${startDateStr} to ${endDateStr}`);

        // Fetch ALL order items for this month using pagination
        let allOrderItems: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const from = page * pageSize;
          const to = from + pageSize - 1;

          const { data: orderItemsBatch, error: orderItemsError } = await supabase
            .from("order_items")
            .select(`
              id,
              quantity,
              product_id,
              orders!inner(
                id,
                date,
                status
              ),
              products!inner(
                id,
                name
              )
            `)
            .gte('orders.date', startDateStr)
            .lte('orders.date', endDateStr)
            .range(from, to)
            .order('id', { ascending: true });

          if (orderItemsError) {
            console.error(`Error fetching order items for ${monthKey} (page ${page}):`, orderItemsError);
            break;
          }

          if (!orderItemsBatch || orderItemsBatch.length === 0) {
            hasMore = false;
            break;
          }

          allOrderItems = allOrderItems.concat(orderItemsBatch);
          
          // If we got less than pageSize, we've reached the end
          if (orderItemsBatch.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        }

        if (allOrderItems.length === 0) {
          console.log(`No order items found for ${monthKey}`);
          continue;
        }

        console.log(`Order items found for ${monthKey}:`, allOrderItems.length);

        // Get unique product IDs for this month
        const productIds = [...new Set(allOrderItems.map((item) => item.product_id))];

        // Fetch product parts with ingredients for these products (with pagination if needed)
        let allProductParts: any[] = [];
        
        // Split productIds into chunks to avoid URL length limits
        const chunkSize = 100;
        for (let i = 0; i < productIds.length; i += chunkSize) {
          const productIdChunk = productIds.slice(i, i + chunkSize);
          
          const { data: productParts, error: productPartsError } = await supabase
            .from("product_parts")
            .select(`
              id,
              product_id,
              ingredient_id,
              recipe_id,
              quantity,
              productOnly,
              bakerOnly,
              ingredients(
                id,
                name,
                unit,
                ingredient_categories(
                  id,
                  name
                ),
                supplier:profiles!ingredients_supplier_id_fkey(
                  id,
                  full_name
                )
              )
            `)
            .in("product_id", productIdChunk)
            .not("ingredient_id", "is", null);

          if (productPartsError) {
            console.error(`Error fetching product parts for ${monthKey} (chunk ${i / chunkSize}):`, productPartsError);
            continue;
          }

          if (productParts) {
            allProductParts = allProductParts.concat(productParts);
          }
        }

        console.log(`Product parts found for ${monthKey}:`, allProductParts.length);

        // Create a map of product_id to its ingredient parts
        const productIngredientMap = new Map<number, any[]>();
        
        allProductParts.forEach((part) => {
          if (!productIngredientMap.has(part.product_id)) {
            productIngredientMap.set(part.product_id, []);
          }
          productIngredientMap.get(part.product_id)!.push(part);
        });

        // Process order items for this month
        allOrderItems.forEach((orderItem) => {
          const ingredientParts = productIngredientMap.get(orderItem.product_id) || [];

          ingredientParts.forEach((part) => {
            if (!part.ingredients || !part.ingredient_id) return;

            const ingredient = part.ingredients as any;
            const ingredientId = part.ingredient_id;
            
            // Calculate consumption: order quantity * ingredient quantity in product
            const consumption = orderItem.quantity * part.quantity;

            if (!monthlyConsumptionMap.has(monthKey)) {
              monthlyConsumptionMap.set(monthKey, new Map());
            }

            const monthMap = monthlyConsumptionMap.get(monthKey)!;

            if (monthMap.has(ingredientId)) {
              const existing = monthMap.get(ingredientId)!;
              existing.totalQuantity += consumption;
            } else {
              monthMap.set(ingredientId, {
                month: monthKey,
                ingredientId: ingredientId,
                ingredientName: ingredient.name,
                totalQuantity: consumption,
                unit: ingredient.unit || "kg",
                categoryName: ingredient.ingredient_categories?.name,
                supplierName: ingredient.supplier?.full_name,
              });
            }
          });
        });
      }

      // Convert to array format
      const result: MonthlyConsumptionSummary[] = [];

      for (const [month, ingredientsMap] of monthlyConsumptionMap) {
        const ingredients = Array.from(ingredientsMap.values()).sort((a, b) =>
          a.ingredientName.localeCompare(b.ingredientName)
        );

        result.push({
          month,
          ingredients,
        });
      }

      // Sort by month descending (most recent first)
      result.sort((a, b) => b.month.localeCompare(a.month));

      console.log("Monthly consumption calculated:", result.length, "months");
      console.log("Total unique ingredients across all months:", 
        new Set(result.flatMap(r => r.ingredients.map(i => i.ingredientId))).size);

      return result;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: true, // Always enabled
  });
};

