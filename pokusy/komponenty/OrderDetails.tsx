import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

import { Order, OrderItem } from "../../types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { useOrderDetails } from "@/hooks/useOrders";

export function OrderDetails({ id }: { id: string }) {
  const { data: orders, isLoading, error } = useOrderDetails(Number(id));

  if (isLoading) return <div>Loading orders...</div>;
  if (error) return <div>Error loading orders</div>;

  return (
    <Accordion type="single" collapsible className="w-full">
      {orders?.map((order: Order) => (
        <AccordionItem key={order.id} value={`order-${order.id}`}>
          <AccordionTrigger>
            Order #{order.id} -{" "}
            {new Date(order.created_at).toLocaleDateString()}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {order.order_items?.map((item: OrderItem) => (
                <div key={item.id} className="flex justify-between">
                  <span>{item.product.name}</span>
                  <span>
                    {item.quantity} x ${item.price.toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="font-bold">
                Total: $
                {order.order_items
                  ?.reduce(
                    (sum: number, item: { quantity: number; price: number }) =>
                      sum + item.quantity * item.price,
                    0
                  )
                  .toFixed(2)}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
