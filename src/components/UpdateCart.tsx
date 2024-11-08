import { useState } from "react";
import { useCartStore } from "@/providers/cartStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Coins, SquareMinus, SquarePlus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useUpdateOrderItems, useUpdateOrder } from "@/hooks/useOrders";
import { Checkbox } from "@/components/ui/checkbox";

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
  const [orderItems, setOrderItems] = useState(items);
  const { mutate: updateOrderItems } = useUpdateOrderItems();
  const { mutate: updateOrder } = useUpdateOrder();
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);

  const calculateTotal = () => {
    console.log("Calculating total with items:", orderItems);
    return orderItems.reduce((sum: number, item: OrderItem) => {
      return sum + item.quantity * item.price;
    }, 0);
  };

  const updateOrderQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) return;

    setOrderItems((prevItems) =>
      prevItems.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update Order Items</CardTitle>
      </CardHeader>
      <CardContent>
        {!orderItems || orderItems.length === 0 ? (
          <p>No items in order.</p>
        ) : (
          orderItems.map((item) => (
            <div
              key={item.product.id}
              className="flex items-center justify-between mb-2"
            >
              <Checkbox
                checked={item.checked || false}
                onCheckedChange={(checked: boolean) =>
                  handleCheckChange(item.id, checked)
                }
                className="mr-2"
              />
              <span className="text-sm">{item.product.name}</span>
              <span className="text-sm text-end">
                {item.price.toFixed(2)} Kč
              </span>
              <div className="flex items-center">
                <SquareMinus
                  onClick={() =>
                    updateOrderQuantity(item.product.id, item.quantity - 1)
                  }
                  className="text-stone-300 cursor-pointer"
                />
                <Input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) =>
                    updateOrderQuantity(
                      item.product.id,
                      parseInt(e.target.value)
                    )
                  }
                  className="w-16 mx-2 text-center"
                />
                <SquarePlus
                  onClick={() =>
                    updateOrderQuantity(item.product.id, item.quantity + 1)
                  }
                  className="text-stone-300 cursor-pointer"
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
          {calculateTotal().toFixed(2)}
        </Button>
      </CardContent>
    </Card>
  );
}
