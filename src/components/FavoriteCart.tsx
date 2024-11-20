import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Coins, SquareMinus, SquarePlus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useUpdateFavoriteItem } from "@/hooks/useFavorites";

interface FavoriteItem {
  id: number;
  product: {
    id: number;
    name: string;
    price: number;
    priceMobil: number;
  };
  quantity: number;
  price?: number;
}

interface FavoriteCartProps {
  items: FavoriteItem[];
  favoriteOrderId: number;
  onUpdate: () => Promise<void>;
}

export default function FavoriteCart({
  items = [],
  favoriteOrderId,
  onUpdate,
}: FavoriteCartProps) {
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>(items);
  const { toast } = useToast();

  const updateFavoriteItem = useUpdateFavoriteItem();

  useEffect(() => {
    if (!items) return;
    const sortedItems = items.sort((a, b) =>
      a.product.name.localeCompare(b.product.name, "cs")
    );
    setFavoriteItems(sortedItems);
  }, [items]);

  const calculateTotal = () => {
    if (!favoriteItems) return 0;
    return favoriteItems.reduce((sum: number, item: FavoriteItem) => {
      const itemPrice = item.product.price || 0;
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
      await updateFavoriteItem.mutateAsync({ itemId, newQuantity });

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
              <span className="text-sm flex-1 mr-2 text-end">
                {(item.price || item.product.price).toFixed(2)} Kč
              </span>
              <div className="flex items-center">
                <SquareMinus
                  onClick={() =>
                    updateFavoriteQuantity(item.id, item.quantity - 1)
                  }
                  className="cursor-pointer text-stone-300 hover:text-stone-400"
                />
                <Input
                  type="number"
                  min="0"
                  value={item.quantity}
                  onChange={(e) =>
                    updateFavoriteQuantity(
                      item.id,
                      parseInt(e.target.value) || 0
                    )
                  }
                  className="w-16 mx-2 text-center"
                />
                <SquarePlus
                  onClick={() =>
                    updateFavoriteQuantity(item.id, item.quantity + 1)
                  }
                  className="cursor-pointer text-stone-300 hover:text-stone-400"
                />
                <Label className="w-16 mx-4 text-end">
                  {(item.product.price * (item.quantity || 0)).toFixed(2)} Kč
                </Label>
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
