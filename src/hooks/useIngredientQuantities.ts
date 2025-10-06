import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface IngredientQuantity {
  id: string;
  ingredient_id: number;
  current_quantity: number;
  unit: string;
  last_updated: string;
  created_at: string;
  updated_at: string;
  ingredient?: {
    id: number;
    name: string;
    unit: string;
    price: number;
    ingredient_categories?: {
      id: number;
      name: string;
    };
    supplier_id?: string;
    supplier?: {
      id: string;
      full_name: string;
    };
  };
}

export interface QuantityUpdate {
  ingredient_id: number;
  quantity_change: number;
  operation_type: 'increase' | 'decrease';
}

// Hook to fetch all ingredient quantities
export function useIngredientQuantities() {
  return useQuery({
    queryKey: ["ingredientQuantities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingredient_quantities")
        .select(`
          *,
          ingredient:ingredients(
            id,
            name,
            unit,
            price,
            supplier_id,
            ingredient_categories(
              id,
              name
            ),
            supplier:profiles!ingredients_supplier_id_fkey(
              id,
              full_name
            )
          )
        `)
        .order("ingredient(name)");

      if (error) throw error;
      return data as IngredientQuantity[];
    },
  });
}

// Hook to fetch ingredient quantities with filters
export function useIngredientQuantitiesFiltered(filters?: {
  search?: string;
  categoryId?: number;
  lowStock?: boolean;
  supplierId?: string;
}) {
  return useQuery({
    queryKey: ["ingredientQuantities", filters],
    queryFn: async () => {
      let query = supabase
        .from("ingredient_quantities")
        .select(`
          *,
          ingredient:ingredients(
            id,
            name,
            unit,
            price,
            supplier_id,
            ingredient_categories(
              id,
              name
            ),
            supplier:profiles!ingredients_supplier_id_fkey(
              id,
              full_name
            )
          )
        `);

      // Apply filters
      if (filters?.categoryId) {
        query = query.eq("ingredient.ingredient_categories.id", filters.categoryId);
      }

      if (filters?.supplierId) {
        query = query.eq("ingredient.supplier_id", filters.supplierId);
      }

      if (filters?.lowStock) {
        query = query.lt("current_quantity", 10); // Consider quantities below 10 as low stock
      }

      if (filters?.search) {
        query = query.ilike("ingredient.name", `%${filters.search}%`);
      }

      const { data, error } = await query.order("ingredient(name)");

      if (error) throw error;
      return data as IngredientQuantity[];
    },
  });
}

// Hook to update ingredient quantity
export function useUpdateIngredientQuantity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ingredient_id, quantity_change, operation_type }: QuantityUpdate) => {
      const { data, error } = await supabase.rpc('update_ingredient_quantity', {
        p_ingredient_id: ingredient_id,
        p_quantity_change: quantity_change,
        p_operation_type: operation_type
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate and refetch ingredient quantities
      queryClient.invalidateQueries({ queryKey: ["ingredientQuantities"] });
    },
  });
}

// Hook to get single ingredient quantity
export function useIngredientQuantity(ingredientId: number) {
  return useQuery({
    queryKey: ["ingredientQuantity", ingredientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingredient_quantities")
        .select(`
          *,
          ingredient:ingredients(
            id,
            name,
            unit,
            price,
            ingredient_categories(
              id,
              name
            )
          )
        `)
        .eq("ingredient_id", ingredientId)
        .single();

      if (error) throw error;
      return data as IngredientQuantity;
    },
    enabled: !!ingredientId,
  });
}

// Hook to initialize ingredient quantities (for new ingredients)
export function useInitializeIngredientQuantities() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId?: string) => {
      const targetUserId = userId || 'e597fcc9-7ce8-407d-ad1a-fdace061e42f';
      
      try {
        // First, try the RPC function if it exists
        const { data, error } = await supabase.rpc('initialize_ingredient_quantities', {
          p_user_id: targetUserId
        });
        
        if (error) {
          console.log('RPC function failed, trying manual approach:', error);
          // If RPC fails, do it manually
          return await initializeQuantitiesManually(targetUserId);
        }
        
        return data;
      } catch (error) {
        console.log('RPC call failed, trying manual approach:', error);
        // If RPC fails, do it manually
        return await initializeQuantitiesManually(targetUserId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredientQuantities"] });
    },
  });
}

// Manual initialization function
async function initializeQuantitiesManually(userId: string) {
  // First, try to get the user's inventory
  const { data: inventories, error: inventoriesError } = await supabase
    .from('inventories')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (inventoriesError || !inventories || inventories.length === 0) {
    console.log('No inventory found for user, using 0 quantities. Error:', inventoriesError);
    // If no inventory exists, initialize with 0 quantities
    const { data: ingredients, error: ingredientsError } = await supabase
      .from('ingredients')
      .select('id, unit')
      .eq('active', true);

    if (ingredientsError) throw ingredientsError;

    const quantitiesData = ingredients.map(ingredient => ({
      ingredient_id: ingredient.id,
      current_quantity: 0,
      unit: ingredient.unit
    }));

    const { data, error } = await supabase
      .from('ingredient_quantities')
      .upsert(quantitiesData, {
        onConflict: 'ingredient_id',
        ignoreDuplicates: false
      })
      .select();

    if (error) throw error;
    return data;
  }

  // Get inventory items for this inventory
  const { data: inventoryItems, error: inventoryError } = await supabase
    .from('inventory_items')
    .select('ingredient_id, quantity')
    .eq('inventory_id', inventories[0].id);

  if (inventoryError) throw inventoryError;

  // Get all active ingredients
  const { data: ingredients, error: ingredientsError } = await supabase
    .from('ingredients')
    .select('id, unit')
    .eq('active', true);

  if (ingredientsError) throw ingredientsError;

  // Group inventory items by ingredient_id and sum quantities
  const inventoryMap = new Map();
  if (inventoryItems) {
    inventoryItems.forEach(item => {
      const current = inventoryMap.get(item.ingredient_id) || 0;
      inventoryMap.set(item.ingredient_id, current + (item.quantity || 0));
    });
  }

  // Prepare data for upsert
  const quantitiesData = ingredients.map(ingredient => ({
    ingredient_id: ingredient.id,
    current_quantity: inventoryMap.get(ingredient.id) || 0,
    unit: ingredient.unit
  }));

  // Upsert the quantities
  const { data, error } = await supabase
    .from('ingredient_quantities')
    .upsert(quantitiesData, {
      onConflict: 'ingredient_id',
      ignoreDuplicates: false
    })
    .select();

  if (error) throw error;
  return data;
}

// Hook to get ingredient quantity by ID
export function useGetIngredientQuantity(ingredientId: number) {
  return useQuery({
    queryKey: ["getIngredientQuantity", ingredientId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_ingredient_quantity', {
        p_ingredient_id: ingredientId
      });

      if (error) throw error;
      return data as number;
    },
    enabled: !!ingredientId,
  });
}
