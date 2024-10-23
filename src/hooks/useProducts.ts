// useProducts.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Product } from 'types';


// get all products
export const fetchAllProducts = () => {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name", { ascending: true });
      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
  });
};

// get product by id
export const fetchProductById = (productId: number) => {
  return useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
  });
};

export const useInsertProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    async mutationFn(data: any) {
      const { error, data: newProduct } = await supabase
        .from("products")
        .insert({
          name: data.name,
          description: data.description,
          price: data.price,
          priceMobil: data.priceMobil,
          category_id: data.category_id,
        })
        .single();

      if (error) {
        throw new Error(error.message);
      }
      return newProduct;
    },
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
};

// funkční insert product
export const insertProduct = async (product: Omit<Product, 'id' | 'created_at'| 'image' | 'priceMobil'>) => {
  const { data, error } = await supabase
    .from('products')
    .insert(product)
    .single()

  if (error) throw error
  return data
}