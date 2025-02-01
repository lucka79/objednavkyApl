import { useState, useMemo, useEffect } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Coins,
  SquareMinus,
  SquarePlus,
  Lock,
  Unlock,
  Trash2,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  useUpdateFavoriteItem,
  useDeleteFavoriteItem,
} from "@/hooks/useFavorites";

interface FavoriteItem {
  id: number;
  product: {
    id: number;
    name: string;
    price: number;
    priceBuyer: number;
    priceMobil: number;
  };
  quantity: number;
  price?: number;
  isManualPrice?: boolean;
}

interface FavoriteCartProps {
  items: FavoriteItem[];
  favoriteOrderId: number;
  onUpdate: () => Promise<void>;
  userRole?: string;
}

export default function FavoriteCart({
  items = [],
  // favoriteOrderId,
  onUpdate,
  userRole = "user",
}: FavoriteCartProps) {
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>(items);
  const { toast } = useToast();

  const updateFavoriteItem = useUpdateFavoriteItem();
  const deleteFavoriteItem = useDeleteFavoriteItem();

  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);

  useEffect(() => {
    if (!items) return;
    const sortedItems = items.sort((a, b) =>
      a.product.name.localeCompare(b.product.name, "cs")
    );
    setFavoriteItems(sortedItems);
  }, [items]);

  const getItemPrice = (item: FavoriteItem) => {
    if (item.price && item.price > 0) {
      return item.price;
    }
    return userRole === "mobil"
      ? item.product.priceMobil
      : userRole === "store" || userRole === "buyer"
        ? item.product.priceBuyer
        : item.product.price;
  };

  const calculateTotal = () => {
    if (!favoriteItems) return 0;
    return favoriteItems.reduce((sum: number, item: FavoriteItem) => {
      const itemPrice = getItemPrice(item);
      const quantity = item.quantity || 0;
      return sum + quantity * itemPrice;
    }, 0);
  };

  const total = useMemo(() => calculateTotal(), [favoriteItems]);

  const updateFavoriteQuantity = async (
    itemId: number,
    newQuantity: number
  ) => {
    if (newQuantity < 0) return;

    try {
      // Update quantity
      await updateFavoriteItem.mutateAsync({
        itemId,
        newQuantity,
      });

      // Update local state
      const updatedItems = favoriteItems.map((item) =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      );
      setFavoriteItems(updatedItems);

      await onUpdate();
    } catch (error) {
      console.error("Failed to update quantity:", error);
      toast({
        title: "Error",
        description: "Failed to update quantity",
        variant: "destructive",
      });
    }
  };

  const updateFavoritePrice = async (itemId: number, newPrice: number) => {
    try {
      await updateFavoriteItem.mutateAsync({
        itemId,
        newPrice,
        isManualPrice: true,
      });

      // Update local state
      const updatedItems = favoriteItems.map((item) =>
        item.id === itemId
          ? { ...item, price: newPrice, isManualPrice: true }
          : item
      );
      setFavoriteItems(updatedItems);
      await onUpdate();
    } catch (error) {
      console.error("Failed to update price:", error);
      toast({
        title: "Error",
        description: "Failed to update price",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardContent>
        {!favoriteItems || favoriteItems.length === 0 ? (
          <p>No items in favorite list.</p>
        ) : (
          favoriteItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between pt-2 mb-2"
            >
              <span className="text-sm flex-1 text-left mr-4">
                {item.product.name}
              </span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {editingPriceId === item.id ? (
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={item.price || getItemPrice(item)}
                      onChange={(e) =>
                        updateFavoritePrice(
                          item.id,
                          parseFloat(e.target.value) || 0
                        )
                      }
                      onBlur={() => setEditingPriceId(null)}
                      className="w-24 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      autoFocus
                    />
                  ) : (
                    <span className="w-24 text-right">
                      {getItemPrice(item).toFixed(2)} Kč
                    </span>
                  )}
                  <button
                    onClick={() =>
                      setEditingPriceId(
                        editingPriceId === item.id ? null : item.id
                      )
                    }
                    className="hover:text-orange-500"
                  >
                    {item.price && item.price > 0 ? (
                      <Lock className="h-4 w-4 text-orange-500" />
                    ) : (
                      <Unlock className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="flex items-center">
                  {item.quantity > 0 && (
                    <SquareMinus
                      onClick={() =>
                        updateFavoriteQuantity(item.id, item.quantity - 1)
                      }
                      className="cursor-pointer text-stone-300 hover:text-stone-400"
                    />
                  )}
                  <Input
                    type="number"
                    min="0"
                    value={item.quantity}
                    onChange={(e) => {
                      const updatedItems = favoriteItems.map((favItem) =>
                        favItem.id === item.id
                          ? {
                              ...favItem,
                              quantity: parseInt(e.target.value) || 0,
                            }
                          : favItem
                      );
                      setFavoriteItems(updatedItems);
                    }}
                    onBlur={(e) =>
                      updateFavoriteQuantity(
                        item.id,
                        parseInt(e.target.value) || 0
                      )
                    }
                    className={`w-16 ${item.quantity > 0 ? "mx-2" : "ml-6"} text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                  />
                  <SquarePlus
                    onClick={() =>
                      updateFavoriteQuantity(item.id, item.quantity + 1)
                    }
                    className="cursor-pointer text-stone-300 hover:text-stone-400 ml-2"
                  />
                  <Label className="w-16 mx-2 text-end">
                    {(getItemPrice(item) * (item.quantity || 0)).toFixed(2)} Kč
                  </Label>
                  <Trash2
                    onClick={() => deleteFavoriteItem.mutateAsync(item.id)}
                    className="h-4 w-4 cursor-pointer text-stone-300 hover:text-red-500 ml-2"
                  />
                </div>
              </div>
            </div>
          ))
        )}
        <div className="flex flex-row justify-end font-bold text-slate-600 w-full mt-4">
          <Coins className="w-1/12 mb-auto mr-2" />
          {(total || 0).toFixed(2)} Kč
        </div>
      </CardContent>
    </Card>
  );
}
