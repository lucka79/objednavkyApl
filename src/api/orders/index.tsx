// import { supabase, useAuthStore } from "@/lib/supabase";
// import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// import { InsertTables, UpdateTables } from "types";

// export const getAdminOrderList = ({ archived = false }) => {
//   const statuses = archived ? ["Delivered"] : ["New", "Cooking", "Delivering"];
//   return useQuery({
//     // pokud se nepřidá parametr archived -> budou se zobrazovat aktivní i archived identicky
//     queryKey: ["orders", { archived }],
//     queryFn: async () => {
//       const { data, error } = await supabase
//         .from("orders")
//         .select("*")
//         .in("status", statuses)
//         .order("date", { ascending: false });
//       if (error) {
//         throw new Error(error.message);
//       }
//       return data;
//     },
//   });
// };

// export const getMyOrders = () => {
//   //   const { session } = useAuth();
//   const user = useAuthStore((state) => state.user);
//   const id = user?.id;

//   return useQuery({
//     queryKey: ["orders", { userId: id }],
//     queryFn: async () => {
//       if (!id) return null;

//       const { data, error } = await supabase
//         .from("orders")
//         .select("*")
//         .eq("user_id", id) // id is undefined -> if(!id) return null
//         .order("date", { ascending: false });
//       if (error) {
//         throw new Error(error.message);
//       }
//       return data;
//     },
//   });
// };

// export const getOrderDetails = (id: number) => {
//   return useQuery({
//     queryKey: ["orders", id],
//     queryFn: async () => {
//       const { data, error } = await supabase
//         .from("orders")
//         .select("*, order_items(*, products(*))") // propojené tabulky
//         .eq("id", id)
//         .single();

//       if (error) {
//         throw new Error(error.message);
//       }
//       return data;
//     },
//   });
// };

// export const useInsertOrder = () => {
//   const queryClient = useQueryClient();
//   const user = useAuthStore((state) => state.user);
//   const userId = user?.id;
//   //   const { session } = useAuth();
//   //   const userId = session?.user.id;

//   return useMutation({
//     async mutationFn(data: InsertTables<"orders">) {
//       const { error, data: newOrder } = await supabase
//         .from("orders")
//         .insert({ ...data, user_id: userId })
//         .select()
//         .single();

//       if (error) {
//         throw new Error(error.message);
//       }
//       return newOrder;
//     },
//     async onSuccess() {
//       await queryClient.invalidateQueries({ queryKey: ["orders"] });
//     },
//   });
// };

// export const useUpdateOrder = () => {
//   const queryClient = useQueryClient();

//   return useMutation({
//     async mutationFn({
//       id,
//       updatedFields,
//     }: {
//       id: number;
//       updatedFields: UpdateTables<"orders">;
//     }) {
//       const { error, data: updatedOrder } = await supabase
//         .from("orders")
//         .update(updatedFields)
//         .eq("id", id)
//         .select()
//         .single();

//       if (error) {
//         throw new Error(error.message);
//       }
//       return updatedOrder;
//     },
//     async onSuccess(_, { id }) {
//       await queryClient.invalidateQueries({ queryKey: ["orders"] });
//       await queryClient.invalidateQueries({ queryKey: ["orders", id] });
//     },
//   });
// };
