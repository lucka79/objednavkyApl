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
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useDriverUsers } from "@/hooks/useProfiles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice } from "@/lib/utils";
import { Input } from "./ui/input";
import { OrderPrint } from "./OrderPrint";
import ReactDOMServer from "react-dom/server";

// import React from "react";

export function OrderDetailsDialog() {
  const user = useAuthStore((state) => state.user);
  const { selectedOrderId, setSelectedOrderId } = useOrderStore();
  const { mutate: updateOrder } = useUpdateOrder();
  const { mutate: updateProfile } = useUpdateProfile();
  const [isLocked, setIsLocked] = useState(false);
  const { data: driverUsers } = useDriverUsers();
  const [localNote, setLocalNote] = useState("");
  const {
    data: orders,
    error,
    isLoading,
    refetch,
  } = useFetchOrderById(selectedOrderId);
  const [localCrates, setLocalCrates] = useState({
    crateSmall: 0,
    crateBig: 0,
    crateSmallReceived: 0,
    crateBigReceived: 0,
  });

  useEffect(() => {
    if (orders?.[0]) {
      setLocalCrates({
        crateSmall: orders[0].crateSmall || 0,
        crateBig: orders[0].crateBig || 0,
        crateSmallReceived: orders[0].crateSmallReceived || 0,
        crateBigReceived: orders[0].crateBigReceived || 0,
      });
    }
  }, [orders]);

  const saveNote = (id: number, note: string) => {
    updateOrder({
      id,
      updatedFields: { note: note.trim() || "-" },
    });
    setLocalNote(""); // Reset local note after saving
  };

  const handlePrintOrder = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Tisk objednávky</title>
          <style>
          @page { size: A4;  }
            body { font-family: Arial; sans-serif; padding: 10px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          </style>
            <script>
              window.onafterprint = function() {
                if (window.location.href === 'about:blank') {
                  window.close();
                }
              };
              window.onload = function() {
                window.print();
                if (window.location.href === 'about:blank') {
                  window.close();
                }
              };
            </script>
          </head>
          <body>
            ${ReactDOMServer.renderToString(<OrderPrint orders={orders || []} />)}
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "p") {
        e.preventDefault();
        handlePrintOrder();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [orders]);

  // Context menu (right-click)
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (
        e.target instanceof HTMLElement &&
        e.target.closest('[role="dialog"]')
      ) {
        e.preventDefault();
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>Tisk objednávky</title>
          <style>
          @page { size: A4;  }
            body { font-family: Arial; sans-serif; padding: 10px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          </style>
                <script>
                  window.onafterprint = function() {
                    if (window.location.href === 'about:blank') {
                      window.close();
                    }
                  };
                  window.onload = function() {
                    window.print();
                    if (window.location.href === 'about:blank') {
                      window.close();
                    }
                  };
                  window.onkeydown = function(e) {
                    if (e.key === 'Escape') {
                      window.close();
                    }
                  };
                  setTimeout(function() {
                    if (window.location.href === 'about:blank') {
                      window.close();
                    }
                  }, 1000);
                </script>
              </head>
              <body>
                <div class="page">
                  ${ReactDOMServer.renderToString(<OrderPrint orders={orders || []} />)}
                </div>
              </body>
            </html>
          `);
          printWindow.document.close();
        }
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    return () => window.removeEventListener("contextmenu", handleContextMenu);
  }, [orders]);

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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:p-0 print:w-full">
        <style type="text/css" media="print">
          {`
            @page { size: auto; margin: 20mm; }
            @media print {
              .dialog-content { display: none; }
              .print-section { display: block; }
              
            }
          `}
        </style>

        <div className="hidden print:block mt-8 p-4">
          <OrderPrint orders={orders || []} />
        </div>

        <div className="print:hidden">
          <DialogHeader className="print:hidden">
            <div className="flex justify-between items-center">
              <div>
                <DialogTitle>Detail objednávky</DialogTitle>
                <DialogDescription>
                  Detail objednávky včetně informací o zákazníkovi, položkách a
                  stavu
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="print:hidden">
            {orders?.map((order) => (
              <Card key={order.id}>
                <CardHeader>
                  <CardTitle className="flex justify-between">
                    {order.user.full_name}

                    <span className="text-muted-foreground text-stone-500 text-thin">
                      {order.user.address}
                    </span>
                    <Badge variant="outline">{order.status}</Badge>
                  </CardTitle>
                  <CardDescription className="flex justify-between items-center print:hidden">
                    <div className="flex gap-4">
                      <span>Celkový stav přepravek:</span>
                      <span className="flex items-center gap-2 font-semibold">
                        {order.user.crateSmall}
                        <Container size={20} />
                      </span>
                      <span className="flex items-center gap-2 font-semibold">
                        {order.user.crateBig} <Container size={24} />
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        autoFocus={false}
                        value={
                          localNote || (order.note !== "-" ? order.note : "")
                        }
                        onChange={(e) => {
                          setLocalNote(e.target.value);
                        }}
                        onBlur={(e) => {
                          saveNote(order.id, e.target.value);
                        }}
                        className={`border rounded px-2 py-1 text-sm w-60 text-right ${
                          localNote || order.note !== "-"
                            ? "border-orange-500"
                            : ""
                        }`}
                        placeholder="Přidat poznámku..."
                      />
                      {(localNote || order.note !== "-") && (
                        <X
                          size={16}
                          className="cursor-pointer text-gray-500 hover:text-red-500"
                          onClick={() => saveNote(order.id, "-")}
                        />
                      )}
                    </div>
                  </CardDescription>

                  <CardDescription className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span>Order #{order.id}</span>
                      <span className="text-muted-foreground font-semibold">
                        {new Date(order.date).toLocaleDateString()}
                      </span>
                      <Select
                        value={order.driver?.id || "none"}
                        onValueChange={(value) =>
                          updateOrder({
                            id: order.id,
                            updatedFields: {
                              driver_id: value === "none" ? null : value,
                            },
                          })
                        }
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Vyberte řidiče" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Bez řidiče</SelectItem>
                          {driverUsers?.map((driver) => (
                            <SelectItem key={driver.id} value={driver.id}>
                              {driver.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {user?.role === "admin" || user?.role === "expedition" ? (
                    <UpdateCart
                      items={order.order_items}
                      orderId={order.id}
                      selectedUserId={order.user.id}
                      onUpdate={() => refetch().then(() => {})}
                      order={order}
                    />
                  ) : (
                    <OrderItems items={order.order_items} />
                  )}
                </CardContent>
                {(order.user?.role === "buyer" ||
                  order.user?.role === "store") && (
                  <CardContent>
                    <div className="flex flex-col items-end font-bold text-slate-600 w-full mt-1 mr-8">
                      {order.user?.role === "buyer" && (
                        <>
                          <div className="text-sm font-normal text-muted-foreground">
                            DPH (12%) {formatPrice(order.total * 0.12)} Kč
                          </div>
                          <div className="text-base">
                            {formatPrice(Math.round(order.total * 1.12))} Kč
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                )}
                <CardContent>
                  {(user?.role === "admin" || user?.role === "expedition") && (
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
                              {order.crateSmall > 0 && (
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
                                value={localCrates.crateSmall}
                                onChange={(e) =>
                                  setLocalCrates({
                                    ...localCrates,
                                    crateSmall: parseInt(e.target.value) || 0,
                                  })
                                }
                                onBlur={(e) =>
                                  updateCrates(
                                    "crateSmall",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="w-12 mx-2 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                              <Container
                                size={20}
                                className="text-yellow-600"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              {order.crateBig > 0 && (
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
                                value={localCrates.crateBig}
                                onChange={(e) =>
                                  setLocalCrates({
                                    ...localCrates,
                                    crateBig: parseInt(e.target.value) || 0,
                                  })
                                }
                                onBlur={(e) =>
                                  updateCrates(
                                    "crateBig",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="w-12 mx-2 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                              {order.crateSmallReceived > 0 && (
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
                              )}
                              <input
                                type="number"
                                min="0"
                                value={localCrates.crateSmallReceived}
                                onChange={(e) =>
                                  setLocalCrates({
                                    ...localCrates,
                                    crateSmallReceived:
                                      parseInt(e.target.value) || 0,
                                  })
                                }
                                onBlur={(e) =>
                                  updateCrates(
                                    "crateSmallReceived",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="w-12 mx-2 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                              <Container
                                size={20}
                                className="text-yellow-600"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              {order.crateBigReceived > 0 && (
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
                              )}
                              <input
                                type="number"
                                min="0"
                                value={localCrates.crateBigReceived}
                                onChange={(e) =>
                                  setLocalCrates({
                                    ...localCrates,
                                    crateBigReceived:
                                      parseInt(e.target.value) || 0,
                                  })
                                }
                                onBlur={(e) =>
                                  updateCrates(
                                    "crateBigReceived",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="w-12 mx-2 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                        {["New", "Expedice R", "Expedice O", "Přeprava"].map(
                          (status) => (
                            <Badge
                              key={status}
                              variant={
                                order.status === status
                                  ? "destructive"
                                  : "outline"
                              }
                              onClick={() => updateStatus(status)}
                              className="cursor-pointer"
                            >
                              {status}
                            </Badge>
                          )
                        )}
                      </>
                    )}
                    {user?.role === "driver" && (
                      <>
                        {["Expedice R", "Expedice O", "Přeprava"].map(
                          (status) => (
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
                          )
                        )}
                      </>
                    )}
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
