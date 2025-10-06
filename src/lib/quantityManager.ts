import { supabase } from "@/lib/supabase";

export interface QuantityUpdateParams {
  ingredient_id: number;
  quantity_change: number;
  operation_type: 'increase' | 'decrease';
}

/**
 * Update ingredient quantity (for transfers and invoices)
 */
export async function updateIngredientQuantity({
  ingredient_id,
  quantity_change,
  operation_type
}: QuantityUpdateParams): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('update_ingredient_quantity', {
      p_ingredient_id: ingredient_id,
      p_quantity_change: quantity_change,
      p_operation_type: operation_type
    });

    if (error) {
      console.error('Error updating ingredient quantity:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to update ingredient quantity:', error);
    throw error;
  }
}

/**
 * Get current quantity of an ingredient
 */
export async function getIngredientQuantity(ingredient_id: number): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_ingredient_quantity', {
      p_ingredient_id: ingredient_id
    });

    if (error) {
      console.error('Error getting ingredient quantity:', error);
      throw error;
    }

    return data || 0;
  } catch (error) {
    console.error('Failed to get ingredient quantity:', error);
    throw error;
  }
}

/**
 * Initialize ingredient quantities for new ingredients
 */
export async function initializeIngredientQuantities(): Promise<void> {
  try {
    const { error } = await supabase.rpc('initialize_ingredient_quantities');
    
    if (error) {
      console.error('Error initializing ingredient quantities:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to initialize ingredient quantities:', error);
    throw error;
  }
}

/**
 * Update quantities for transfer (decrease quantities)
 */
export async function updateQuantitiesForTransfer(transferItems: Array<{
  ingredient_id: number;
  quantity: number;
}>): Promise<void> {
  try {
    const updates = transferItems.map(item => 
      updateIngredientQuantity({
        ingredient_id: item.ingredient_id,
        quantity_change: item.quantity,
        operation_type: 'decrease'
      })
    );

    await Promise.all(updates);
  } catch (error) {
    console.error('Failed to update quantities for transfer:', error);
    throw error;
  }
}

/**
 * Update quantities for received invoice (increase quantities)
 */
export async function updateQuantitiesForInvoice(invoiceItems: Array<{
  ingredient_id: number;
  quantity: number;
}>): Promise<void> {
  try {
    const updates = invoiceItems.map(item => 
      updateIngredientQuantity({
        ingredient_id: item.ingredient_id,
        quantity_change: item.quantity,
        operation_type: 'increase'
      })
    );

    await Promise.all(updates);
  } catch (error) {
    console.error('Failed to update quantities for invoice:', error);
    throw error;
  }
}
