import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Coins, SquareMinus, SquarePlus, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  useUpdateOrderItems,
  useUpdateOrder,
  useDeleteOrderItem,
} from "@/hooks/useOrders";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { AddProduct } from "@/components/AddProduct";

interface OrderItem {
  id: number;
  product: {
    id: number;
    name: string;
    price: number;
    priceMobil: number;
  };
  quantity: number;
  price: number;
  checked?: boolean;
}

interface UpdateCartProps {
  items: OrderItem[];
  orderId: number;
}

export default function UpdateCart({ items, orderId }: UpdateCartProps) {
  const [orderItems, setOrderItems] = useState<OrderItem[]>(items);
  const { mutate: updateOrderItems } = useUpdateOrderItems();
  const { mutate: updateOrder } = useUpdateOrder();
  const { mutate: deleteOrderItem } = useDeleteOrderItem();
  const { toast } = useToast();
  // const user = useAuthStore((state) => state.user);

  useEffect(() => {
    // Combine duplicate products by summing their quantities
    const combinedItems = items.reduce((acc: OrderItem[], curr) => {
      const existingItem = acc.find(
        (item) => item.product.id === curr.product.id
      );
      if (existingItem) {
        existingItem.quantity += curr.quantity;
        return acc;
      }
      return [...acc, curr];
    }, []);

    // Sort combined items by product name in descending order
    const sortedItems = combinedItems.sort((a, b) =>
      a.product.name.localeCompare(b.product.name, "cs")
    );

    setOrderItems(sortedItems);
  }, [items]);

  const calculateTotal = () => {
    return orderItems.reduce((sum: number, item: OrderItem) => {
      return sum + item.quantity * item.price;
    }, 0);
  };

  const total = useMemo(() => calculateTotal(), [orderItems]);

  const handleDeleteItem = async (itemId: number) => {
    try {
      await deleteOrderItem({ itemId, orderId });
      setOrderItems((prevItems) =>
        prevItems.filter((item) => item.id !== itemId)
      );
    } catch (error) {
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
    if (newQuantity < 0) return;

    if (newQuantity === 0) {
      await handleDeleteItem(itemId);
      return;
    }

    try {
      await updateOrderItems({
        id: itemId,
        updatedFields: {
          quantity: newQuantity,
        },
      });

      // Update local state
      setOrderItems((prevItems) =>
        prevItems.map((item) =>
          item.product.id === productId
            ? { ...item, quantity: newQuantity }
            : item
        )
      );

      // Calculate and update order total
      const newTotal = orderItems.reduce((sum, item) => {
        const itemQuantity =
          item.product.id === productId ? newQuantity : item.quantity;
        return sum + itemQuantity * item.price;
      }, 0);

      await updateOrder({
        id: orderId,
        updatedFields: {
          total: newTotal,
        },
      });
    } catch (error) {
      console.error("Failed to update quantity:", error);
      toast({
        title: "Error",
        description: "Failed to update quantity and total",
        variant: "destructive",
      });
    }
  };

  const saveChanges = async () => {
    try {
      for (const item of orderItems) {
        const updateData = {
          quantity: item.quantity,
          checked: item.checked || false,
          product_id: item.product.id,
        };

        console.log(`Updating item ${item.id}:`, updateData);

        await updateOrderItems({
          id: item.id,
          updatedFields: updateData,
        });
      }

      const newTotal = calculateTotal();
      await updateOrder({
        id: orderId,
        updatedFields: {
          total: newTotal,
        },
      });

      toast({
        title: "Success",
        description: "Order updated successfully",
      });
    } catch (error) {
      console.error("Failed to update order:", error);
      toast({
        title: "Error",
        description: "Failed to update order",
        variant: "destructive",
      });
    }
  };

  const handleCheckChange = async (itemId: number, checked: boolean) => {
    try {
      // Update database first
      await updateOrderItems({
        id: itemId,
        updatedFields: {
          checked,
        },
      });

      // Only update local state after successful database update
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
      {/* <CardHeader><CardTitle>Update Order Items</CardTitle></CardHeader> */}
      <CardContent>
        <div className="flex gap-2 mb-4 pt-2  print:hidden">
          <Badge variant="outline" className="border-green-500">
            Hotovo {getCheckboxCounts().checked}
          </Badge>
          <Badge variant="outline" className="border-amber-500">
            Připravit {getCheckboxCounts().unchecked}
          </Badge>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent
              className="max-w-4xl max-h-[90vh] overflow-y-auto"
              aria-describedby="dialog-description"
            >
              <DialogTitle>Add Product to Order</DialogTitle>
              <div id="dialog-description" className="sr-only">
                Select products to add to the order
              </div>
              <AddProduct orderId={orderId} />
            </DialogContent>
          </Dialog>
        </div>
        {!orderItems || orderItems.length === 0 ? (
          <p>No items in order.</p>
        ) : (
          orderItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between pt-2 mb-2"
            >
              <Checkbox
                checked={item.checked || false}
                onCheckedChange={(checked: boolean) =>
                  handleCheckChange(item.id, checked)
                }
                className="mr-2 border-amber-500 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 data-[state=checked]:text-white print:hidden"
              />
              <span className="text-sm flex-1 text-left mr-4">
                {item.product.name}
              </span>
              <span className="text-sm flex-1 mr-2 text-end">
                {item.price.toFixed(2)} Kč
              </span>
              <div className="flex items-center">
                <SquareMinus
                  onClick={() =>
                    !item.checked &&
                    updateOrderQuantity(
                      item.id,
                      item.product.id,
                      item.quantity - 1
                    )
                  }
                  className={`cursor-pointer ${item.checked ? "text-gray-200" : "text-stone-300 hover:text-stone-400"}`}
                />
                <Input
                  type="number"
                  min="0"
                  value={item.quantity}
                  onChange={(e) =>
                    !item.checked &&
                    updateOrderQuantity(
                      item.id,
                      item.product.id,
                      parseInt(e.target.value)
                    )
                  }
                  className="w-16 mx-2 text-center"
                  disabled={item.checked}
                />
                <SquarePlus
                  onClick={() =>
                    !item.checked &&
                    updateOrderQuantity(
                      item.id,
                      item.product.id,
                      item.quantity + 1
                    )
                  }
                  className={`cursor-pointer ${item.checked ? "text-gray-200" : "text-stone-300 hover:text-stone-400"}`}
                />
                <Label className="w-16 mx-4 text-end">
                  {(item.price * item.quantity).toFixed(2)} Kč
                </Label>
              </div>
            </div>
          ))
        )}
        <Button
          onClick={saveChanges}
          variant="outline"
          className="flex flex-row font-bold text-slate-600 w-full mt-4"
        >
          <Coins className="flex flex-row font-bold text-slate-600 w-1/12 mb-auto" />
          {total.toFixed(2)}
        </Button>
      </CardContent>
    </Card>
  );
}
