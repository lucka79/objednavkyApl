import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface IngredientSupplierCode {
  id: number;
  ingredient_id: number;
  supplier_id: string;
  product_code: string;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  supplier?: {
    id: string;
    full_name: string;
  };
}

export const useIngredientSupplierCodes = (ingredientId?: number) => {
  return useQuery({
    queryKey: ["ingredientSupplierCodes", ingredientId],
    queryFn: async () => {
      if (!ingredientId) return [];
      
      const { data, error } = await supabase
        .from("ingredient_supplier_codes")
        .select(`
          *,
          supplier:profiles!ingredient_supplier_codes_supplier_id_fkey(id, full_name)
        `)
        .eq("ingredient_id", ingredientId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as IngredientSupplierCode[];
    },
    enabled: !!ingredientId,
  });
};

export const useCreateIngredientSupplierCode = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      ingredient_id: number;
      supplier_id: string;
      product_code: string;
      price: number;
      is_active?: boolean;
    }) => {
      const { data: result, error } = await supabase
        .from("ingredient_supplier_codes")
        .insert([data])
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ["ingredientSupplierCodes", variables.ingredient_id] 
      });
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
    },
  });
};

export const useUpdateIngredientSupplierCode = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      updates 
    }: { 
      id: number; 
      updates: Partial<{
        supplier_id: string;
        product_code: string;
        price: number;
        is_active: boolean;
      }> 
    }) => {
      const { data, error } = await supabase
        .from("ingredient_supplier_codes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ["ingredientSupplierCodes", data.ingredient_id] 
      });
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
    },
  });
};

export const useDeleteIngredientSupplierCode = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("ingredient_supplier_codes")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredientSupplierCodes"] });
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
    },
  });
};

// Hook to get active supplier code for an ingredient
export const useActiveIngredientSupplierCode = (ingredientId?: number) => {
  return useQuery({
    queryKey: ["activeIngredientSupplierCode", ingredientId],
    queryFn: async () => {
      if (!ingredientId) return null;
      
      const { data, error } = await supabase
        .from("ingredient_supplier_codes")
        .select(`
          *,
          supplier:profiles!ingredient_supplier_codes_supplier_id_fkey(id, full_name)
        `)
        .eq("ingredient_id", ingredientId)
        .eq("is_active", true)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      return data as IngredientSupplierCode | null;
    },
    enabled: !!ingredientId,
  });
};
