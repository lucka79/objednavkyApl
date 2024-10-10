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
import { Coins, SquareMinus, SquarePlus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/supabase";

export const Route = createFileRoute("/cart")({
  component: Cart,
});

export default function Cart() {
  const user = useAuthStore((state) => state.user);
  const { items, removeItem, updateQuantity, clearCart, total, totalMobil } =
    useCartStore();

  const today = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  const buyer = user?.full_name;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Datum:<span className="mx-2">{tomorrow.toLocaleDateString()}</span>
        </CardTitle>
        <CardTitle className="py-2">{buyer}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p>Není vložený výrobek.</p>
        ) : (
          items.map((item) => (
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
                <Label className="w-16 mx-4">
                  {user?.role === "user" && (
                    <>{(item.product.priceMobil * item.quantity).toFixed(2)}</>
                  )}
                  {user?.role === "admin" && (
                    <>{(item.product.price * item.quantity).toFixed(2)}</>
                  )}
                  {/* {(item.product.price * item.quantity).toFixed(2)} Kč */}
                </Label>
                <Button
                  variant="destructive"
                  onClick={() => removeItem(item.product.id)}
                  // className="w-12 ml-8"
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              </div>
            </div>
          ))
        )}
        <Button
          variant="outline"
          className="flex flex-row font-bold text-slate-600 w-full mb-auto"
        >
          <Coins className="flex flex-row font-bold text-slate-600 w-1/12 mb-auto" />
          {user?.role === "user" && totalMobil().toFixed(2)}
          {user?.role === "admin" && total().toFixed(2)}
          {/* {total().toFixed(2)} Kč */}
        </Button>
      </CardContent>
      {/* <CardFooter className="flex flex-row">
        <Button onClick={clearCart}>Clear Cart</Button>
      </CardFooter> */}
    </Card>
  );
}
