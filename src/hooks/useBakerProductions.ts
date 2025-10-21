import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

interface BakerProductionData {
  date: string;
  recipe_id: number;
  status: string;
  notes?: string;
}

interface BakerItemData {
  production_id: number;
  product_id: number;
  planned_quantity: number;
  recipe_quantity: number;
}

export const useCreateBakerProduction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: BakerProductionData) => {
      const { data: baker, error } = await supabase
        .from('bakers')
        .insert({
          date: data.date,
          recipe_id: data.recipe_id,
          status: data.status,
          notes: data.notes,
        })
        .select()
        .single();

      if (error) throw error;
      return baker;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bakers"] });
      queryClient.invalidateQueries({ queryKey: ["dailyProductionPlanner"] });
    },
  });
};

export const useCreateBakerItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: BakerItemData[]) => {
      const { data, error } = await supabase
        .from('baker_items')
        .insert(items)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["baker_items"] });
      queryClient.invalidateQueries({ queryKey: ["dailyProductionPlanner"] });
    },
  });
};
