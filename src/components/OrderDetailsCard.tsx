import { fetchOrderById, useUpdateOrder } from "@/hooks/useOrders";
import { useOrderStore } from "@/providers/orderStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "./ui/badge";
import { OrderItems } from "./OrderItems";
import { OrderStatusList } from "../../types";
import { useAuthStore } from "@/lib/supabase";

export function OrderDetailsCard() {
  const user = useAuthStore((state) => state.user);
  const { selectedOrderId } = useOrderStore();
  const { mutate: updateOrder } = useUpdateOrder();
  const { data: orders, error, isLoading } = fetchOrderById(selectedOrderId!);
  const updateStatus = (status: string) => {
    updateOrder({ id: selectedOrderId!, updatedFields: { status } });
  };

  if (!selectedOrderId) return null;
  if (isLoading) return <div>Loading order details...</div>;
  if (error) return <div>Error loading order details</div>;

  return (
    <div>
      {orders?.map((order) => (
        <Card key={order.id}>
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
          <CardFooter className="flex gap-2 justify-evenly">
            {user?.role === "admin" && (
              <>
                {OrderStatusList.map((status) => (
                  <Badge
                    key={status}
                    variant={order.status === status ? "default" : "outline"}
                    onClick={() => updateStatus(status)}
                    className="cursor-pointer"
                  >
                    {status}
                  </Badge>
                ))}
              </>
            )}
            {user?.role === "expedition" && (
              <>
                {["New", "Expedice"].map((status) => (
                  <Badge
                    key={status}
                    variant={order.status === status ? "default" : "outline"}
                    onClick={() => updateStatus(status)}
                    className="cursor-pointer"
                  >
                    {status}
                  </Badge>
                ))}
              </>
            )}
            {user?.role === "driver" && (
              <>
                {["Expedice", "Delivering"].map((status) => (
                  <Badge
                    key={status}
                    variant={order.status === status ? "default" : "outline"}
                    onClick={() => updateStatus(status)}
                    className="cursor-pointer"
                  >
                    {status}
                  </Badge>
                ))}
              </>
            )}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
