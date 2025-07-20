import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

export interface Ingredient {
  id: number;
  name: string;
  active: boolean;
  category_id: number | null;
  ean: string | null;
  kiloPerUnit: number;
  package: number | null;
  price: number | null;
  storeOnly: boolean;
  unit: string;
  vat: number | null;
  created_at: string;
}

export interface IngredientCategory {
  id: number;
  name: string;
  created_at: string;
}

export interface IngredientWithCategory extends Ingredient {
  ingredient_categories: IngredientCategory | null;
}

export const useIngredients = () => {
  return useQuery({
    queryKey: ["ingredients"],
    queryFn: async () => {
      // Fetch ingredients with their categories
      const { data: ingredients, error: ingredientsError } = await supabase
        .from("ingredients")
        .select(`
          *,
          ingredient_categories!ingredients_category_id_fkey(*)
        `)
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