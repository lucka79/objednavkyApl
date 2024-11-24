// import { supabase } from "@/lib/supabase";

// // export const getProducts = async () => {
// //   const { data, error } = await supabase.from("products").select("*");
// //   if (error) throw error;
// //   return data;
// // };

// export const getOrders = async () => {
//   const { data, error } = await supabase.from("orders").select("*");
//   if (error) throw error;
//   return data;
// };

// export const getOrderItems = async (orderId: number) => {
//   const { data, error } = await supabase
//     .from("order_items")
//     .select("*, products(*)")
//     .eq("order_id", orderId);
//   if (error) throw error;
//   return data;
// };
