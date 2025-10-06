import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

interface ConsumptionItem {
  ingredientId: number;
  ingredientName: string;
  unit: string;
  totalConsumption: number;
  currentQuantity: number;
  newQuantity: number;
  orders: Array<{
    orderId: number;
    productName: string;
    quantity: number;
    consumption: number;
  }>;
}

export const useDailyConsumption = (date: Date) => {
  return useQuery({
    queryKey: ["dailyConsumption", date.toISOString().split('T')[0]],
    queryFn: async (): Promise<ConsumptionItem[]> => {
      const dateStr = date.toISOString().split('T')[0];
      
      // Fetch bakers (production) for the selected date
      const { data: bakers, error: bakersError } = await supabase
        .from('bakers')
        .select(`
          id,
          date,
          recipe_id,
          baker_items!inner(
            id,
            product_id,
            recipe_quantity,
            products!inner(
              id,
              name
            )
          ),
          recipes!inner(
            id,
            recipe_ingredients!inner(
              id,
              ingredient_id,
              quantity,
              ingredients!inner(
                id,
                name,
                unit
              )
            )
          )
        `)
        .eq('date', dateStr)
        .eq('status', 'completed'); // Only completed productions

      if (bakersError) throw bakersError;

      if (!bakers || bakers.length === 0) {
        return [];
      }

      // Calculate consumption for each ingredient
      const consumptionMap = new Map<number, {
        ingredientId: number;
        ingredientName: string;
        unit: string;
        totalConsumption: number;
        currentQuantity: number;
        orders: Array<{
          orderId: number;
          productName: string;
          quantity: number;
          consumption: number;
        }>;
      }>();

      // Process each baker (production)
      for (const baker of bakers) {
        if (!baker.baker_items || baker.baker_items.length === 0) continue;
        if (!baker.recipes || baker.recipes.length === 0) continue;

        const recipe = baker.recipes[0];
        if (!recipe.recipe_ingredients || recipe.recipe_ingredients.length === 0) continue;

        // Process each baker item (product in production)
        for (const bakerItem of baker.baker_items) {
          const product = bakerItem.products;
          
          // Calculate consumption for each ingredient in the recipe
          for (const recipeItem of recipe.recipe_ingredients) {
            const ingredient = recipeItem.ingredients as any;
            // Use recipe_quantity from baker_items instead of order quantity
            const consumption = recipeItem.quantity * bakerItem.recipe_quantity;

            if (consumptionMap.has(ingredient.id)) {
              const existing = consumptionMap.get(ingredient.id)!;
              existing.totalConsumption += consumption;
              existing.orders.push({
                orderId: baker.id, // Using baker id as reference
                productName: (product as any).name,
                quantity: bakerItem.recipe_quantity,
                consumption: consumption,
              });
            } else {
              consumptionMap.set(ingredient.id, {
                ingredientId: ingredient.id,
                ingredientName: ingredient.name,
                unit: ingredient.unit,
                totalConsumption: consumption,
                currentQuantity: 0, // Will be filled from ingredient_quantities
                orders: [{
                  orderId: baker.id,
                  productName: (product as any).name,
                  quantity: bakerItem.recipe_quantity,
                  consumption: consumption,
                }],
              });
            }
          }
        }
      }

      // Get current quantities for all ingredients
      const ingredientIds = Array.from(consumptionMap.keys());
      if (ingredientIds.length > 0) {
        const { data: quantities, error: quantitiesError } = await supabase
          .from('ingredient_quantities')
          .select('ingredient_id, current_quantity')
          .in('ingredient_id', ingredientIds);

        if (quantitiesError) throw quantitiesError;

        // Update current quantities
        for (const quantity of quantities || []) {
          const consumption = consumptionMap.get(quantity.ingredient_id);
          if (consumption) {
            consumption.currentQuantity = quantity.current_quantity;
          }
        }
      }

      // Convert to array and calculate new quantities
      const result: ConsumptionItem[] = Array.from(consumptionMap.values()).map(item => ({
        ...item,
        newQuantity: Math.max(0, item.currentQuantity - item.totalConsumption),
      }));

      return result;
    },
    enabled: !!date,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
