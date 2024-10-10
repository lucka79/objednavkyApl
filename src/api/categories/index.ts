import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Category } from "types";


export const fetchCategories = async (): Promise<Category[]> => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order("name", {ascending: true})
    if (error) throw new Error(error.message);
    return data
}


  // Query function to fetch categories and products
  // export const fetchCategoriesAndProducts = async () => {
  export const fetchCategoriesAndProducts = async (): Promise<Category[]> => {
  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('*')

  if (categoriesError) {
    throw new Error(categoriesError.message)
  }

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*')

  if (productsError) {
    throw new Error(productsError.message)
  }

  // Group products by category
  const categoriesWithProducts = categories.map(category => ({
    ...category,
    products: products.filter(product => product.category_id === category.id)
  }))

  return categoriesWithProducts
}

// CategoryBadges
export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

export async function getProducts(categoryId?: string) {
  let query = supabase.from('products').select('*');
  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }
  const { data, error } = await query.order('name');
  if (error) throw error;
  return data;
}