// Cart.tsx
import { useState } from "react";
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
// import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/supabase";
import { useInsertOrder } from "@/hooks/useOrders";
import { useInsertOrderItems } from "@/hooks/useOrders";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cs } from "date-fns/locale"; // Import Czech locale

export default function Cart() {
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);
  const { mutateAsync: insertOrder } = useInsertOrder();
  const { mutateAsync: insertOrderItems } = useInsertOrderItems();
  const {
    items,
    removeItem,
    updateQuantity,
    clearCart,
    total,
    totalMobil,
    checkout,
  } = useCartStore();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(12, 0, 0, 0);

  const [date, setDate] = useState<Date>(tomorrow);

  const buyer = user?.full_name;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            <Popover>
              Datum objednávky:
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[240px] justify-start text-left font-normal ml-2",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? (
                    format(date, "d. M. yyyy", { locale: cs })
                  ) : (
                    <span>Vyberte datum</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(newDate) => newDate && setDate(newDate)}
                  initialFocus
                  locale={cs}
                  weekStartsOn={1} // Week starts on Monday
                  formatters={{
                    formatCaption: (date, options) =>
                      format(date, "LLLL yyyy", { locale: cs }),
                    formatWeekdayName: (date) =>
                      format(date, "EEEEEE", { locale: cs }),
                  }}
                />
              </PopoverContent>
            </Popover>
          </CardTitle>
        </div>
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
              <span className="text-sm">{item.product.name}</span>
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
          onClick={async () => {
            console.log("Checkout button clicked");
            try {
              await checkout(insertOrder, insertOrderItems, date);
              const newTomorrow = new Date();
              newTomorrow.setDate(newTomorrow.getDate() + 1);
              newTomorrow.setHours(12, 0, 0, 0);
              setDate(newTomorrow);

              toast({
                title: "Objednávka vytvořena",
                description: "Your order has been placed successfully!",
                variant: "default",
              });
              console.log("Checkout completed");
            } catch (error) {
              console.error("Checkout failed:", error);
              toast({
                title: "Checkout Failed",
                description: "There was an error processing your order.",
                variant: "destructive",
              });
            }
          }}
          variant="outline"
          className="flex flex-row font-bold text-slate-600 w-full mb-auto"
        >
          <Coins className="flex flex-row font-bold text-slate-600 w-1/12 mb-auto" />
          {user?.role === "user" && totalMobil().toFixed(2)}
          {user?.role === "admin" && total().toFixed(2)}
        </Button>
      </CardContent>
      {/* <CardFooter className="flex flex-row">
        <Button onClick={clearCart}>Clear Cart</Button>
      </CardFooter> */}
    </Card>
  );
}
