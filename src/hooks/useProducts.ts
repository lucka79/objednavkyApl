// useProducts.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Product } from 'types';

// Add this type definition
type ProductFormValues = {
  name: string;
  description: string;
  price: number;
  priceBuyer: number;
  priceMobil: number;
  category_id: number;
  image: File | null;
  active: boolean;
  store: boolean;
  // imageUrl: string | null;
};

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

export const fetchActiveProducts = () => {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("name", { ascending: true });
      if (error) {
        throw new Error(error.message);
      }
      return data;
    },
  });
};


export const fetchStoreProducts = () => {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("store", true) // Add this line to filter products where store is true
        .eq("active", true)
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
export const insertProduct = async (product: Omit<Product, 'id' | 'created_at'| 'image' >) => {
  const { data, error } = await supabase
    .from('products')
    .insert(product)
    .single()

  if (error) throw error
  return data
}

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<ProductFormValues> & { id: number }) => {
      console.log("Updating product with data:", data);
      const { error, data: updatedProduct } = await supabase
        .from("products")
        .update(data)
        .eq("id", data.id)
        .single();

      if (error) {
        console.error("Error updating product:", error);
        throw new Error(error.message);
      }
      console.log("Product updated successfully:", updatedProduct);
      return updatedProduct;
    },
    onSuccess: () => {
      console.log("Invalidating product queries");
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

export const useProducts = () => {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)  // Only fetch active products
        .order('name');      // Order by name
      
      if (error) throw error;
      return data;
    },
  });
};

export const deleteProduct = async (productId: number) => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId);
  
  if (error) throw error;
};
