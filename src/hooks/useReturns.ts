import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, useAuthStore } from '@/lib/supabase';
import { InsertTables, Return, UpdateTables } from '../../types';

export const useReturns = () => {
  return useQuery<Return[], Error>({
    queryKey: ['returns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('returns')
        .select(`
          *,
          user:profiles(id, full_name, role),
          return_items(*, product:products(*))
        `)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data as Return[];
    },
  });
};

export const useFetchReturnById = (returnId: number | null) => {
  return useQuery({
    queryKey: ['return', returnId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('returns')
        .select(`
          *,
          user:profiles(id, full_name, role),
          return_items(*, product:products(*))
        `)
        .eq('id', returnId);

      if (error) throw error;
      return data[0];
    },
    enabled: !!returnId
  });
};

export const useInsertReturn = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore.getState();

  return useMutation({
    async mutationFn(data: InsertTables<"returns">) {
      const returnData = {
        ...data,
        user_id: data.user_id || user?.id
      };

      const { error, data: newReturn } = await supabase
        .from("returns")
        .insert(returnData)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }
      return newReturn;
    },
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: ["returns"] });
    },
  });
};

export const useInsertReturnItems = () => {
  return useMutation({
    async mutationFn(items: InsertTables<"return_items">[]) {
      const { error, data: newReturn } = await supabase
        .from("return_items")
        .insert(items)
        .select();

      if (error) {
        throw new Error(error.message);
      }
      return newReturn;
    },
  });
};

export const useUpdateReturn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn({id, updatedFields}: {id: number, updatedFields: UpdateTables<"returns">}) {
      const { error, data: updatedReturn } = await supabase
        .from("returns")
        .update(updatedFields)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }
      return updatedReturn;
    },
    async onSuccess(_, { id }) {
      await queryClient.invalidateQueries({ queryKey: ["returns"] });
      await queryClient.invalidateQueries({ queryKey: ["return", id] });
    },
  });
};

export const useUpdateReturnItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn({ itemId, newQuantity, returnId, total }: { 
      itemId: number; 
      newQuantity: number;
      returnId: number;
      total: number;
    }) {
      // Update return item quantity
      const { error: itemError } = await supabase
        .from('return_items')
        .update({ quantity: newQuantity })
        .eq('id', itemId);

      if (itemError) {
        throw new Error(itemError.message);
      }

      // Update return total
      const { error: totalError } = await supabase
        .from('returns')
        .update({ total })
        .eq('id', returnId);

      if (totalError) {
        throw new Error(totalError.message);
      }

      return { success: true };
    },
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: ['returns'] });

    },
  });
};

export const useDeleteReturnItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn({ itemId }: { itemId: number; returnId: number }) {
      const { error } = await supabase
        .from('return_items')
        .delete()
        .eq('id', itemId);

      if (error) {
        throw new Error(error.message);
      }
    },
    async onSuccess(_, { returnId }) {
      // Invalidate both the returns list and the specific return
      await queryClient.invalidateQueries({ queryKey: ['returns'] });
      await queryClient.invalidateQueries({ queryKey: ['return', returnId] });
    },
  });
};

export const useCheckExistingReturn = () => {
  return useMutation({
    async mutationFn({ userId, date }: { userId: string; date: string }) {
      const { data, error } = await supabase
        .from('returns')
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