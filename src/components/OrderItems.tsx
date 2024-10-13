import { OrderItem } from "../../types";

interface OrderItemsProps {
  items: OrderItem[];
}

export function OrderItems({ items }: OrderItemsProps) {
  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.product.price,
    0
  );

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex justify-between">
          <span>{item.product.name}</span>
          <span>
            {item.quantity} x ${item.product.price.toFixed(2)}
          </span>
        </div>
      ))}
      <div className="font-bold pt-2 border-t">Total: ${total.toFixed(2)}</div>
    </div>
  );
}
