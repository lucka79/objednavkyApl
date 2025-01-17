// useProducts.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Product } from 'types';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { cs } from 'date-fns/locale';

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
  buyer: boolean;
  // imageUrl: string | null;
};

// type QuantityItem = { 
//   quantity: number | null;
//   productions?: { date: string };
//   returns?: { date: string };
//   orders?: { date: string };
//   receipts?: { date: string };
// };

type OrderItem = { 
  quantity: number | null;
  orders: { date: string }[];
};

type ReturnItem = { 
  quantity: number | null;
  returns: { date: string }[];
};

type ProductionItem = { 
  quantity: number | null;
  productions: { date: string }[];
};

type ReceiptItem = { 
  quantity: number | null;
  receipts: { date: string }[];
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
        .eq("buyer", true)
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
export const fetchProductById = (id: number | null, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: options?.enabled
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

export const useProductsWithDailyQuantities = (startDate: string) => {
  const today = new Date();
  const monday = startOfWeek(today, { locale: cs, weekStartsOn: 1 });
  const nextMonday = addDays(monday, 7);
  const sunday = addDays(monday, 6);
  const nextSunday = addDays(nextMonday, 6);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  
  const isThisWeek = startDate === format(monday, 'yyyy-MM-dd');
  const isNextWeek = startDate === format(nextMonday, 'yyyy-MM-dd');
  const isThisMonth = startDate === format(monthStart, 'yyyy-MM-dd');
  
  const getDateRange = () => {
    if (isThisWeek) return { start: format(monday, 'yyyy-MM-dd'), end: format(sunday, 'yyyy-MM-dd') };
    if (isNextWeek) return { start: format(nextMonday, 'yyyy-MM-dd'), end: format(nextSunday, 'yyyy-MM-dd') };
    if (isThisMonth) return { start: format(monthStart, 'yyyy-MM-dd'), end: format(monthEnd, 'yyyy-MM-dd') };
    return { start: startDate, end: startDate };
  };

  const dateRange = getDateRange();

  return useQuery({
    queryKey: ["productsWithQuantities", startDate],
    queryFn: async () => {
      const { data: products, error: productError } = await supabase
        .from("products")
        .select("id, name")
        .eq('active', true)
        .eq('buyer', true)
        .order('name');

      if (productError) throw productError;

      const productsWithQuantities = await Promise.all(
        products.map(async (product) => {
          // Fetch order items
          const { data: orderItems, error: orderError } = await supabase
            .from("order_items")
            .select(`
              quantity,
              orders!inner(date)
            `)
            .eq("product_id", product.id)
            .gte("orders.date", dateRange.start)
            .lte("orders.date", dateRange.end);

          if (orderError) throw orderError;

          // Fetch return items
          const { data: returnItems, error: returnError } = await supabase
            .from("return_items")
            .select(`
              quantity,
              returns!inner(date)
            `)
            .eq("product_id", product.id)
            .gte("returns.date", dateRange.start)
            .lte("returns.date", dateRange.end);

          if (returnError) throw returnError;

          // Fetch production items
          const { data: productionItems, error: productionError } = await supabase
            .from("production_items")
            .select(`
              quantity,
              productions!inner(date)
            `)
            .eq("product_id", product.id)
            .gte("productions.date", dateRange.start)
            .lte("productions.date", dateRange.end);

          if (productionError) throw productionError;

          // Fetch receipt items
          const { data: receiptItems, error: receiptError } = await supabase
            .from("receipt_items")
            .select(`
              quantity,
              receipts!inner(date)
            `)
            .eq("product_id", product.id)
            .gte("receipts.date", dateRange.start)
            .lte("receipts.date", dateRange.end);

          if (receiptError) throw receiptError;

          return {
            id: product.id,
            productName: product.name,
            productionQty: productionItems?.reduce((sum: number, item: ProductionItem) => 
              sum + (item.quantity || 0), 0) || 0,
            returnsQty: returnItems?.reduce((sum: number, item: ReturnItem) => 
              sum + (item.quantity || 0), 0) || 0,
            orderItemQty: orderItems?.reduce((sum: number, item: OrderItem) => 
              sum + (item.quantity || 0), 0) || 0,
            receiptItemQty: receiptItems?.reduce((sum: number, item: ReceiptItem) => 
              sum + (item.quantity || 0), 0) || 0
          };
        })
      );

      return productsWithQuantities;
    },
  });
};
