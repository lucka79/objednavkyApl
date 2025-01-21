import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "./ui/badge";
import {
  useFetchOrderById,
  useUpdateOrderItems,
  useUpdateStoredItems,
  useUpdateOrder,
} from "@/hooks/useOrders";
import { OrderItem } from "../../types";
import { Input } from "@/components/ui/input";
import { SquareMinus, SquarePlus, History, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "./ui/button";
import { useOrderItemHistory } from "@/hooks/useOrders";
import { useQueryClient } from "@tanstack/react-query";

interface Category9OrderDetailsProps {
  orderId: number | null;
  onClose: () => void;
  onQuantityChange: (
    orderId: number,
    oldQuantity: number,
    newQuantity: number
  ) => void;
}

const HistoryDialog = ({ itemId }: { itemId: number }) => {
  const { data: historyData } = useOrderItemHistory(itemId);

  if (!historyData || historyData.length === 0) {
    return (
      <div className="p-4 text-sm text-slate-500">
        Žádné změny nebyly zaznamenány.
      </div>
    );
  }

  return (
    <div className="flex flex-col max-h-[400px] overflow-y-auto w-[400px]">
      {historyData.map((entry: any) => (
        <div
          key={entry.id}
          className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-2"
        >
          <div className="font-medium text-slate-900">
            {entry.order_items?.product?.name || "Neznámý produkt"}
          </div>
          <div className="text-sm text-slate-600">
            Množství: {entry.old_quantity} → {entry.new_quantity}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Změnil: {entry.profiles?.full_name || "Neznámý uživatel"}
          </div>
          <div className="text-xs text-slate-400">
            {new Date(entry.changed_at).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
};

export function Category9OrderDetails({
  orderId,
  onClose,
  onQuantityChange,
}: Category9OrderDetailsProps) {
  const queryClient = useQueryClient();
  const { data: orderData, isLoading } = useFetchOrderById(orderId);
  const { mutate: updateOrderItems } = useUpdateOrderItems();
  const { mutateAsync: updateStoredItems } = useUpdateStoredItems();
  const { toast } = useToast();
  // @ts-ignore
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [localQuantities, setLocalQuantities] = useState<
    Record<number, number>
  >({});
  const { mutate: updateOrder } = useUpdateOrder();
  const [localNote, setLocalNote] = useState("");

  // Initialize local quantities when order data changes
  useEffect(() => {
    if (orderData?.[0]) {
      const quantities: Record<number, number> = {};
      orderData[0].order_items
        .filter((item: OrderItem) => item.product.category_id === 9)
        .forEach((item: OrderItem) => {
          quantities[item.id] = item.quantity;
        });
      setLocalQuantities(quantities);
    }
  }, [orderData]);

  if (isLoading) {
    return (
      <Dialog open={!!orderId} onOpenChange={() => onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Načítání...</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const order = orderData?.[0];
  if (!order) return null;

  const category9Items = order.order_items.filter(
    (item: OrderItem) => item.product.category_id === 9
  );

  const updateOrderQuantity = async (
    itemId: number,
    productId: number,
    newQuantity: number,
    currentQuantity: number
  ) => {
    if (newQuantity < 0) return;

    try {
      const quantityDifference = newQuantity - currentQuantity;

      // Notify parent of quantity change
      onQuantityChange(itemId, currentQuantity, newQuantity);

      // Update the order item quantity
      await updateOrderItems({
        id: itemId,
        updatedFields: {
          quantity: newQuantity,
        },
      });

      // Update stored items if quantity changed
      if (quantityDifference !== 0) {
        await updateStoredItems({
          userId: order.user_id,
          items: [
            {
              product_id: productId,
              quantity: -quantityDifference,
            },
          ],
        });
      }

      // Invalidate queries to refresh data everywhere
      queryClient.invalidateQueries({ queryKey: ["ordersCategory9"] });

      toast({
        title: "Množství aktualizováno",
        description: "Změny byly úspěšně uloženy.",
      });
    } catch (error) {
      console.error("Failed to update quantity:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se aktualizovat množství",
        variant: "destructive",
      });
    }
  };

  const handleNoteChange = async (value: string) => {
    const newNote = value.trim() || "-";
    // Don't update if the note hasn't changed
    if (newNote === (order?.note || "-")) return;

    try {
      await updateOrder({
        id: orderId!,
        updatedFields: { note: newNote },
      });

      setLocalNote("");
      queryClient.invalidateQueries({ queryKey: ["ordersCategory9"] });

      toast({
        title: "Poznámka uložena",
        description: "Změny byly úspěšně uloženy.",
      });
    } catch (error) {
      toast({
        title: "Chyba",
        description: "Nepodařilo se uložit poznámku",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={!!orderId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detail objednávky FRESH výrobků</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Info with Status and Note in same row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Datum:</p>
              <p className="font-medium">
                {new Date(order.date).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Status:</p>
                <Badge variant="outline">{order.status}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  autoFocus={false}
                  value={localNote || (order?.note !== "-" ? order?.note : "")}
                  onChange={(e) => setLocalNote(e.target.value)}
                  onBlur={(e) => handleNoteChange(e.target.value)}
                  className={`border rounded px-2 py-1 text-sm w-60 text-right ${
                    localNote || order?.note !== "-" ? "border-orange-500" : ""
                  }`}
                  placeholder="Přidat poznámku..."
                />
                {(localNote || order?.note !== "-") && (
                  <X
                    size={16}
                    className="cursor-pointer text-gray-500 hover:text-red-500"
                    onClick={() => handleNoteChange("-")}
                  />
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Odběratel:</p>
              <p className="font-medium">{order.user?.full_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Řidič:</p>
              <p className="font-medium">{order.driver?.full_name || "-"}</p>
            </div>
          </div>

          {/* Category 9 Products */}
          <div>
            <h3 className="text-lg font-semibold mb-2">FRESH výrobky</h3>
            <div className="space-y-2">
              {category9Items
                .sort((a: OrderItem, b: OrderItem) =>
                  a.product.name.localeCompare(b.product.name)
                )
                .map((item: OrderItem) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 border rounded-lg"
                  >
                    <span className="font-medium">{item.product.name}</span>
                    <div className="flex items-center gap-2">
                      <SquareMinus
                        onClick={() => {
                          const newQuantity =
                            (localQuantities[item.id] || item.quantity) - 1;
                          setLocalQuantities({
                            ...localQuantities,
                            [item.id]: newQuantity,
                          });
                          updateOrderQuantity(
                            item.id,
                            item.product.id,
                            newQuantity,
                            item.quantity
                          );
                        }}
                        className="cursor-pointer text-stone-300 hover:text-stone-400"
                      />
                      <Input
                        type="number"
                        min="0"
                        value={localQuantities[item.id] ?? item.quantity}
                        onChange={(e) => {
                          const newQuantity = parseInt(e.target.value) || 0;
                          setLocalQuantities({
                            ...localQuantities,
                            [item.id]: newQuantity,
                          });
                        }}
                        onBlur={(e) => {
                          const newQuantity = parseInt(e.target.value) || 0;
                          updateOrderQuantity(
                            item.id,
                            item.product.id,
                            newQuantity,
                            item.quantity
                          );
                        }}
                        className="w-20 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <SquarePlus
                        onClick={() => {
                          const newQuantity =
                            (localQuantities[item.id] || item.quantity) + 1;
                          setLocalQuantities({
                            ...localQuantities,
                            [item.id]: newQuantity,
                          });
                          updateOrderQuantity(
                            item.id,
                            item.product.id,
                            newQuantity,
                            item.quantity
                          );
                        }}
                        className="cursor-pointer text-stone-300 hover:text-stone-400"
                      />
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedItemId(item.id)}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Historie položky</DialogTitle>
                          </DialogHeader>
                          <HistoryDialog itemId={item.id} />
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
