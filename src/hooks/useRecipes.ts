import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Ingredient } from "./useIngredients";

export interface Recipe {
  id: number;
  name: string;
  category_id: number;
  price: number;
  pricePerKilo: number;
  quantity: number;
  note: string | null;
  baking: string | null;
  dough: string | null;
  stir: string | null;
  water: string | null;
  created_at: string;
  baker: boolean;
  pastry: boolean;
  donut: boolean;
  store: boolean;
  test: boolean;
}

export interface RecipeIngredient {
  id: number;
  recipe_id: number;
  ingredient_id: number;
  quantity: number;
  created_at: string;
}

export interface RecipeCategory {
  id: number;
  name: string;
  adminOnly: boolean;
  buyer: boolean | null;
  recept: boolean;
  store: boolean | null;
  created_at: string;
}

export interface RecipeWithCategory extends Recipe {
  categories: RecipeCategory | null;
}

export interface RecipeIngredientWithIngredient extends RecipeIngredient {
  ingredient: Ingredient;
}

export interface RecipeWithCategoryAndIngredients extends RecipeWithCategory {
  recipe_ingredients: RecipeIngredientWithIngredient[];
}

export const useRecipes = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["recipes"],
    queryFn: async () => {
      // Fetch recipes with their categories and ingredients
      const { data: recipes, error: recipesError } = await supabase
        .from("recipes")
        .select(`
          *,
          categories!recepts_category_id_fkey(*),
          recipe_ingredients(
            *,
            ingredient:ingredients(*)
          )
        `)
        .order("name", { ascending: true });

      if (recipesError) throw recipesError;

      // Fetch all categories for reference
      const { data: categories, error: categoriesError } = await supabase
        .from("categories")
        .select("*")
        .eq("recept", true) // Only recipe categories
        .order("name", { ascending: true });

      if (categoriesError) throw categoriesError;

      return {
        recipes: recipes as RecipeWithCategoryAndIngredients[],
        categories: categories as RecipeCategory[],
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Create recipe
  const createRecipe = useMutation({
    mutationFn: async (recipe: Omit<Recipe, "id" | "created_at">) => {
      const { error } = await supabase.from("recipes").insert([recipe]);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });

  // Update recipe
  const updateRecipe = async (id: number, updates: Partial<Omit<Recipe, "id" | "created_at">>) => {
    const { error } = await supabase.from("recipes").update(updates).eq("id", id);
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ["recipes"] });
  };

  // Fetch recipe ingredients
  const fetchRecipeIngredients = async (recipeId: number): Promise<RecipeIngredient[]> => {
    const { data, error } = await supabase
      .from("recipe_ingredients")
      .select("*")
      .eq("recipe_id", recipeId)
      .order("created_at", { ascending: true });
    
    if (error) throw error;
    return data as RecipeIngredient[];
  };

  // Save recipe ingredients (replace all)
  const saveRecipeIngredients = async (recipeId: number, ingredients: Omit<RecipeIngredient, "id" | "recipe_id" | "created_at">[]) => {
    // Delete existing ingredients
    await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId);
    
    // Insert new ingredients
    if (ingredients.length > 0) {
      const ingredientsToInsert = ingredients.map(ing => ({
        recipe_id: recipeId,
        ingredient_id: ing.ingredient_id,
        quantity: ing.quantity,
      }));
      
      const { error } = await supabase.from("recipe_ingredients").insert(ingredientsToInsert);
      if (error) throw error;
    }
  };

  return { ...query, createRecipe, updateRecipe, fetchRecipeIngredients, saveRecipeIngredients };
};

// Create recipe mutation hook
export const useCreateRecipe = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (recipe: Omit<Recipe, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("recipes")
        .insert([recipe])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
};

// Update recipe mutation hook
export const useUpdateRecipe = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Omit<Recipe, "id" | "created_at">> }) => {
      const { data, error } = await supabase
        .from("recipes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
};

// Delete recipe mutation hook
export const useDeleteRecipe = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (recipeId: number) => {
      // First delete recipe ingredients
      const { error: ingredientsError } = await supabase
        .from("recipe_ingredients")
        .delete()
        .eq("recipe_id", recipeId);
      
      if (ingredientsError) throw ingredientsError;
      
      // Then delete the recipe
      const { error: recipeError } = await supabase
        .from("recipes")
        .delete()
        .eq("id", recipeId);
      
      if (recipeError) throw recipeError;
      
      return recipeId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
};

export const useRecipeCategories = () => {
  return useQuery({
    queryKey: ["recipeCategories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("recept", true) // Only recipe categories
        .order("name", { ascending: true });

      if (error) throw error;
      return data as RecipeCategory[];
    },
  });
}; 