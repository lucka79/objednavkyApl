import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { Ingredient, IngredientCategory, IngredientWithCategory } from "@/hooks/useIngredients";

interface IngredientStore {
  // State
  ingredients: IngredientWithCategory[];
  categories: IngredientCategory[];
  isLoading: boolean;
  error: string | null;
  selectedIngredient: IngredientWithCategory | null;
  isFormOpen: boolean;
  isEditMode: boolean;

  // Actions
  fetchIngredients: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  createIngredient: (ingredient: Omit<Ingredient, "id" | "created_at">) => Promise<void>;
  updateIngredient: (id: number, updates: Partial<Ingredient>) => Promise<void>;
  deleteIngredient: (id: number) => Promise<void>;
  createCategory: (name: string) => Promise<void>;
  updateCategory: (id: number, name: string) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;
  
  // UI Actions
  setSelectedIngredient: (ingredient: IngredientWithCategory | null) => void;
  openCreateForm: () => void;
  openEditForm: (ingredient: IngredientWithCategory) => void;
  closeForm: () => void;
  clearError: () => void;
}

export const useIngredientStore = create<IngredientStore>((set, get) => ({
  // Initial state
  ingredients: [],
  categories: [],
  isLoading: false,
  error: null,
  selectedIngredient: null,
  isFormOpen: false,
  isEditMode: false,

  // Fetch ingredients with categories
  fetchIngredients: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data: ingredients, error: ingredientsError } = await supabase
        .from("ingredients")
        .select(`
          *,
          ingredient_categories!ingredients_category_id_fkey(*),
          ingredient_supplier_codes(
            id,
            supplier_id,
            product_code,
            price,
            package,
            is_active,
            created_at,
            updated_at
          )
        `)
        .order("name", { ascending: true });

      if (ingredientsError) throw ingredientsError;

      console.log("Fetched ingredients with supplier codes:", ingredients);
      if (ingredients && ingredients.length > 0) {
        console.log("First ingredient supplier codes:", ingredients[0].ingredient_supplier_codes);
      }

      set({ 
        ingredients: ingredients as IngredientWithCategory[],
        isLoading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : "Failed to fetch ingredients",
        isLoading: false 
      });
    }
  },

  // Fetch categories
  fetchCategories: async () => {
    try {
      const { data: categories, error: categoriesError } = await supabase
        .from("ingredient_categories")
        .select("*")
        .order("name", { ascending: true });

      if (categoriesError) throw categoriesError;

      set({ categories: categories as IngredientCategory[] });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : "Failed to fetch categories"
      });
    }
  },

  // Create ingredient
  createIngredient: async (ingredient) => {
    set({ isLoading: true, error: null });
    try {
      // Separate supplier_codes from other ingredient data
      const { supplier_codes, ...ingredientData } = ingredient as any;
      
      const { data: newIngredient, error } = await supabase
        .from("ingredients")
        .insert([ingredientData])
        .select()
        .single();

      if (error) throw error;

      // Handle supplier codes if provided
      if (supplier_codes && supplier_codes.length > 0) {
        const codesToInsert = supplier_codes.map((code: any) => ({
          ingredient_id: newIngredient.id,
          supplier_id: code.supplier_id,
          product_code: code.product_code,
          price: code.price,
          package: code.package,
          is_active: code.is_active
        }));

        const { error: insertError } = await supabase
          .from("ingredient_supplier_codes")
          .insert(codesToInsert);

        if (insertError) throw insertError;
      }

      // Refresh ingredients list
      await get().fetchIngredients();
      set({ isLoading: false, isFormOpen: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : "Failed to create ingredient",
        isLoading: false 
      });
    }
  },

  // Update ingredient
  updateIngredient: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      // Separate supplier_codes from other updates
      const { supplier_codes, ...ingredientUpdates } = updates as any;
      
      // Update the main ingredient record
      const { error: ingredientError } = await supabase
        .from("ingredients")
        .update(ingredientUpdates)
        .eq("id", id);

      if (ingredientError) throw ingredientError;

      // Handle supplier codes if provided
      if (supplier_codes !== undefined) {
        // Delete existing supplier codes for this ingredient
        const { error: deleteError } = await supabase
          .from("ingredient_supplier_codes")
          .delete()
          .eq("ingredient_id", id);

        if (deleteError) throw deleteError;

        // Insert new supplier codes if any
        if (supplier_codes && supplier_codes.length > 0) {
          const codesToInsert = supplier_codes.map((code: any) => ({
            ingredient_id: id,
            supplier_id: code.supplier_id,
            product_code: code.product_code,
            price: code.price,
            package: code.package,
            is_active: code.is_active
          }));

          const { error: insertError } = await supabase
            .from("ingredient_supplier_codes")
            .insert(codesToInsert);

          if (insertError) throw insertError;
        }
      }

      // Refresh ingredients list
      await get().fetchIngredients();
      set({ isLoading: false, isFormOpen: false, selectedIngredient: null });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : "Failed to update ingredient",
        isLoading: false 
      });
    }
  },

  // Delete ingredient
  deleteIngredient: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from("ingredients")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Refresh ingredients list
      await get().fetchIngredients();
      set({ isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : "Failed to delete ingredient",
        isLoading: false 
      });
    }
  },

  // Create category
  createCategory: async (name) => {
    try {
      const { error } = await supabase
        .from("ingredient_categories")
        .insert([{ name }]);

      if (error) throw error;

      // Refresh categories list
      await get().fetchCategories();
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : "Failed to create category"
      });
    }
  },

  // Update category
  updateCategory: async (id, name) => {
    try {
      const { error } = await supabase
        .from("ingredient_categories")
        .update({ name })
        .eq("id", id);

      if (error) throw error;

      // Refresh categories list
      await get().fetchCategories();
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : "Failed to update category"
      });
    }
  },

  // Delete category
  deleteCategory: async (id) => {
    try {
      const { error } = await supabase
        .from("ingredient_categories")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Refresh categories list
      await get().fetchCategories();
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : "Failed to delete category"
      });
    }
  },

  // UI Actions
  setSelectedIngredient: (ingredient) => {
    set({ selectedIngredient: ingredient });
  },

  openCreateForm: () => {
    set({ isFormOpen: true, isEditMode: false, selectedIngredient: null });
  },

  openEditForm: (ingredient) => {
    set({ isFormOpen: true, isEditMode: true, selectedIngredient: ingredient });
  },

  closeForm: () => {
    set({ isFormOpen: false, isEditMode: false, selectedIngredient: null });
  },

  clearError: () => {
    set({ error: null });
  },
})); 