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

  const updateCrates = (type: "crateBig" | "crateSmall", value: number) => {
    if (!orders?.[0]) return;
    updateOrder({
      id: selectedOrderId!,
      updatedFields: { [type]: Math.max(0, value) },
    });
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

            <CardDescription className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span>Order #{order.id}</span>
                <span className="text-muted-foreground font-semibold">
                  {new Date(order.date).toLocaleDateString()}
                </span>
                <span>Řidič:</span>
              </div>
              {user?.role === "admin" && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateCrates("crateBig", (order.crateBig || 0) - 1)
                      }
                    >
                      -
                    </Button>
                    <input
                      type="number"
                      min="0"
                      value={order.crateBig || 0}
                      onChange={(e) =>
                        updateCrates("crateBig", parseInt(e.target.value) || 0)
                      }
                      className="w-16 text-center border rounded-md"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateCrates("crateBig", (order.crateBig || 0) + 1)
                      }
                    >
                      +
                    </Button>
                    <span>Velká</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateCrates("crateSmall", (order.crateSmall || 0) - 1)
                      }
                    >
                      -
                    </Button>
                    <input
                      type="number"
                      min="0"
                      value={order.crateSmall || 0}
                      onChange={(e) =>
                        updateCrates(
                          "crateSmall",
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="w-16 text-center border rounded-md"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateCrates("crateSmall", (order.crateSmall || 0) + 1)
                      }
                    >
                      +
                    </Button>
                    <span>Malá</span>
                  </div>
                </div>
              )}
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
