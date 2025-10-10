import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useCalculateMonthlyConsumptionFromProduction } from "./useDailyIngredientConsumption";

export interface CurrentMonthConsumption {
  ingredientId: number;
  totalQuantity: number;
}

export const useCurrentMonthConsumption = () => {
  // const queryClient = useQueryClient();
  const calculateMonthlyFromProduction = useCalculateMonthlyConsumptionFromProduction();

  return useQuery({
    queryKey: ["currentMonthConsumption"],
    queryFn: async (): Promise<CurrentMonthConsumption[]> => {
      // Calculate date range: 1st day of current month till tomorrow
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      // Fix timezone issue by using local date formatting
      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatLocalDate(firstDayOfMonth);
      const endDateStr = formatLocalDate(tomorrow);

      console.log(`Auto-calculating consumption from ${startDateStr} to ${endDateStr}`);

      // First, trigger the calculation to ensure data is up to date
      try {
        await calculateMonthlyFromProduction.mutateAsync({
          startDate: firstDayOfMonth,
          endDate: tomorrow,
        });
        console.log("Monthly consumption calculation completed automatically");
      } catch (error) {
        console.warn("Auto-calculation failed, proceeding with existing data:", error);
      }

      // Now fetch the calculated consumption from the database
      const { data: consumptionData, error: consumptionError } = await supabase
        .from("daily_ingredient_consumption")
        .select(`
          ingredient_id,
          quantity
        `)
        .gte('date', startDateStr)
        .lte('date', endDateStr);

      if (consumptionError) {
        console.error("Error fetching consumption data:", consumptionError);
        throw consumptionError;
      }

      if (!consumptionData || consumptionData.length === 0) {
        console.log("No consumption data found in database");
        return [];
      }

      // Aggregate consumption by ingredient
      const consumptionMap = new Map<number, number>();
      
      consumptionData.forEach((item) => {
        const ingredientId = item.ingredient_id;
        const quantity = item.quantity || 0;
        
        if (consumptionMap.has(ingredientId)) {
          consumptionMap.set(ingredientId, consumptionMap.get(ingredientId)! + quantity);
        } else {
          consumptionMap.set(ingredientId, quantity);
        }
      });

      // Convert to array
      const result = Array.from(consumptionMap.entries()).map(([ingredientId, totalQuantity]) => ({
        ingredientId,
        totalQuantity,
      }));

      console.log(`Current month consumption loaded for ${result.length} ingredients`);
      return result;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: true,
  });
};
