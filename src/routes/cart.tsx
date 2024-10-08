import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; //import * as React from "react";

import { useCartStore } from "@/lib/supabase";
import { createFileRoute } from "@tanstack/react-router";
import { SquareMinus, SquarePlus } from "lucide-react";

export const Route = createFileRoute("/cart")({
  component: Cart,
});

function Cart() {
  const { items, removeItem, clearCart, checkout } = useCartStore();

  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Your Cart</h2>
      {items.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="flex justify-between">Quantity</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.productId}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="flex flex-row justify-evenly">
                    <SquarePlus /> {item.quantity} <SquareMinus />
                  </TableCell>
                  <TableCell>${item.price.toFixed(2)}</TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      onClick={() => removeItem(item.id)}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4">
            <p className="text-xl font-bold">Total: ${total.toFixed(2)}</p>
            <div className="mt-4 space-x-4">
              <Button onClick={clearCart} variant="outline">
                Clear Cart
              </Button>
              <Button onClick={checkout}>Checkout</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
