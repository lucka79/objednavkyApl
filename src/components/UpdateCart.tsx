import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  SquareMinus,
  SquarePlus,
  Plus,
  History,
  Trash2,
  Lock,
  Unlock,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  useUpdateOrderItems,
  useUpdateOrder,
  useDeleteOrderItem,
  useOrderItemHistory,
  useUpdateStoredItems,
} from "@/hooks/useOrders";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddProduct } from "@/components/AddProduct";

import { useOrderItemsHistory } from "@/hooks/useOrders";
import { useAuthStore } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { useIsOrderInvoiced } from "@/hooks/useInvoices";
import { useOrderLockStore } from "@/providers/orderLockStore";
import { useUpdateInvoiceTotal } from "@/hooks/useInvoices";

interface OrderItem {
  id: number;
  product: {
    id: number;
    name: string;
    price: number;
    priceMobil: number;
    priceBuyer: number;
    code: string;
  };
  quantity: number;
  price: number;
  checked?: boolean;
}

interface UpdateCartProps {
  items: OrderItem[];
  orderId: number;
  onUpdate: () => Promise<void>;
  selectedUserId: string;
  order: { status: string };
}

// interface OrderHistory {
//   id: number;
//   old_quantity: number;
//   new_quantity: number;
//   changed_at: string;
//   product_name: string;
//   changed_by: { full_name: string }[];
//   order_item_id: number;
//   order_id: number;
// }

