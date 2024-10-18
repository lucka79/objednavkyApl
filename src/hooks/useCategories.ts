import { supabase } from "@/lib/supabase";
import { useQuery} from "@tanstack/react-query";

// CategoryBadges
export const getCategories = () => {
    return useQuery({
      queryKey: ["categories"],
      queryFn: async () => {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order("name", {ascending: true})
        if (error) throw error;
        return data;
      },
    });
  };