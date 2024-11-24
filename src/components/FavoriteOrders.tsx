import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { useAuthStore } from "@/lib/supabase";

import { FavoriteItems } from "./FavoriteItems";
import { fetchFavoriteOrdersByUserId } from "@/hooks/useFavorites";

export function FavoriteOrders() {
  const user = useAuthStore((state) => state.user);
  const {
    data: orders,
    error,
    isLoading,
  } = fetchFavoriteOrdersByUserId(user!.id);

  if (!user) return <div>Please log in to view your orders.</div>;
  if (isLoading) return <div>Loading orders...</div>;
  if (error) return <div>Error loading orders: {(error as Error).message}</div>;
  if (!orders || orders.length === 0)
    return <div>No favorite orders found.</div>;

  return (
    <Accordion type="single" collapsible className="w-3/4">
      {orders.map((order) => (
        <AccordionItem key={order.id} value={`order-${order.id}`}>
          <AccordionTrigger>
            Order #{order.id} - {order.day}
          </AccordionTrigger>
          <AccordionContent>
            <FavoriteItems items={order.favorite_items || []} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
