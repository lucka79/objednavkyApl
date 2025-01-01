// Cart.tsx
import { useState, useEffect, useMemo } from "react";
import { useCartStore } from "@/providers/cartStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Coins, SquareMinus, SquarePlus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSubsrciberUsers } from "@/hooks/useProfiles";
import { CartItem } from "types";
import { useSelectedUser } from "@/hooks/useProfiles";
import { useUpdateStoredItems } from "@/hooks/useOrders";
// import { Command } from "cmdk";

export default function CartAdmin() {
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);
  const { mutateAsync: insertOrder } = useInsertOrder();
  const { mutateAsync: insertOrderItems } = useInsertOrderItems();
  const { mutateAsync: updateStoredItems } = useUpdateStoredItems();
  const {
    items,
    // removeItem,
    updateQuantity,
    clearCart,

    checkout,
  } = useCartStore();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(12, 0, 0, 0);

  const [date, setDate] = useState<Date>(tomorrow);

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const { data: subsrciberUsers, isLoading: isLoadingUsers } =
    useSubsrciberUsers();
  const { data: selectedUser } = useSelectedUser(selectedUserId);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = useMemo(() => {
    if (!subsrciberUsers) return [];
    if (!searchQuery) return subsrciberUsers;

    return subsrciberUsers.filter((user) =>
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [subsrciberUsers, searchQuery]);

  useEffect(() => {
    if (user && user.role !== "admin" && user?.role !== "expedition") {
      setSelectedUserId(user.id);
    }
  }, [user]);

  const getItemPrice = (item: CartItem) => {
    if (selectedUser?.role === "store") {
      return item.product.priceBuyer;
    }
    if (selectedUser?.role === "mobil") {
      return item.product.priceMobil;
    }
    return item.product.price;
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      const price = getItemPrice(item);
      return sum + price * item.quantity;
    }, 0);
  };

  const [paid_by, setPaidBy] = useState<"Hotově" | "Kartou" | "Příkazem">(
    "Hotově"
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2">
          <CardTitle className="flex flex-row justify-between gap-2">
            {user?.role === "admin" || user?.role === "expedition" ? (
              <Select onValueChange={setSelectedUserId} value={selectedUserId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Vyberte uživatele" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-2">
                    <Input
                      placeholder="Hledat uživatele..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="mb-2"
                    />
                  </div>
                  {isLoadingUsers ? (
                    <div className="px-2 py-2 text-sm text-muted-foreground">
                      Načítání...
                    </div>
                  ) : filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || "Unnamed User"}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-2 text-sm text-muted-foreground">
                      Uživatel nenalezen
                    </div>
                  )}
                </SelectContent>
              </Select>
            ) : (
              <div className="w-[200px]">{user?.full_name}</div>
            )}
            <Button
              variant="outline"
              onClick={() => {
                clearCart();
                setSelectedUserId("");
              }}
            >
              Smazat
            </Button>
          </CardTitle>
          <CardTitle className="flex flex-row justify-between gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[200px] justify-start text-left font-normal",
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
                  weekStartsOn={1}
                  formatters={{
                    formatCaption: (date) =>
                      format(date, "LLLL yyyy", { locale: cs }),
                    formatWeekdayName: (date) =>
                      format(date, "EEEEEE", { locale: cs }),
                  }}
                />
              </PopoverContent>
            </Popover>{" "}
            <Select
              value={paid_by}
              onValueChange={(value: "Hotově" | "Kartou" | "Příkazem") =>
                setPaidBy(value)
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Způsob platby" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Hotově">Hotově</SelectItem>
                <SelectItem value="Kartou">Kartou</SelectItem>
                <SelectItem value="Příkazem">Příkazem</SelectItem>
              </SelectContent>
            </Select>
          </CardTitle>
        </div>
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
              <span className="text-sm line-clamp-1 hover:line-clamp-2">
                {item.product.name}
              </span>
              <span className="text-sm flex-1 mr-2 text-end">
                {getItemPrice(item).toFixed(2)} Kč
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
                  className="w-14 mx-2 text-center"
                />
                <SquarePlus
                  onClick={() =>
                    updateQuantity(item.product.id, item.quantity + 1)
                  }
                  className="text-stone-300"
                />
                <Label className="w-16 mx-2 text-end">
                  {(getItemPrice(item) * (item.quantity || 0)).toFixed(2)} Kč
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
          onClick={async () => {
            if (!selectedUserId) {
              toast({
                title: "Error",
                description: "Please select a user first",
                variant: "destructive",
              });
              return;
            }

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

              await updateStoredItems({
                userId: selectedUserId,
                items: items.map((item) => ({
                  product_id: item.product.id,
                  quantity: -item.quantity,
                  increment: true,
                })),
              });

              await checkout(
                insertOrder,
                insertOrderItems,
                date,
                selectedUserId,
                orderTotal,
                selectedUser?.role,
                paid_by
              );
              const newTomorrow = new Date();
              newTomorrow.setDate(newTomorrow.getDate() + 1);
              newTomorrow.setHours(12, 0, 0, 0);
              setDate(newTomorrow);
              setSelectedUserId("");
              // setOpen(false);

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
                description:
                  error instanceof Error
                    ? error.message
                    : "There was an error processing your order.",
                variant: "destructive",
              });
            }
          }}
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
