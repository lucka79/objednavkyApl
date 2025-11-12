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
            supplier_ingredient_name,
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
        console.log("=== DEBUG STORE: Creating supplier codes for new ingredient ===");
        console.log("Supplier codes to insert:", supplier_codes);
        
        const codesToInsert = supplier_codes.map((code: any) => ({
          ingredient_id: newIngredient.id,
          supplier_id: code.supplier_id,
          product_code: code.product_code,
          supplier_ingredient_name: code.supplier_ingredient_name || null,
          price: code.price,
          package: code.package,
          is_active: code.is_active
        }));

        console.log("Mapped codes to insert:", codesToInsert);

        const { error: insertError } = await supabase
          .from("ingredient_supplier_codes")
          .insert(codesToInsert);

        if (insertError) {
          console.error("=== DEBUG STORE: Insert error ===", insertError);
          throw insertError;
        }
        
        console.log("=== DEBUG STORE: Supplier codes inserted successfully ===");
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
        console.log("=== DEBUG STORE: Updating supplier codes ===");
        console.log("Ingredient ID:", id);
        console.log("Supplier codes to update:", supplier_codes);
        
        // Get existing codes first to handle deletions
        const { data: existingCodes, error: fetchError } = await supabase
          .from("ingredient_supplier_codes")
          .select("id, ingredient_id, supplier_id, product_code")
          .eq("ingredient_id", id);

        if (fetchError) {
          console.error("=== DEBUG STORE: Fetch existing codes error ===", fetchError);
          throw new Error(`Chyba při načítání existujících kódů: ${fetchError.message}`);
        }

        console.log("=== DEBUG STORE: Existing codes found ===", existingCodes);
        
        if (supplier_codes && supplier_codes.length > 0) {
          // Validate all codes before proceeding
          const codesToUpsert = supplier_codes.map((code: any) => ({
            ingredient_id: id,
            supplier_id: code.supplier_id,
            product_code: code.product_code,
            supplier_ingredient_name: code.supplier_ingredient_name || null,
            price: code.price,
            package: code.package,
            is_active: code.is_active
          }));

          // Validate required fields
          for (const code of codesToUpsert) {
            if (!code.supplier_id) {
              throw new Error("Všechny kódy dodavatelů musí mít nastaveného dodavatele");
            }
            // Product code is optional - removed validation
            // if (!code.product_code || code.product_code.trim() === "") {
            //   throw new Error("Všechny kódy dodavatelů musí mít nastavený kód produktu");
            // }
            if (code.price === null || code.price === undefined || code.price < 0) {
              throw new Error("Všechny kódy dodavatelů musí mít platnou cenu (≥ 0)");
            }
          }

          console.log("=== DEBUG STORE: Validation passed, proceeding with upsert ===");
          console.log("Mapped codes to upsert:", codesToUpsert);

          // Find codes to delete (exist in DB but not in new codes array)
          const codesToDelete: any[] = [];
          if (existingCodes) {
            for (const existingCode of existingCodes) {
              const stillExists = codesToUpsert.some(
                (newCode: any) =>
                  newCode.supplier_id === existingCode.supplier_id &&
                  ((!existingCode.product_code && !newCode.product_code) || 
                   (existingCode.product_code === newCode.product_code))
              );
              
              if (!stillExists) {
                codesToDelete.push(existingCode);
              }
            }
          }

          // Separate codes into updates and inserts
          const codesToUpdate: any[] = [];
          const codesToInsert: any[] = [];

          for (const code of codesToUpsert) {
            // Check if code exists (by ingredient_id and supplier_id)
            // Note: We match primarily by supplier_id since that's the unique key per ingredient
            const existingCode = existingCodes?.find(
              (ec: any) =>
                ec.ingredient_id === code.ingredient_id &&
                ec.supplier_id === code.supplier_id &&
                // Match product_code only if both are non-empty, otherwise just match by supplier
                ((!ec.product_code && !code.product_code) || 
                 (ec.product_code === code.product_code))
            );

            if (existingCode) {
              // Update existing code
              codesToUpdate.push({
                id: existingCode.id,
                ...code
              });
            } else {
              // Insert new code
              codesToInsert.push(code);
            }
          }

          console.log("=== DEBUG STORE: Codes to delete ===", codesToDelete);
          console.log("=== DEBUG STORE: Codes to update ===", codesToUpdate);
          console.log("=== DEBUG STORE: Codes to insert ===", codesToInsert);

          // Delete removed codes
          if (codesToDelete.length > 0) {
            const idsToDelete = codesToDelete.map((code) => code.id);
            const { error: deleteError } = await supabase
              .from("ingredient_supplier_codes")
              .delete()
              .in("id", idsToDelete);

            if (deleteError) {
              console.error("=== DEBUG STORE: Delete error ===", deleteError);
              throw new Error(`Chyba při mazání kódů dodavatelů: ${deleteError.message}`);
            }
            console.log("=== DEBUG STORE: Codes deleted successfully ===", idsToDelete);
          }

          // Update existing codes
          if (codesToUpdate.length > 0) {
            for (const code of codesToUpdate) {
              const { id: codeId, ...updateData } = code;
              const { error: updateError } = await supabase
                .from("ingredient_supplier_codes")
                .update(updateData)
                .eq("id", codeId);

              if (updateError) {
                console.error("=== DEBUG STORE: Update error ===", updateError);
                throw new Error(`Chyba při aktualizaci kódu dodavatele: ${updateError.message}`);
              }
            }
            console.log("=== DEBUG STORE: Codes updated successfully ===");
          }

          // Insert new codes
          if (codesToInsert.length > 0) {
            const { error: insertError } = await supabase
              .from("ingredient_supplier_codes")
              .insert(codesToInsert);

            if (insertError) {
              console.error("=== DEBUG STORE: Insert error ===", insertError);
              throw new Error(`Chyba při ukládání nových kódů dodavatelů: ${insertError.message}`);
            }
            console.log("=== DEBUG STORE: New codes inserted successfully ===");
          }

          console.log("=== DEBUG STORE: Supplier codes synchronized successfully ===");
          console.log(`Deleted: ${codesToDelete.length}, Updated: ${codesToUpdate.length}, Inserted: ${codesToInsert.length}`);
        } else if (supplier_codes.length === 0 && existingCodes && existingCodes.length > 0) {
          // If supplier_codes is empty but there are existing codes, delete all of them
          const idsToDelete = existingCodes.map((code: any) => code.id);
          const { error: deleteError } = await supabase
            .from("ingredient_supplier_codes")
            .delete()
            .in("id", idsToDelete);

          if (deleteError) {
            console.error("=== DEBUG STORE: Delete all codes error ===", deleteError);
            throw new Error(`Chyba při mazání všech kódů dodavatelů: ${deleteError.message}`);
          }
          console.log("=== DEBUG STORE: All codes deleted successfully ===", idsToDelete);
          console.log(`Deleted: ${idsToDelete.length}, Updated: 0, Inserted: 0`);
        }
      }

      // Refresh ingredients list
      await get().fetchIngredients();
      set({ isLoading: false, isFormOpen: false, selectedIngredient: null });
    } catch (error) {
      // Don't close the form on error - keep it open so user can see the error and retry
      // This prevents data loss if there's an issue with supplier codes
      set({ 
        error: error instanceof Error ? error.message : "Failed to update ingredient",
        isLoading: false,
        // Keep form open and selected ingredient so user can retry
        isFormOpen: true,
        // Don't clear selectedIngredient so form data is preserved
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