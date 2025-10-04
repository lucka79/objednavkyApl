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
        .order("supplier_id", { ascending: true })
        .order("product_code", { ascending: true })
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

// Hook to get supplier codes grouped by supplier for an ingredient
export const useIngredientSupplierCodesGrouped = (ingredientId?: number) => {
  return useQuery({
    queryKey: ["ingredientSupplierCodesGrouped", ingredientId],
    queryFn: async () => {
      if (!ingredientId) return {};
      
      const { data, error } = await supabase
        .from("ingredient_supplier_codes")
        .select(`
          *,
          supplier:profiles!ingredient_supplier_codes_supplier_id_fkey(id, full_name)
        `)
        .eq("ingredient_id", ingredientId)
        .order("supplier_id", { ascending: true })
        .order("product_code", { ascending: true });

      if (error) throw error;
      
      // Group by supplier_id
      const grouped = (data as IngredientSupplierCode[]).reduce((acc, code) => {
        const supplierId = code.supplier_id;
        if (!acc[supplierId]) {
          acc[supplierId] = {
            supplier: code.supplier,
            codes: []
          };
        }
        acc[supplierId].codes.push(code);
        return acc;
      }, {} as Record<string, { supplier: any; codes: IngredientSupplierCode[] }>);
      
      return grouped;
    },
    enabled: !!ingredientId,
  });
};

// Hook to get all supplier codes across all ingredients
export const useAllSupplierCodes = () => {
  return useQuery({
    queryKey: ["allSupplierCodes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingredient_supplier_codes")
        .select(`
          *,
          supplier:profiles!ingredient_supplier_codes_supplier_id_fkey(id, full_name),
          ingredient:ingredients!ingredient_supplier_codes_ingredient_id_fkey(id, name, unit, ingredient_categories(name), price, product_code)
        `)
        .order("supplier_id", { ascending: true })
        .order("ingredient_id", { ascending: true });

      if (error) throw error;
      return data as (IngredientSupplierCode & {
        ingredient: { id: number; name: string; unit: string; ingredient_categories: { name: string } | null; price: number | null; product_code: string | null };
      })[];
    },
  });
};