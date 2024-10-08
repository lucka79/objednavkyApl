// Cart.tsx

import { useCartStore } from "@/providers/cartStore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/Cart2")({
  component: Cart2,
});

function Cart2() {
  const { items, removeItem, updateQuantity, clearCart, total } =
    useCartStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shopping Cart</CardTitle>
      </CardHeader>
      <CardContent>
        {items.map((item) => (
          <div
            key={item.product.id}
            className="flex items-center justify-between mb-2"
          >
            <span>{item.product.name}</span>
            <div className="flex items-center">
              <Input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) =>
                  updateQuantity(item.product.id, parseInt(e.target.value))
                }
                className="w-16 mr-2"
              />
              <Button
                variant="destructive"
                onClick={() => removeItem(item.product.id)}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex justify-between">
        <span>Total: ${total().toFixed(2)}</span>
        <Button onClick={clearCart}>Clear Cart</Button>
      </CardFooter>
    </Card>
  );
}
