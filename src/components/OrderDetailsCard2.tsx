import { fetchOrderById } from "@/hooks/useOrders";
import { useOrderStore } from "@/providers/orderStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "./ui/badge";
import { OrderItems } from "./OrderItems";

export function OrderDetailsCard2() {
  const { selectedOrderId, setSelectedOrderId } = useOrderStore();

  const { data: orders, error, isLoading } = fetchOrderById(selectedOrderId!);

  if (!selectedOrderId) return null;
  if (isLoading) return <div>Loading order details...</div>;
  if (error) return <div>Error loading order details</div>;

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
              <span>Order #{order.id}</span>
              <span className="text-muted-foreground font-semibold">
                {new Date(order.date).toLocaleDateString()}
              </span>
              <span> Řidič:</span>
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
