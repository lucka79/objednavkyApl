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
import { supabase, useAuthStore } from "@/lib/supabase";
import { Button } from "./ui/button";
import { useOrderItemsStore } from "@/providers/orderItemsStore";
import { useCartStore } from "@/providers/cartStore";
import UpdateCart from "./UpdateCart";
import { useUpdateProfile } from "@/hooks/useProfiles";
import { SquareMinus, SquarePlus } from "lucide-react";

export function OrderDetailsCard() {
  const user = useAuthStore((state) => state.user);
  const { selectedOrderId } = useOrderStore();
  const { mutate: updateOrder } = useUpdateOrder();
  const { mutate: updateProfile } = useUpdateProfile();
  const { data: orders, error, isLoading } = fetchOrderById(selectedOrderId!);
  const { orderItems } = useOrderItemsStore();

  const updateStatus = (status: string) => {
    updateOrder({ id: selectedOrderId!, updatedFields: { status } });
  };

  const updateCrates = async (
    type: "crateBig" | "crateSmall" | "crateBigReceived" | "crateSmallReceived",
    value: number
  ) => {
    if (!orders?.[0]) return;

    const oldValue = orders[0][type] || 0;
    const delta = value - oldValue;
    const userId = orders[0].user.id;

    console.log("Update Crates:", {
      type,
      oldValue,
      newValue: value,
      delta,
      userId,
    });

    // Update order
    await updateOrder({
      id: selectedOrderId!,
      updatedFields: { [type]: Math.max(0, value) },
    });

    // Get current profile totals
    const { data: profile } = await supabase
      .from("profiles")
      .select("crateBig,crateSmall")
      .eq("id", userId)
      .single();

    console.log("Current Profile:", profile);

    const totalField = type === "crateBig" ? "crateBig" : "crateSmall";
    const currentTotal = profile?.[totalField as keyof typeof profile] || 0;

    console.log("Profile Update:", {
      totalField,
      currentTotal,
      newTotal: Math.max(0, currentTotal + delta),
    });

    await updateProfile({
      userId,
      updatedFields: {
        [totalField]: Math.max(0, currentTotal + delta),
      },
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
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user?.role === "admin" ? (
              <UpdateCart items={order.order_items} orderId={order.id} />
            ) : (
              <OrderItems items={order.order_items} />
            )}
          </CardContent>
          <CardContent>
            {user?.role === "admin" && (
              <Card>
                <CardHeader>
                  <CardTitle>Vratné obaly</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-8 justify-between">
                  <div>
                    <CardDescription>Vydané obaly</CardDescription>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <SquareMinus
                          size={24}
                          onClick={() =>
                            updateCrates("crateBig", (order.crateBig || 0) - 1)
                          }
                          className="cursor-pointer text-stone-300 hover:text-green-800"
                        />
                        <input
                          type="number"
                          min="0"
                          value={order.crateBig || 0}
                          onChange={(e) =>
                            updateCrates(
                              "crateBig",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-16 text-center border rounded-md"
                        />
                        <SquarePlus
                          size={24}
                          onClick={() =>
                            updateCrates("crateBig", (order.crateBig || 0) + 1)
                          }
                          className="cursor-pointer text-stone-300 hover:text-red-800"
                        />
                        <span>Velká</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <SquareMinus
                          size={24}
                          onClick={() =>
                            updateCrates(
                              "crateSmall",
                              (order.crateSmall || 0) - 1
                            )
                          }
                          className="cursor-pointer text-stone-300 hover:text-green-800"
                        />
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
                        <SquarePlus
                          size={24}
                          onClick={() =>
                            updateCrates(
                              "crateSmall",
                              (order.crateSmall || 0) + 1
                            )
                          }
                          className="cursor-pointer text-stone-300 hover:text-red-800"
                        />
                        <span>Malá</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <CardDescription>Přijaté obaly</CardDescription>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <SquareMinus
                          size={24}
                          onClick={() =>
                            updateCrates(
                              "crateBigReceived",
                              (order.crateBigReceived || 0) - 1
                            )
                          }
                          className="cursor-pointer text-stone-300 hover:text-green-800"
                        />
                        <input
                          type="number"
                          min="0"
                          value={order.crateBigReceived || 0}
                          onChange={(e) =>
                            updateCrates(
                              "crateBigReceived",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-16 text-center border rounded-md"
                        />
                        <SquarePlus
                          size={24}
                          onClick={() =>
                            updateCrates(
                              "crateBigReceived",
                              (order.crateBigReceived || 0) + 1
                            )
                          }
                          className="cursor-pointer text-stone-300 hover:text-red-800"
                        />
                        <span>Velká</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <SquareMinus
                          size={24}
                          onClick={() =>
                            updateCrates(
                              "crateSmallReceived",
                              (order.crateSmallReceived || 0) - 1
                            )
                          }
                          className="cursor-pointer text-stone-300 hover:text-green-800"
                        />
                        <input
                          type="number"
                          min="0"
                          value={order.crateSmallReceived || 0}
                          onChange={(e) =>
                            updateCrates(
                              "crateSmallReceived",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-16 text-center border rounded-md"
                        />
                        <SquarePlus
                          size={24}
                          onClick={() =>
                            updateCrates(
                              "crateSmallReceived",
                              (order.crateSmallReceived || 0) + 1
                            )
                          }
                          className="cursor-pointer text-stone-300 hover:text-red-800"
                        />
                        <span>Malá</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
