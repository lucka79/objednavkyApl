import { useState, useEffect } from "react";
import { ReturnItem } from "../../types";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Trash2 } from "lucide-react";
import { useDeleteReturnItem } from "@/hooks/useReturns";

interface UpdateReturnCartProps {
  items: ReturnItem[];
  returnId: number;
  selectedUserId?: string;
  onUpdate: () => Promise<void>;
}

export default function UpdateReturnCart({
  items = [],
  returnId,
  onUpdate,
}: UpdateReturnCartProps) {
  const [returnItems, setReturnItems] = useState<ReturnItem[]>(items);
  const deleteReturnItem = useDeleteReturnItem();

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

  const total =
    returnItems?.reduce(
      (sum, item) => sum + (item?.price || 0) * (item?.quantity || 0),
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
              <Input
                type="number"
                value={item.quantity || 0}
                className="w-20 mx-4"
                disabled
              />
              <span className="text-sm w-20 text-right">
                {(item.price || 0).toFixed(2)} Kč
              </span>
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