const HistoryDialog = ({ itemId }: { itemId: number }) => {
  const { data: historyData } = useOrderItemHistory(itemId);

  if (!historyData || historyData.length === 0) {
    return (
      <div className="p-4 text-sm text-slate-500">
        No changes have been recorded for this item.
      </div>
    );
  }

  return (
    <div className="flex flex-col max-h-[400px] overflow-y-auto w-[400px]">
      {historyData.map((entry: any) => (
        <div
          key={entry.id}
          className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-2"
        >
          <div className="font-medium text-slate-900">
            {/* @ts-ignore */}
            {entry.order_items?.product?.name || "Unknown Product"}
          </div>
          <div className="text-xs text-slate-600">
            {" ID # "}
            {entry.order_item_id}
          </div>
          <div className="text-sm text-slate-600">
            Quantity: {entry.old_quantity} → {entry.new_quantity}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {/* @ts-ignore */}
            Changed by: {entry.profiles?.full_name || "Unknown User"}
          </div>
          <div className="text-xs text-slate-400">
            {new Date(entry.changed_at).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
};

export default function UpdateCart({
  items,
  orderId,
  onUpdate,
  selectedUserId,
  order,
}: UpdateCartProps) {
  const [orderItems, setOrderItems] = useState<OrderItem[]>(items);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const { mutate: updateOrderItems } = useUpdateOrderItems();
  const { mutate: updateOrder } = useUpdateOrder();
  const { mutateAsync: updateStoredItems } = useUpdateStoredItems();
  const { mutateAsync: deleteOrderItem } = useDeleteOrderItem();
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);
  const { data: invoicedOrderIds } = useIsOrderInvoiced();
  const isLocked = invoicedOrderIds?.has(orderId);
  const { isOrderUnlocked, lockOrder, unlockOrder } = useOrderLockStore();
  const isReadOnly = isLocked && !isOrderUnlocked(orderId);
  const { mutate: updateInvoiceTotal } = useUpdateInvoiceTotal();

  // @ts-ignore
  const { data: historyData, isLoading } = useOrderItemHistory(selectedItemId);
  const { data: allHistoryData } = useOrderItemsHistory(orderItems);

  const canUnlock = user?.role === "admin";

  const toggleLock = () => {
    if (!canUnlock) return;
    const currentlyUnlocked = isOrderUnlocked(orderId);
    if (currentlyUnlocked) {
      lockOrder(orderId);
    } else {
      unlockOrder(orderId);
    }
    toast({
      title: currentlyUnlocked ? "Order locked" : "Order unlocked",
      description: currentlyUnlocked
        ? "The order has been locked"
        : "The order is now unlocked. You can make changes.",
      variant: currentlyUnlocked ? "default" : "destructive",
    });
  };

  useEffect(() => {
    console.log("Received items:", items);

    // Combine duplicate products by summing their quantities
    const combinedItems = items.reduce((acc: OrderItem[], curr) => {
      console.log("Processing item:", curr);

      const existingItem = acc.find(
        (item) => item.product.id === curr.product.id
      );
      if (existingItem) {
        console.log("Found existing item:", existingItem);
        existingItem.quantity += curr.quantity;
        return acc;
      }
      return [...acc, curr];
    }, []);

    console.log("Combined items:", combinedItems);

    // Sort items: non-zero quantities first, then by name, then zero quantities last
    const sortedItems = combinedItems.sort((a, b) => {
      // First sort by quantity (non-zero first)
      if ((a.quantity === 0) !== (b.quantity === 0)) {
        return a.quantity === 0 ? 1 : -1;
      }
      // Then sort by name
      return a.product.name.localeCompare(b.product.name, "cs");
    });

    console.log("Sorted items:", sortedItems);

    setOrderItems(sortedItems);
  }, [items]);

  const calculateTotal = () => {
    return orderItems.reduce((sum: number, item: OrderItem) => {
      return sum + item.quantity * item.price;
    }, 0);
  };

  const total = useMemo(() => calculateTotal(), [orderItems]);

  const handleDeleteItem = async (itemId: number) => {
    if (isReadOnly) {
      toast({
        title: "Order is locked",
        description: "This order is part of an invoice and cannot be modified.",
        variant: "destructive",
      });
      return;
    }
    try {
      // First delete history records - corrected table name
      await supabase
        .from("order_items_history")
        .delete()
        .eq("order_item_id", itemId);

      // Then delete the order item
      await deleteOrderItem({ itemId, orderId });
      await onUpdate();
      setOrderItems((prevItems) =>
        prevItems.filter((item) => item.id !== itemId)
      );
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      });
    }
  };

  const updateOrderQuantity = async (
    itemId: number,
    productId: number,
    newQuantity: number
  ) => {
    if (isReadOnly) {
      toast({
        title: "Order is locked",
        description: "This order is part of an invoice and cannot be modified.",
        variant: "destructive",
      });
      return;
    }
    if (newQuantity < 0) return;

    try {
      const currentItem = orderItems.find((item) => item.id === itemId);
      if (!currentItem) return;

      const quantityDifference = newQuantity - currentItem.quantity;

      // Update the order item quantity
      await updateOrderItems({
        id: itemId,
        updatedFields: {
          quantity: newQuantity,
        },
      });

      // Update stored items if quantity changed
      if (quantityDifference !== 0) {
        await updateStoredItems({
          userId: selectedUserId,
          items: [
            {
              product_id: productId,
              // When increasing order quantity (positive difference), increase stored items
              // When decreasing order quantity (negative difference), decrease stored items
              quantity: -quantityDifference,
            },
          ],
        });
      }

      // Update local state
      const updatedItems = orderItems.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: newQuantity }
          : item
      );
      setOrderItems(updatedItems);

      // Calculate and update order total
      const newTotal = updatedItems.reduce(
        (sum, item) => sum + item.quantity * item.price,
        0
      );

      // Update order total in database
      await updateOrder({
        id: orderId,
        updatedFields: {
          total: newTotal,
        },
      });

      // Refresh the data
      await onUpdate();

      // After successful update, recalculate invoice total if order is invoiced
      if (isLocked) {
        const { data: invoice } = await supabase
          .from("invoices")
          .select("id")
          .contains("order_ids", [orderId])
          .single();

        if (invoice) {
          updateInvoiceTotal(invoice.id);
        }
      }
    } catch (error) {
      console.error("Failed to update quantity:", error);
      toast({
        title: "Error",
        description: "Failed to update quantity and total",
        variant: "destructive",
      });
    }
  };

  const handleCheckChange = async (itemId: number, checked: boolean) => {
    if (
      isReadOnly &&
      !(user?.role === "store" && order?.status === "Přeprava")
    ) {
      toast({
        title: "Order is locked",
        description: "This order is part of an invoice and cannot be modified.",
        variant: "destructive",
      });
      return;
    }
    try {
      await updateOrderItems({
        id: itemId,
        updatedFields: {
          checked,
        },
      });

      setOrderItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId ? { ...item, checked } : item
        )
      );
    } catch (error) {
      console.error("Failed to update item check status:", error);
      toast({
        title: "Error",
        description: "Failed to update item status",
        variant: "destructive",
      });
    }
  };

  const getCheckboxCounts = () => {
    const checked = orderItems.filter((item) => item.checked).length;
    const unchecked = orderItems.filter((item) => !item.checked).length;
    return { checked, unchecked };
  };

  return (
    <Card>
      <CardContent>
        <div className="flex gap-2 mb-4 pt-2 print:hidden">
          {isLocked && canUnlock && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLock}
              className={
                isOrderUnlocked(orderId)
                  ? "text-red-600"
                  : "text-muted-foreground"
              }
            >
              {isOrderUnlocked(orderId) ? (
                <Unlock className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
            </Button>
          )}
          <Badge variant="outline" className="border-green-500">
            Hotovo {getCheckboxCounts().checked}
          </Badge>
          <Badge variant="outline" className="border-amber-500">
            Připravit {getCheckboxCounts().unchecked}
          </Badge>
          <div className="flex gap-2 ml-auto">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isReadOnly}>
                  <Plus className="h-4 w-4 mr-2" />
                  Položka
                </Button>
              </DialogTrigger>
              <DialogContent
                className="max-w-6xl max-h-[90vh] overflow-y-auto"
                aria-describedby="dialog-description"
              >
                <DialogTitle>Add Product to Order</DialogTitle>
                <div id="dialog-description" className="sr-only">
                  Select products to add to the order
                </div>
                <AddProduct orderId={orderId} onUpdate={onUpdate} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
        {!orderItems || orderItems.length === 0 ? (
          <p>No items in order.</p>
        ) : (
          orderItems.map((item) => (
            <div
              key={item.id}
              className={`flex flex-row items-center pt-2 mb-2 ${
                item.quantity === 0 ? "text-gray-400 scale-95 print:hidden" : ""
              }`}
            >
              {(user?.role === "admin" ||
                user?.role === "expedition" ||
                (user?.role === "store" && order?.status === "Přeprava")) && (
                <Checkbox
                  checked={item.checked || false}
                  onCheckedChange={(checked: boolean) =>
                    handleCheckChange(item.id, checked)
                  }
                  disabled={isReadOnly}
                  className="mr-2 border-amber-500 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 data-[state=checked]:text-white print:hidden"
                />
              )}
              <div className="text-xs w-10 text-left inline-block text-slate-500">
                {item.product.code || "\u00A0"}
              </div>
              <div className="text-sm w-120 inline-block text-left mr-2">
                {item.product.name}
              </div>
              <div className="text-sm flex-1 mr-2 text-end">
                {item.price.toFixed(2)} Kč
              </div>
              <div className="flex items-center">
                {(item.quantity || 0) > 0 && (
                  <SquareMinus
                    onClick={() =>
                      !item.checked &&
                      !isReadOnly &&
                      updateOrderQuantity(
                        item.id,
                        item.product.id,
                        item.quantity - 1
                      )
                    }
                    className={`cursor-pointer ${
                      item.checked || isReadOnly
                        ? "text-gray-200 cursor-not-allowed"
                        : "text-stone-300 hover:text-stone-400"
                    }`}
                  />
                )}
                <Input
                  type="number"
                  min="0"
                  value={item.quantity}
                  onChange={(e) => {
                    if (isReadOnly) return;
                    const newItem = {
                      ...item,
                      quantity: parseInt(e.target.value) || 0,
                    };
                    setOrderItems((prev) =>
                      prev.map((i) => (i.id === item.id ? newItem : i))
                    );
                  }}
                  onBlur={(e) =>
                    !item.checked &&
                    !isReadOnly &&
                    updateOrderQuantity(
                      item.id,
                      item.product.id,
                      parseInt(e.target.value) || 0
                    )
                  }
                  disabled={item.checked || isReadOnly}
                  className={`w-20 mx-2 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                    item.quantity === 0 ? "text-gray-600" : ""
                  }`}
                />
                <SquarePlus
                  onClick={() =>
                    !item.checked &&
                    !isReadOnly &&
                    updateOrderQuantity(
                      item.id,
                      item.product.id,
                      item.quantity + 1
                    )
                  }
                  className={`cursor-pointer ${
                    item.checked || isReadOnly
                      ? "text-gray-200 cursor-not-allowed"
                      : "text-stone-300 hover:text-stone-400"
                  }`}
                />
                <Label className="w-20 inline-block text-left mx-2">
                  {(item.price * item.quantity).toFixed(2)} Kč
                </Label>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!allHistoryData?.includes(item.id)}
                      className={`ml-2 ${
                        !allHistoryData?.includes(item.id)
                          ? "opacity-30 cursor-not-allowed"
                          : "hover:bg-slate-50"
                      }`}
                      onClick={() => setSelectedItemId(item.id)}
                    >
                      <History className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Historie položky</DialogTitle>
                    </DialogHeader>
                    <HistoryDialog itemId={item.id} />
                  </DialogContent>
                </Dialog>
                {user?.role === "admin" && (
                  <Trash2
                    onClick={() => !isReadOnly && handleDeleteItem(item.id)}
                    className={`h-4 w-4 cursor-pointer ml-2 ${
                      isReadOnly
                        ? "text-gray-200 cursor-not-allowed"
                        : "text-stone-300 hover:text-red-500"
                    }`}
                  />
                )}
              </div>
            </div>
          ))
        )}
        <div className="flex flex-row justify-end font-bold text-slate-600 w-full mt-4">
          <span className="text-base">{total.toFixed(2)} Kč</span>
        </div>
      </CardContent>
    </Card>
  );
}
