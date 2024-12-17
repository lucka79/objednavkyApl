import { ProductionItem } from "../../types";
import { Card, CardContent } from "./ui/card";

interface ProductionItemsProps {
  items: ProductionItem[];
}

export function ProductionItems({ items }: ProductionItemsProps) {
  if (!items) {
    return (
      <Card>
        <CardContent>
          <p>No items in production.</p>
        </CardContent>
      </Card>
    );
  }

  const total = items.reduce(
    (sum, item) => sum + (item?.price || 0) * (item?.quantity || 0),
    0
  );

  return (
    <Card>
      <CardContent>
        {items.length === 0 ? (
          <p>No items in production.</p>
        ) : (
          [...items]
            .sort((a, b) =>
              (a.product?.name || "").localeCompare(b.product?.name || "", "cs")
            )
            .map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between pt-2 mb-2"
              >
                <span className="text-sm flex-1">{item.product?.name}</span>
                <span className="text-sm mx-4">{item.quantity || 0} ks</span>
                <span className="text-sm w-20 text-right">
                  {(item.price || 0).toFixed(2)} Kč
                </span>
                <span className="text-sm w-24 text-right font-medium">
                  {((item.price || 0) * (item.quantity || 0)).toFixed(2)} Kč
                </span>
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
