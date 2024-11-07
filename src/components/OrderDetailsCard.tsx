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
import { Button } from "./ui/button";
import { useOrderItemsStore } from "@/providers/orderItemsStore";
import { useCartStore } from "@/providers/cartStore";
import UpdateCart from "./UpdateCart";

export function OrderDetailsCard() {
  const user = useAuthStore((state) => state.user);
  const { selectedOrderId } = useOrderStore();
  const { mutate: updateOrder } = useUpdateOrder();
  const { data: orders, error, isLoading } = fetchOrderById(selectedOrderId!);
  const { orderItems } = useOrderItemsStore();

  const updateStatus = (status: string) => {
    updateOrder({ id: selectedOrderId!, updatedFields: { status } });
  };

  // const handleUpdateOrder = () => {
  //   if (!selectedOrderId || !orders?.[0]?.order_items) return;

  //   const updatedFields = {
  //     order_items: orders[0].order_items.map((item) => ({
  //       id: item.id,
  //       product_id: item.product_id,
  //       quantity: item.quantity,
  //       order_id: selectedOrderId,
  //     })),
  //   };
  //   updateOrder({ id: selectedOrderId, updatedFields });
  // };

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
            {user?.role === "admin" ? (
              <UpdateCart items={order.order_items} orderId={order.id} />
            ) : (
              <OrderItems items={order.order_items} />
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            {/* {user?.role === "admin" && (
              <Button
                onClick={handleUpdateOrder}
                className="w-full"
                variant="outline"
              >
                Save Changes
              </Button>
            )} */}
            <div className="flex gap-2 justify-evenly">
              {user?.role === "admin" && (
                <>
                  {OrderStatusList.map((status) => (
                    <Badge
                      key={status}
                      variant={
                        order.status === status ? "destructive" : "secondary"
                      }
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
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
