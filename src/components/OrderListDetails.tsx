// ProductList.tsx
import React from "react";
import { useProducts } from "@/hooks/useProducts";
import { useCartStore } from "@/providers/cartStore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useOrders } from "@/hooks/useOrders";
import { Badge } from "./ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { OrderItem } from "types";

export const OrderListDetails: React.FC = () => {
  const { data: orders, isLoading, error } = useOrders();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <Accordion type="single" collapsible className="w-full">
      {orders?.map((order) => (
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
};
