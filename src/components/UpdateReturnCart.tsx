import { useState, useEffect } from "react";
import { ReturnItem } from "../../types";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Trash2, PlusSquare, MinusSquare } from "lucide-react";
import {
  useDeleteReturnItem,
  useUpdateReturnQuantity,
} from "@/hooks/useReturns";

interface UpdateReturnCartProps {
  items: ReturnItem[];
  returnId: number;
  selectedUserRole?: string;
  onUpdate: () => Promise<void>;
}

export default function UpdateReturnCart({
  items = [],
  returnId,
  selectedUserRole = "",
  onUpdate,
}: UpdateReturnCartProps) {
  const [returnItems, setReturnItems] = useState<ReturnItem[]>(items);
  const deleteReturnItem = useDeleteReturnItem();
  const updateQuantity = useUpdateReturnQuantity();

  useEffect(() => {
    if (!items) return;
    const sortedItems = items.sort((a, b) =>
      (a.product?.name || "").localeCompare(b.product?.name || "", "cs")
    );
    setReturnItems(sortedItems);
  }, [items]);

  const handleDelete = async (itemId: number) => {
    try {
      await deleteReturnItem.mutateAsync({ itemId, returnId });
      await onUpdate();
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
  };

  const handleQuantityChange = async (itemId: number, newQuantity: number) => {
    try {
      await updateQuantity.mutateAsync({
        itemId,
        newQuantity,
        userRole: selectedUserRole,
      });
      if (onUpdate) {
        await onUpdate();
      }
    } catch (error) {
      console.error("Failed to update quantity:", error);
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
