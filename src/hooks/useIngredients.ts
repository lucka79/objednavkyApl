import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";

export interface Ingredient {
  id: number;
  name: string;
  active: boolean;
  category_id: number | null;
  ean: string | null;
  product_code: string | null;
  kiloPerUnit: number;
  package: number | null;
  price: number | null;
  storeOnly: boolean;
  unit: string;
  vat: number | null;
  created_at: string;
  // Nutritional fields
  kJ: number;
  kcal: number;
  fat: number;
  saturates: number;
  carbohydrate: number;
  sugars: number;
  protein: number;
  fibre: number;
  salt: number;
  element: string | null;
  supplier_id: string | null;
  // Multiple supplier codes
  supplier_codes?: Array<{
    id?: number;
    supplier_id: string;
    product_code: string;
    price: number;
    package: number | null;
    is_active: boolean;
  }>;
}

export interface IngredientCategory {
  id: number;
  name: string;
  created_at: string;
}

export interface IngredientWithCategory extends Ingredient {
  ingredient_categories: IngredientCategory | null;
  ingredient_supplier_codes?: Array<{
    id: number;
    supplier_id: string;
    product_code: string;
    price: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;
}

export const useIngredients = () => {
  return useQuery({
    queryKey: ["ingredients"],
    queryFn: async () => {
      // Fetch ingredients with their categories and supplier codes
      const { data: ingredients, error: ingredientsError } = await supabase
        .from("ingredients")
        .select(`
          *,
          ingredient_categories!ingredients_category_id_fkey(*),
          ingredient_supplier_codes(*)
        `)
        .eq("store_only", false)
        .order("name", { ascending: true });

      if (ingredientsError) throw ingredientsError;

      // Fetch all categories for reference
      const { data: categories, error: categoriesError } = await supabase
        .from("ingredient_categories")
        .select("*")
        .order("name", { ascending: true });

      if (categoriesError) throw categoriesError;

      return {
        ingredients: ingredients as IngredientWithCategory[],
        categories: categories as IngredientCategory[],
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useIngredientCategories = () => {
  return useQuery({
    queryKey: ["ingredientCategories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingredient_categories")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as IngredientCategory[];
    },
  });
};

// Create ingredient mutation hook
export const useCreateIngredient = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (ingredient: Omit<Ingredient, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("ingredients")
        .insert([ingredient])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

// Update ingredient mutation hook
export const useUpdateIngredient = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Omit<Ingredient, "id" | "created_at">> }) => {
      const { data, error } = await supabase
        .from("ingredients")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

// Delete ingredient mutation hook
export const useDeleteIngredient = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (ingredientId: number) => {
      // First check if ingredient is used in any recipes
      const { data: recipeIngredients, error: checkError } = await supabase
        .from("recipe_ingredients")
        .select("recipe_id")
        .eq("ingredient_id", ingredientId);
      
      if (checkError) throw checkError;
      
      if (recipeIngredients && recipeIngredients.length > 0) {
        throw new Error(`Ingredient is used in ${recipeIngredients.length} recipe(s) and cannot be deleted.`);
      }
      
      // Check if ingredient is used in any product parts
      const { data: productParts, error: productCheckError } = await supabase
        .from("product_parts")
        .select("product_id")
        .eq("ingredient_id", ingredientId);
      
      if (productCheckError) throw productCheckError;
      
      if (productParts && productParts.length > 0) {
        throw new Error(`Ingredient is used in ${productParts.length} product part(s) and cannot be deleted.`);
      }
      
      // Delete the ingredient
      const { error: deleteError } = await supabase
        .from("ingredients")
        .delete()
        .eq("id", ingredientId);
      
      if (deleteError) throw deleteError;
      
      return ingredientId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredients"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}; 