import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const useAvailableProductionDates = () => {
  return useQuery({
    queryKey: ["availableProductionDates"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('bakers')
        .select('date')
        .order('date', { ascending: false });

      if (error) throw error;

      // Return unique dates
      const uniqueDates = [...new Set(data?.map(item => item.date) || [])];
      return uniqueDates;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
