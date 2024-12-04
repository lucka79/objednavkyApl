import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const useStoredItems = (userId: string) => {
  return useQuery({
    queryKey: ['stored_items', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stored_items')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
};
