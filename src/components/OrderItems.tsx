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
        <div key={item.id} className="flex justify-between items-center">
          <span>{item.product.name}</span>
          <span className="text-muted-foreground font-semibold text-right">
            ${item.product.price.toFixed(2)}
          </span>
          <span>{item.quantity}</span>{" "}
          <span>{(item.product.price * item.quantity).toFixed(2)} Kč</span>
        </div>
      ))}
      <div className="font-bold pt-2 border-t flex flex-row-reverse">
        Total: {total.toFixed(2)} Kč
      </div>
    </div>
  );
}
