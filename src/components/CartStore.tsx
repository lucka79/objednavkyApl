// Cart.tsx
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Coins, SquareMinus, SquarePlus } from "lucide-react";
import { Label } from "@/components/ui/label";
// import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useReceiptStore } from "@/providers/receiptStore";
import { useInsertReceipt, useInsertReceiptItems } from "@/hooks/useReceipts";

export default function CartStore() {
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);
  const { mutateAsync: insertReceipt } = useInsertReceipt();
  const { mutateAsync: insertReceiptItems } = useInsertReceiptItems();
  const {
    items,
    // removeItem,
    updateQuantity,
    clearCart,

    checkout,
  } = useReceiptStore();

  const date = new Date();
  date.setHours(date.getHours() + 1); // Add 1 hour to the current date
  const formattedDate = date.toISOString(); // Format the date to ISO string for database

  // Format the current date for display
  const displayDate = date.toLocaleDateString("cs-CZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      return sum + item.product.price * item.quantity;
    }, 0);
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast({
        title: "Error",
        description: "Zeje to tu prázdnotou",
        variant: "destructive",
      });
      return;
    }

    try {
      const orderTotal = calculateTotal();
      console.log(
        "Položky na účtence:",
        items.map((item) => ({
          productId: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
        }))
      );

      await checkout(
        insertReceipt,
        insertReceiptItems,
        new Date(formattedDate),
        orderTotal
      );

      toast({
        title: "Účtenka vytvořena",
        description: "Účtenka byla vytvořena",
        variant: "default",
      });
      console.log("Checkout účtenky completed");
    } catch (error) {
      console.error("Checkout účtenky failed:", error);
      toast({
        title: "Chyba při vytvoření účtenky",
        description: "Při vytvoření účtenky nastala chyba.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2">
          <CardTitle className="flex flex-row justify-between gap-2">
            <div className="w-[200px]">{user?.full_name}</div>

            <Button
              variant="outline"
              onClick={() => {
                clearCart();
              }}
            >
              Smazat
            </Button>
          </CardTitle>
        </div>
        <CardDescription>
          <div className="text-sm">{displayDate}</div>{" "}
          {/* Display the formatted date */}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.length === 0 ? (
          <p>Není vložený výrobek.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.product.id}
              className="flex items-center justify-between mb-2"
            >
              <span className="text-sm line-clamp-1 hover:line-clamp-2">
                {item.product.name}
              </span>
              <span className="text-sm mx-1">
                {user?.role === "store" && <>{item.product.price.toFixed(2)}</>}
                {user?.role === "user" && <>{item.product.price.toFixed(2)}</>}
              </span>
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
                  className="w-16 mx-2 text-center"
                />
                <SquarePlus
                  onClick={() =>
                    updateQuantity(item.product.id, item.quantity + 1)
                  }
                  className="text-stone-300"
                />
                <Label className="w-16 mx-2 justify-end">
                  {user?.role === "store" && (
                    <>{(item.product.price * item.quantity).toFixed(2)} Kč</>
                  )}
                  {user?.role === "user" && (
                    <>{(item.product.price * item.quantity).toFixed(2)} Kč</>
                  )}
                  {/* {(item.product.price * item.quantity).toFixed(2)} Kč */}
                </Label>
                {/* <Button
                  variant="destructive"
                  onClick={() => removeItem(item.product.id)}
                  // className="w-12 ml-8"
                >
                  <Trash2 className="w-5 h-5" />
                </Button> */}
              </div>
            </div>
          ))
        )}
        <Button
          onClick={handleSubmit}
          variant="outline"
          className="flex flex-row font-bold text-slate-600 w-full mb-auto"
        >
          <Coins className="flex flex-row font-bold text-slate-600 w-1/12 mb-auto" />
          {calculateTotal().toFixed(2)}
        </Button>
      </CardContent>
      {/* <CardFooter className="flex flex-row">
        <Button onClick={clearCart}>Clear Cart</Button>
      </CardFooter> */}
    </Card>
  );
}
