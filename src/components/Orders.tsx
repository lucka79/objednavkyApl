import { useQuery } from "@tanstack/react-query";
import { fetchOrdersByUserId } from "@/hooks/useOrders";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { OrderItems } from "./OrderItems";
import { useAuthStore } from "@/lib/supabase";
import { Badge } from "./ui/badge";

export function Orders() {
  const user = useAuthStore((state) => state.user);
  const {
    data: orders,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: () => fetchOrdersByUserId(user!.id),
    enabled: !!user,
  });

  if (!user) return <div>Please log in to view your orders.</div>;
  if (isLoading) return <div>Loading orders...</div>;
  if (error) return <div>Error loading orders: {(error as Error).message}</div>;

  return (
    <Accordion type="single" collapsible className="w-3/4">
      {orders?.map((order) => (
        <AccordionItem key={order.id} value={`order-${order.id}`}>
          <AccordionTrigger>
            Order #{order.id} - {new Date(order.date).toLocaleDateString()}
            <Badge variant="outline">{order.status}</Badge>
            <span> {order.total.toFixed(2)} Kč</span>
          </AccordionTrigger>
          <AccordionContent>
            <OrderItems items={order.order_items} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
