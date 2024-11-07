import { useState } from "react";
import { useCartStore } from "@/providers/cartStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Coins, SquareMinus, SquarePlus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface OrderItem {
  product: {
    id: number;
    name: string;
  };
  quantity: number;
}

interface UpdateCartProps {
  items: OrderItem[]; // Update this to match your order items type
}

export default function UpdateCart({ items }: UpdateCartProps) {
  const [orderItems, setOrderItems] = useState(items);
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);

  const calculateTotal = () => {
    return orderItems.reduce((sum: number, item: OrderItem) => {
      return (
        sum +
        item.quantity *
          (user?.role === "admin"
            ? item.product.price
            : item.product.priceMobil)
      );
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
              <span className="text-sm">{item.product.name}</span>
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
                <Label className="w-16 mx-4">
                  {user?.role === "user"
                    ? (item.product.priceMobil * item.quantity).toFixed(2)
                    : (item.product.price * item.quantity).toFixed(2)}
                </Label>
              </div>
            </div>
          ))
        )}
        <Button
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
