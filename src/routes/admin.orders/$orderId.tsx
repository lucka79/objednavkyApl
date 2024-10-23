import { createFileRoute } from "@tanstack/react-router";
import { fetchOrderById } from "@/hooks/useOrders";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";

import { useOrderStore } from "@/providers/orderStore";
import { useAuthStore } from "@/lib/supabase";
import { OrderItems } from "@/components/OrderItems";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/orders/$orderId")({
  component: OrderDetails,
});

export function OrderDetails() {
  const user = useAuthStore((state) => state.user);
  const selectedOrderId = useOrderStore((state) => state.selectedOrderId);
  const setSelectedOrderId = useOrderStore((state) => state.setSelectedOrderId);

  const { data: orders, error, isLoading } = fetchOrderById(selectedOrderId!);

  if (user?.role !== "admin") {
    return <div>Access denied. Admin only.</div>;
  }

  //   const order = orders.find((o: Order) => o.id === parseInt(orderId));
  if (isLoading) {
    return <Loader2 className="animate-spin" />;
  }

  if (error || !orders) {
    return <Label>Nepovedlo se získat data objednavek.</Label>;
  }

  return (
    <div>
      {orders?.map((order) => (
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between">
              {order.user.full_name}
              <Badge variant="outline">{order.status}</Badge>
            </CardTitle>
            <CardDescription className="flex justify-between">
              {/* Order ID: {selectedOrderId} */}
              Order #{order.id}{" "}
              <span className="text-muted-foreground font-semibold">
                {new Date(order.date).toLocaleDateString()}
              </span>
              <span> {order.total} Kč</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrderItems items={order.order_items} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
