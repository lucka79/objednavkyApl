import { useState, useEffect } from "react";
import { ReturnItem } from "../../types";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Trash2, PlusSquare, MinusSquare, Plus } from "lucide-react";
import { useUpdateReturnItems } from "@/hooks/useReturns";
import { useUpdateStoredItems } from "@/hooks/useOrders";
import { useDeleteReturnItem } from "@/hooks/useReturns";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import { AddReturnProduct } from "./AddReturnProduct";

interface UpdateReturnCartProps {
  items: ReturnItem[];
  returnId: number;
  onUpdate: () => Promise<void>;
  selectedUserId: string;
  selectedUserRole: string;
}

export default function UpdateReturnCart({
  items,
  returnId,
  onUpdate,
  selectedUserId,
  selectedUserRole,
}: UpdateReturnCartProps) {
  const [returnItems, setReturnItems] = useState<ReturnItem[]>(items);
  const { mutate: updateReturnItems } = useUpdateReturnItems();
  // const { mutate: updateReturn } = useUpdateReturn();
  const { mutateAsync: updateStoredItems } = useUpdateStoredItems();
  const { mutateAsync: deleteReturnItem } = useDeleteReturnItem();
  // const { toast } = useToast();

  useEffect(() => {
    if (!items) return;
    const sortedItems = items.sort((a, b) =>
      (a.product?.name || "").localeCompare(b.product?.name || "", "cs")
    );
    setReturnItems(sortedItems);
  }, [items]);

  const handleDelete = async (itemId: number) => {
    try {
      await deleteReturnItem({ itemId, returnId });
      await onUpdate();
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
  };

  const handleQuantityChange = async (itemId: number, newQuantity: number) => {
    try {
      const currentItem = returnItems.find((item) => item.id === itemId);
      if (!currentItem) {
        console.error("No current item found with id:", itemId);
        return;
      }

      const quantityDifference = newQuantity - currentItem.quantity;

      console.log("UpdateReturnCart - Starting quantity update:", {
        currentItem,
        currentQuantity: currentItem.quantity,
        newQuantity,
        quantityDifference,
        selectedUserId,
      });

      // Update return item quantity
      const updatedReturnItem = await updateReturnItems({
        itemId,
        newQuantity,
      });
      console.log("Return item updated:", updatedReturnItem);

      // Update stored items if quantity changed
      if (quantityDifference !== 0) {
        console.log("UpdateReturnCart - Updating stored items:", {
          userId: selectedUserId,
          productId: currentItem.product_id,
          quantityChange: -quantityDifference,
        });

        const result = await updateStoredItems({
          userId: selectedUserId,
          items: [
            {
              product_id: currentItem.product_id,
              quantity: -quantityDifference,
            },
          ],
        });
        console.log("Stored items update result:", result);
      }

      if (onUpdate) {
        await onUpdate();
      }
    } catch (error) {
      console.error("Failed to update quantities:", error);
    }
  };

  const total =
    returnItems?.reduce(
      (sum, item) =>
        sum +
        (selectedUserRole === "store"
          ? item?.price || 0
          : item.product?.priceMobil || 0) *
          (item?.quantity || 0),
      0
    ) || 0;

  return (
    <Card>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogTitle>Add Product to Return</DialogTitle>
              <AddReturnProduct returnId={returnId} onUpdate={onUpdate} />
            </DialogContent>
          </Dialog>
        </div>
        {!returnItems || returnItems.length === 0 ? (
          <p>No items in return.</p>
        ) : (
          returnItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between pt-2 mb-2"
            >
              <span className="text-sm flex-1">{item.product?.name}</span>
              <div className="flex items-center">
                <MinusSquare
                  className="h-5 w-5 cursor-pointer text-gray-500 hover:text-gray-700"
                  onClick={() =>
                    handleQuantityChange(item.id, (item.quantity || 0) - 1)
                  }
                />
                <Input
                  type="number"
                  value={item.quantity || 0}
                  className="w-16 mx-2"
                  disabled
                />
                <PlusSquare
                  className="h-5 w-5 cursor-pointer text-gray-500 hover:text-gray-700"
                  onClick={() =>
                    handleQuantityChange(item.id, (item.quantity || 0) + 1)
                  }
                />
              </div>
              <span className="text-sm w-20 text-right ml-4">
                {(selectedUserRole === "store"
                  ? item.price || 0
                  : item.product?.priceMobil || 0
                ).toFixed(2)}{" "}
                Kč
              </span>
              <span className="text-sm w-24 text-right font-medium">
                {(
                  (selectedUserRole === "store"
                    ? item.price || 0
                    : item.product?.priceMobil || 0) * (item.quantity || 0)
                ).toFixed(2)}{" "}
                Kč
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
