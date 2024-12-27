import { useState, useEffect } from "react";
import { ProductionItem } from "../../types";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Trash2, PlusSquare, MinusSquare, Plus } from "lucide-react";
import { useUpdateProductionItems } from "@/hooks/useProductions";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import { AddProductionProduct } from "@/components/AddProductionProduct";
import { supabase } from "@/lib/supabase";

interface UpdateProductionCartProps {
  items: ProductionItem[];
  productionId: number;
  onUpdate: () => Promise<void>;
  selectedUserId: string;
}

export default function UpdateProductionCart({
  items,
  productionId,
  onUpdate,
  //   selectedUserId,
}: UpdateProductionCartProps) {
  const [productionItems, setProductionItems] =
    useState<ProductionItem[]>(items);
  const { mutate: updateProductionItems } = useUpdateProductionItems();

  useEffect(() => {
    if (!items) return;
    const sortedItems = items.sort((a, b) =>
      (a.product?.name || "").localeCompare(b.product?.name || "", "cs")
    );
    setProductionItems(sortedItems);
  }, [items]);

  const handleDelete = async (itemId: number) => {
    try {
      const itemToDelete = productionItems.find((item) => item.id === itemId);
      if (!itemToDelete) return;

      await onUpdate();
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
  };

  const handleQuantityChange = async (itemId: number, newQuantity: number) => {
    try {
      const currentItem = productionItems.find((item) => item.id === itemId);
      if (!currentItem) {
        console.error("No current item found with id:", itemId);
        return;
      }

      await updateProductionItems({
        itemId,
        newQuantity,
        productionId,
        total, // Pass the current calculated total
      });

      if (onUpdate) {
        await onUpdate();
      }
    } catch (error) {
      console.error("Failed to update quantities:", error);
    }
  };

  const total =
    productionItems?.reduce((sum, item) => {
      return sum + (item?.price || 0) * (item?.quantity || 0);
    }, 0) || 0;

  useEffect(() => {
    const updateProductionTotal = async () => {
      try {
        const { error } = await supabase
          .from("productions")
          .update({ total })
          .eq("id", productionId);

        if (error) throw error;

        if (onUpdate) {
          await onUpdate();
        }
      } catch (error) {
        console.error("Failed to update production total:", error);
      }
    };

    updateProductionTotal();
  }, [total, productionId, onUpdate]);

  return (
    <Card>
      <CardContent>
        <div className="flex gap-2 justify-end mt-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogTitle>Vložit výrobek do výroby</DialogTitle>
              <AddProductionProduct
                productionId={productionId}
                onUpdate={onUpdate}
              />
            </DialogContent>
          </Dialog>
        </div>
        {!productionItems || productionItems.length === 0 ? (
          <p>No items in production.</p>
        ) : (
          productionItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between pt-2 mb-2"
            >
              <span className="text-sm flex-1">{item.product?.name}</span>
              <span className="text-sm w-20 text-right mr-4">
                {(item.price || 0).toFixed(2)} Kč
              </span>
              <div className="flex items-center">
                {(item.quantity || 0) > 0 && (
                  <MinusSquare
                    className="h-5 w-5 cursor-pointer text-gray-500 hover:text-gray-700"
                    onClick={() =>
                      handleQuantityChange(item.id, (item.quantity || 0) - 1)
                    }
                  />
                )}
                <Input
                  type="number"
                  value={item.quantity || 0}
                  onChange={(e) =>
                    handleQuantityChange(item.id, parseInt(e.target.value) || 0)
                  }
                  className="w-16 mx-2"
                />
                <PlusSquare
                  className="h-5 w-5 cursor-pointer text-gray-500 hover:text-gray-700"
                  onClick={() =>
                    handleQuantityChange(item.id, (item.quantity || 0) + 1)
                  }
                />
              </div>

              <span className="text-sm w-24 text-right font-medium">
                {((item.price || 0) * (item.quantity || 0)).toFixed(2)} Kč
              </span>
              <Trash2
                className="ml-2 h-4 w-4 cursor-pointer text-red-500"
                onClick={() => handleDelete(item.id)}
              />
            </div>
          ))
        )}
        <div className="flex justify-end font-bold text-lg mt-4">
          Total: {total.toFixed(2)} Kč
        </div>
      </CardContent>
    </Card>
  );
}
