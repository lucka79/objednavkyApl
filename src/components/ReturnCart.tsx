import { useState } from "react";
import { Product } from "../../types";
import { fetchActiveProducts } from "@/hooks/useProducts";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "./ui/button";
import { Plus } from "lucide-react";

interface CartItem {
  product: Product;
  quantity: number;
}

// interface ReturnCartProps {
//   userId: string;
//   onSubmit: () => Promise<void>;
// }

export function ReturnCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const { data: products } = fetchActiveProducts();

  const addItem = () => {
    if (!selectedProductId) return;

    const product = products?.find(
      (p) => p.id.toString() === selectedProductId
    );
    if (!product) return;

    setItems((prev) => [
      ...prev,
      {
        product,
        quantity,
      },
    ]);

    // Reset form
    setSelectedProductId("");
    setQuantity(1);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const total = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Select value={selectedProductId} onValueChange={setSelectedProductId}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select product" />
          </SelectTrigger>
          <SelectContent>
            {products?.map((product: Product) => (
              <SelectItem key={product.id} value={product.id.toString()}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="w-24"
        />

        <Button onClick={addItem}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-2 p-2 border rounded"
          >
            <span>{item.product.name}</span>
            <span>{item.quantity} ks</span>
            <span>{item.product.price.toFixed(2)} Kč</span>
            <span>{(item.product.price * item.quantity).toFixed(2)} Kč</span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => removeItem(index)}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <div className="flex justify-end font-bold">
          Total: {total.toFixed(2)} Kč
        </div>
      )}
    </div>
  );
}
