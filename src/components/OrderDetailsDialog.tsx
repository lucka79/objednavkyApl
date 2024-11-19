import { useFetchOrderById, useUpdateOrder } from "@/hooks/useOrders";
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

import UpdateCart from "./UpdateCart";
import { useUpdateProfile } from "@/hooks/useProfiles";
import {
  Container,
  LockOpen,
  SquareMinus,
  SquarePlus,
  Lock,
} from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import AddProduct from "./AddProduct";

export function OrderDetailsDialog() {
  const user = useAuthStore((state) => state.user);
  const { selectedOrderId, setSelectedOrderId } = useOrderStore();
  const { mutate: updateOrder } = useUpdateOrder();
  const { mutate: updateProfile } = useUpdateProfile();
  const [isLocked, setIsLocked] = useState(false);

  const {
    data: orders,
    error,
    isLoading,
    refetch,
  } = useFetchOrderById(selectedOrderId);

  if (!selectedOrderId) {
    return null;
  }

  const updateStatus = (status: string) => {
    if (!selectedOrderId) return;
    updateOrder({ id: selectedOrderId, updatedFields: { status } });
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

    // Determine which profile field to update based on the type
    const profileField = type.startsWith("crateBig")
      ? "crateBig"
      : "crateSmall";
    const currentTotal = profile?.[profileField as keyof typeof profile] || 0;

    // If it's a received crate, subtract from the total
    const deltaMultiplier = type.includes("Received") ? -1 : 1;
    const newTotal = Math.max(0, currentTotal + delta * deltaMultiplier);

    console.log("Profile Update:", {
      profileField,
      currentTotal,
      delta,
      deltaMultiplier,
      newTotal,
    });

    await updateProfile({
      userId,
      updatedFields: {
        [profileField]: newTotal,
      },
    });
  };

  if (isLoading) return <div>Loading order details...</div>;
  if (error) return <div>Error loading order details</div>;

  return (
    <Dialog
      open={!!selectedOrderId}
      onOpenChange={(open) => !open && setSelectedOrderId(null)}
    >
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto
      print:border-none print:shadow-none print:absolute print:top-0 print:left-0 print:right-0 print:m-0 print:h-auto print:overflow-visible  print:transform-none"
      >
        <DialogHeader>
          <DialogTitle>Detail objednávky</DialogTitle>
          <DialogDescription>
            Detail objednávky včetně informací o zákazníkovi, položkách a stavu
          </DialogDescription>
        </DialogHeader>
        <div className="print:!m-0">
          {orders?.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <CardTitle className="flex justify-between">
                  {order.user.full_name}
                  <Badge variant="outline">{order.status}</Badge>
                </CardTitle>
                <CardDescription className="flex gap-4 print:hidden">
                  <span>Celkový stav přepravek:</span>
                  <span className="flex items-center gap-2 font-semibold">
                    {order.user.crateSmall}
                    <Container size={20} />
                  </span>
                  <span className="flex items-center gap-2 font-semibold">
                    {order.user.crateBig} <Container size={24} />
                  </span>
                </CardDescription>

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
                  <UpdateCart
                    items={order.order_items}
                    orderId={order.id}
                    onUpdate={() => refetch().then(() => {})}
                  />
                ) : (
                  <OrderItems items={order.order_items} />
                )}
              </CardContent>
              <CardContent>
                {user?.role === "admin" && (
                  <Card>
                    {/* <CardHeader>
                      <CardTitle>Vratné obaly</CardTitle>
                    </CardHeader> */}
                    <CardContent className="flex gap-8 justify-between">
                      <div>
                        <CardDescription className="py-2 flex gap-2">
                          <span>Vydané obaly</span>
                          {isLocked ? (
                            <Lock
                              size={16}
                              onClick={() => setIsLocked(false)}
                              className="cursor-pointer text-red-800"
                            />
                          ) : (
                            <LockOpen
                              size={18}
                              onClick={() => setIsLocked(true)}
                              className="cursor-pointer text-green-800"
                            />
                          )}
                        </CardDescription>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            {!isLocked && (
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
                            )}
                            <input
                              type="number"
                              min="0"
                              value={order.crateSmall || 0}
                              onChange={(e) =>
                                !isLocked &&
                                updateCrates(
                                  "crateSmall",
                                  parseInt(e.target.value) || 0
                                )
                              }
                              disabled={isLocked}
                              className="w-16 text-center border rounded-md"
                            />
                            {!isLocked && (
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
                            )}
                            <Container size={20} className="text-yellow-600" />
                          </div>
                          <div className="flex items-center gap-2">
                            {!isLocked && (
                              <SquareMinus
                                size={24}
                                onClick={() =>
                                  updateCrates(
                                    "crateBig",
                                    (order.crateBig || 0) - 1
                                  )
                                }
                                className="cursor-pointer text-stone-300 hover:text-green-800"
                              />
                            )}
                            <input
                              type="number"
                              min="0"
                              value={order.crateBig || 0}
                              onChange={(e) =>
                                !isLocked &&
                                updateCrates(
                                  "crateBig",
                                  parseInt(e.target.value) || 0
                                )
                              }
                              disabled={isLocked}
                              className="w-16 text-center border rounded-md"
                            />
                            {!isLocked && (
                              <SquarePlus
                                size={24}
                                onClick={() =>
                                  updateCrates(
                                    "crateBig",
                                    (order.crateBig || 0) + 1
                                  )
                                }
                                className="cursor-pointer text-stone-300 hover:text-red-800"
                              />
                            )}
                            <Container size={24} className="text-red-800" />
                          </div>
                        </div>
                      </div>
                      <div>
                        <CardDescription className="py-2">
                          Přijaté obaly
                        </CardDescription>
                        <div className="flex flex-col gap-2">
                          {" "}
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
                            <Container size={20} className="text-yellow-600" />
                          </div>
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
                            <Container size={24} className="text-red-800" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
              <CardFooter className="flex flex-col gap-2 print:hidden">
                <div className="flex gap-2 justify-evenly">
                  {user?.role === "admin" && (
                    <>
                      {OrderStatusList.map((status) => (
                        <Badge
                          key={status}
                          variant={
                            order.status === status
                              ? "destructive"
                              : "secondary"
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
                          variant={
                            order.status === status ? "default" : "outline"
                          }
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
                          variant={
                            order.status === status ? "default" : "outline"
                          }
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
      </DialogContent>
    </Dialog>
  );
}
