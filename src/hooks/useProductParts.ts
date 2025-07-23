import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface ProductPartsCount {
  product_id: number;
  count: number;
}

export interface ProductComposition {
  id: number;
  name: string;
  parts: string | null;
  allergens: string[] | null;
}

export const useProductPartsCount = () => {
  return useQuery({
    queryKey: ['productPartsCount'],
    queryFn: async (): Promise<ProductPartsCount[]> => {
      const { data, error } = await supabase
        .from('product_parts')
        .select('product_id')
        .order('product_id');

      if (error) throw error;

      // Count parts per product
      const partsCounts: { [key: number]: number } = {};
      data.forEach((part) => {
        partsCounts[part.product_id] = (partsCounts[part.product_id] || 0) + 1;
      });

      // Convert to array format
      return Object.entries(partsCounts).map(([productId, count]) => ({
        product_id: parseInt(productId),
        count
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useHasProductParts = (productId: number): boolean => {
  const { data: partsCount } = useProductPartsCount();
  return partsCount?.some(pc => pc.product_id === productId) || false;
};

export const useProductComposition = (productId: number) => {
  return useQuery({
    queryKey: ['productComposition', productId],
    queryFn: async (): Promise<ProductComposition | null> => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, parts, allergens')
        .eq('id', productId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useProductsWithComposition = () => {
  return useQuery({
    queryKey: ['productsWithComposition'],
    queryFn: async (): Promise<ProductComposition[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, parts, allergens')
        .not('parts', 'is', null)
        .eq('active', true)
        .order('name');

      if (error) throw error;
      
      // Sort with Czech collation
      return data.sort((a, b) => 
        new Intl.Collator('cs').compare(a.name, b.name)
      );
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}; 