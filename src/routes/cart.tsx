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
import { SquareMinus, SquarePlus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/cart")({
  component: Cart,
});

function Cart() {
  const { items, removeItem, updateQuantity, clearCart, total } =
    useCartStore();

  return (
    <Card className="w-1/2">
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
              <SquareMinus
                onClick={() =>
                  updateQuantity(item.product.id, item.quantity - 1)
                }
                className="text-stone-300"
              />
              <Input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) =>
                  updateQuantity(item.product.id, parseInt(e.target.value))
                }
                className="w-16 mx-4 text-center"
              />
              <SquarePlus
                onClick={() =>
                  updateQuantity(item.product.id, item.quantity + 1)
                }
                className="text-stone-300"
              />
              <Label className="w-16 mx-8">
                {(item.product.price * item.quantity).toFixed(2)} Kč
              </Label>
              <Button
                variant="destructive"
                onClick={() => removeItem(item.product.id)}
                className="w-12 ml-8"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex flex-row-reverse">
        <Badge variant="outline">
          <Label>Celkem: {total().toFixed(2)} Kč</Label>
        </Badge>

        <Button onClick={clearCart}>Clear Cart</Button>
      </CardFooter>
    </Card>
  );
}
