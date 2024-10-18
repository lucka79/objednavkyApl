import { fetchAllOrders } from "@/hooks/useOrders";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { OrderItems } from "./OrderItems";
import { useAuthStore } from "@/lib/supabase";
import { Badge } from "./ui/badge";
import { Loader2 } from "lucide-react";

export function OrdersAdmin() {
  const user = useAuthStore((state) => state.user);
  const { data: orders, error, isLoading } = fetchAllOrders();

  if (!user) return <div>Please log in to view your orders.</div>;
  if (isLoading)
    return (
      <div>
        <Loader2 className="animate-spin" />
      </div>
    );
  if (error) return <div>Error loading orders: {(error as Error).message}</div>;

  return (
    <>
      <Accordion type="single" collapsible className="w-3/4">
        {orders?.map((order) => (
          <AccordionItem key={order.id} value={`order-${order.id}`}>
            <AccordionTrigger>
              {new Date(order.date).toLocaleDateString()}
              <span>Order #{order.id}</span>
              <span>{order.user.full_name}</span>
              <Badge variant="outline">{order.status}</Badge>
              <span> {order.total.toFixed(2)} Kč</span>
            </AccordionTrigger>
            <AccordionContent>
              <OrderItems items={order.order_items} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </>
  );
}
