import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, useAuthStore } from '@/lib/supabase';
import { InsertTables } from 'types';

export const useProductions = () => {
  return useQuery({
    queryKey: ['productions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('productions')
        .select(`
          *,
          user:profiles(id, full_name, role),
          production_items(*, product:products(*))
        `)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
};

export const useFetchProductionById = (productionId: number | null) => {
    return useQuery({
      queryKey: ['production', productionId],
      queryFn: async () => {
        if (!productionId) return null;
        
        const { data, error } = await supabase
          .from('productions')
          .select(`
            *,
            user:profiles(id, full_name, role),
            production_items(*, product:products(*))
          `)
          .eq('id', productionId);
  
        if (error) throw error;
        return data[0];
      },
      enabled: !!productionId,
      staleTime: 1000,
    });
  };

  export const useInsertProduction = () => {
    const queryClient = useQueryClient();
    const { user } = useAuthStore.getState();
  
    return useMutation({
      async mutationFn(data: InsertTables<"productions">) {
        const productionData = {
          ...data,
          user_id: data.user_id || user?.id
        };
  
        const { error, data: newProduction } = await supabase
          .from("productions")
          .insert(productionData)
          .select()
          .single();
  
        if (error) {
          throw new Error(error.message);
        }
        return newProduction;
      },
      async onSuccess() {
        await queryClient.invalidateQueries({ queryKey: ["productions"] });
      },
    });
  };

export const useInsertProductionItems = () => {
    return useMutation({
      async mutationFn(items: InsertTables<"production_items">[]) {
        const { error, data: newProduction } = await supabase
          .from("production_items")
          .insert(items)
          .select();
  
        if (error) {
          throw new Error(error.message);
        }
        return newProduction;
      },
    });
  };



export const useUpdateProductionItems = () => {
    const queryClient = useQueryClient();

    return useMutation({
      async mutationFn({ itemId, newQuantity, productionId, total }: { 
        itemId: number; 
        newQuantity: number;
        productionId: number;
        total: number;
      }) {
        // First update the production_items quantity
        const { error: itemError } = await supabase
        .from('production_items')
        .update({ quantity: newQuantity })
        .eq('id', itemId);

      if (itemError) throw itemError;

      const { error: totalError } = await supabase
        .from('productions')
        .update({ total })
        .eq('id', productionId);

      if (totalError) throw totalError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["productions"] });
    },
  });
};

export const useCheckExistingProduction = () => {
    return useMutation({
      async mutationFn({ userId, date }: { userId: string; date: string }) {
        const { data, error } = await supabase
          .from('productions')
          .select()
          .eq('user_id', userId)
          .eq('date', date)
          .single();
  
        if (error && error.code !== 'PGRST116') {
          throw error;
        }
        return data;
      },
    });
  };

export const useDeleteProductionItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ itemId }: { itemId: number }) => {
      const { error } = await supabase
        .from('production_items')
        .delete()
        .eq('id', itemId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productions'] });
    },
  });
};
