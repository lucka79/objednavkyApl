import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Tables, TablesInsert, TablesUpdate } from '@/database.types';

export type Transfer = Tables<'transfers'> & {
  sender: Tables<'profiles'>;
  receiver: Tables<'profiles'>;
  transfer_items: (Tables<'transfer_items'> & {
    ingredient: Tables<'ingredients'>;
  })[];
};

export type TransferItem = Tables<'transfer_items'> & {
  ingredient: Tables<'ingredients'>;
};

export type TransferInsert = TablesInsert<'transfers'> & {
  transfer_items: TablesInsert<'transfer_items'>[];
};

// Fetch all transfers with related data
export const useTransfers = () => {
  return useQuery<Transfer[], Error>({
    queryKey: ['transfers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transfers')
        .select(`
          *,
          sender:profiles!transfers_sender_id_fkey (
            id,
            full_name,
            role
          ),
          receiver:profiles!transfers_receiver_id_fkey (
            id,
            full_name,
            role
          ),
          transfer_items (
            *,
            ingredient:ingredients (
              id,
              name,
              unit,
              kiloPerUnit,
              category_id,
              ingredient_categories!ingredients_category_id_fkey (
                id,
                name
              )
            )
          )
        `)
        .order('date', { ascending: false });

      if (error) throw error;
      return data as unknown as Transfer[];
    },
  });
};

// Fetch transfers by user ID (as sender or receiver)
export const useTransfersByUserId = (userId: string) => {
  return useQuery<Transfer[], Error>({
    queryKey: ['transfers', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transfers')
        .select(`
          *,
          sender:profiles!transfers_sender_id_fkey (
            id,
            full_name,
            role
          ),
          receiver:profiles!transfers_receiver_id_fkey (
            id,
            full_name,
            role
          ),
          transfer_items (
            *,
            ingredient:ingredients (
              id,
              name,
              unit,
              kiloPerUnit,
              category_id,
              ingredient_categories!ingredients_category_id_fkey (
                id,
                name
              )
            )
          )
        `)
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('date', { ascending: false });

      if (error) throw error;
      return data as unknown as Transfer[];
    },
    enabled: !!userId,
  });
};

// Fetch single transfer by ID
export const useTransferById = (transferId: number | null) => {
  return useQuery<Transfer | null, Error>({
    queryKey: ['transfer', transferId],
    queryFn: async () => {
      if (!transferId) return null;

      const { data, error } = await supabase
        .from('transfers')
        .select(`
          *,
          sender:profiles!transfers_sender_id_fkey (
            id,
            full_name,
            role
          ),
          receiver:profiles!transfers_receiver_id_fkey (
            id,
            full_name,
            role
          ),
          transfer_items (
            *,
            ingredient:ingredients (
              id,
              name,
              unit,
              kiloPerUnit,
              category_id,
              ingredient_categories!ingredients_category_id_fkey (
                id,
                name
              )
            )
          )
        `)
        .eq('id', transferId)
        .single();

      if (error) throw error;
      return data as unknown as Transfer;
    },
    enabled: !!transferId,
  });
};

// Create new transfer
export const useCreateTransfer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transferData: TransferInsert) => {
      const { transfer_items, ...transfer } = transferData;

      // Start transaction
      const { data: newTransfer, error: transferError } = await supabase
        .from('transfers')
        .insert(transfer)
        .select('id')
        .single();

      if (transferError) throw transferError;

      // Insert transfer items
      if (transfer_items && transfer_items.length > 0) {
        const itemsWithTransferId = transfer_items.map(item => ({
          ...item,
          transfer_id: newTransfer.id,
        }));

        const { error: itemsError } = await supabase
          .from('transfer_items')
          .insert(itemsWithTransferId);

        if (itemsError) throw itemsError;
      }

      // Fetch complete transfer with relationships
      const { data: completeTransfer, error: fetchError } = await supabase
        .from('transfers')
        .select(`
          *,
          sender:profiles!transfers_sender_id_fkey (
            id,
            full_name,
            role
          ),
          receiver:profiles!transfers_receiver_id_fkey (
            id,
            full_name,
            role
          ),
          transfer_items (
            *,
            ingredient:ingredients (
              id,
              name,
              unit,
              kiloPerUnit,
              category_id,
              ingredient_categories!ingredients_category_id_fkey (
                id,
                name
              )
            )
          )
        `)
        .eq('id', newTransfer.id)
        .single();

      if (fetchError) throw fetchError;
      return completeTransfer as unknown as Transfer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
    },
  });
};

// Update transfer
export const useUpdateTransfer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      updatedFields 
    }: { 
      id: number; 
      updatedFields: TablesUpdate<'transfers'>;
    }) => {
      const { error, data } = await supabase
        .from('transfers')
        .update(updatedFields)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['transfer', id] });
    },
  });
};

// Delete transfer
export const useDeleteTransfer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transferId: number) => {
      // First delete transfer items
      const { error: itemsError } = await supabase
        .from('transfer_items')
        .delete()
        .eq('transfer_id', transferId);

      if (itemsError) throw itemsError;

      // Then delete the transfer
      const { error: transferError } = await supabase
        .from('transfers')
        .delete()
        .eq('id', transferId);

      if (transferError) throw transferError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
    },
  });
};

// Add item to existing transfer
export const useAddTransferItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: TablesInsert<'transfer_items'>) => {
      const { error, data } = await supabase
        .from('transfer_items')
        .insert(item)
        .select(`
          *,
          ingredient:ingredients (
            id,
            name,
            unit,
            kiloPerUnit
          )
        `)
        .single();

      if (error) throw error;
      return data as unknown as TransferItem;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['transfer', variables.transfer_id] });
    },
  });
};

// Update transfer item
export const useUpdateTransferItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      updatedFields 
    }: { 
      id: number; 
      updatedFields: TablesUpdate<'transfer_items'>;
    }) => {
      const { error, data } = await supabase
        .from('transfer_items')
        .update(updatedFields)
        .eq('id', id)
        .select(`
          *,
          ingredient:ingredients (
            id,
            name,
            unit,
            kiloPerUnit
          )
        `)
        .single();

      if (error) throw error;
      return data as unknown as TransferItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['transfer', data.transfer_id] });
    },
  });
};

// Delete transfer item
export const useDeleteTransferItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, transferId }: { itemId: number; transferId: number }) => {
      const { error } = await supabase
        .from('transfer_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      return { itemId, transferId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['transfer', variables.transferId] });
    },
  });
};
