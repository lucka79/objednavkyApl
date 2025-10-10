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

export const useMonthlyIngredientConsumptionFromBakers = (startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: ["monthlyIngredientConsumptionFromBakers", startDate?.toISOString(), endDate?.toISOString()],
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

      console.log("Fetching baker production data for months:", months);

      // Calculate consumption by month and ingredient from baker production data
      const monthlyConsumptionMap = new Map<string, Map<number, MonthlyConsumption>>();

      // Fetch data month by month to avoid hitting row limits
      for (const monthKey of months) {
        const [year, month] = monthKey.split('-');
        const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
        const monthEnd = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
        
        // For incomplete months, use all days to current day + 1
        const today = new Date();
        const isCurrentMonth = monthStart.getMonth() === today.getMonth() && 
                              monthStart.getFullYear() === today.getFullYear();
        
        let endDateForQuery = monthEnd;
        if (isCurrentMonth) {
          // Use current day + 1 for incomplete months
          endDateForQuery = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        }
        
        const startDateStr = monthStart.toISOString().split('T')[0];
        const endDateStr = endDateForQuery.toISOString().split('T')[0];

        console.log(`Fetching baker production for ${monthKey}: ${startDateStr} to ${endDateStr}`);

        // Fetch baker production data for this month
        const { data: bakerProductions, error: bakerError } = await supabase
          .from("bakers")
          .select(`
            id,
            date,
            recipe_id,
            baker_items(
              id,
              product_id,
              planned_quantity,
              recipe_quantity,
              products(
                id,
                name,
                product_parts(
                  id,
                  ingredient_id,
                  quantity,
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
                )
              )
            )
          `)
          .gte('date', startDateStr)
          .lte('date', endDateStr);

        if (bakerError) {
          console.error(`Error fetching baker productions for ${monthKey}:`, bakerError);
          continue;
        }

        if (!bakerProductions || bakerProductions.length === 0) {
          console.log(`No baker productions found for ${monthKey}`);
          continue;
        }

        console.log(`Baker productions found for ${monthKey}:`, bakerProductions.length);

        // Process baker production data to calculate ingredient consumption
        bakerProductions.forEach((production) => {
          if (!production.baker_items || production.baker_items.length === 0) return;
          
          production.baker_items.forEach((item) => {
            if (!item.products || !Array.isArray(item.products) || item.products.length === 0) return;

            // Process each product
            item.products.forEach((product) => {
              if (!product.product_parts || product.product_parts.length === 0) return;

              // Process each ingredient in this product
              product.product_parts.forEach((part: any) => {
                if (!part.ingredients || !part.ingredient_id) return;

                const ingredient = part.ingredients as any;
                const ingredientId = part.ingredient_id;
                
                // Calculate consumption: 
                // planned_quantity (number of products) * ingredient_quantity_per_product
                const consumption = item.planned_quantity * part.quantity;

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

      console.log("Monthly consumption from bakers calculated:", result.length, "months");
      console.log("Total unique ingredients across all months:", 
        new Set(result.flatMap(r => r.ingredients.map(i => i.ingredientId))).size);

      return result;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: true, // Always enabled
  });
};
