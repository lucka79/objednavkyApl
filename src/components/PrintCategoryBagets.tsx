import { Order } from "../../types";
import { forwardRef } from "react";

interface PrintCategoryBagetsProps {
  orders: Order[];
  selectedDriver?: { id: string; full_name: string } | null;
}

export const PrintCategoryBagets = forwardRef<
  HTMLDivElement,
  PrintCategoryBagetsProps
>(({ orders, selectedDriver }, ref) => {
  // Get min and max dates from orders
  const dates = orders.map((order) => new Date(order.date));
  const minDate = new Date(Math.min(...dates.map((date) => date.getTime())));
  const maxDate = new Date(Math.max(...dates.map((date) => date.getTime())));

  const dateRange =
    minDate.toLocaleDateString() === maxDate.toLocaleDateString()
      ? minDate.toLocaleDateString()
      : `${minDate.toLocaleDateString()} - ${maxDate.toLocaleDateString()}`;

  const productSummary = orders.reduce(
    (acc, order) => {
      order.order_items.forEach((item) => {
        if (item.product.category_id === 9) {
          if (!acc[item.product_id]) {
            acc[item.product_id] = {
              name: item.product.name,
              quantity: 0,
              total: 0,
              category_id: item.product.category_id || 0,
            };
          }
          acc[item.product_id].quantity += item.quantity;
          acc[item.product_id].total += item.quantity * item.price;
        }
      });
      return acc;
    },
    {} as Record<
      string,
      { name: string; quantity: number; total: number; category_id: number }
    >
  );

  return (
    <div ref={ref} style={{ fontSize: "12px", margin: "0 10px" }}>
      <h2 className="text-xl font-bold mb-4">
        Výroba baget ({dateRange}) -
        {selectedDriver ? ` ${selectedDriver.full_name}` : "Všichni řidiči"}
      </h2>
      <table className="w-[60%] mb-4">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 bg-gray-50">Položka</th>
            <th className="text-right py-2 bg-gray-50">Množství</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(productSummary)
            .filter((item) => item.quantity > 0)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((item, index) => (
              <tr key={index} className="border-b">
                <td style={{ fontSize: "10px" }} className="py-2">
                  {item.name}
                </td>
                <td style={{ fontSize: "12px" }} className="text-right py-2">
                  {item.quantity}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      <div className="text-right text-gray-600 mt-4 text-xs">
        Vytištěno: {new Date().toLocaleString()}
      </div>
    </div>
  );
});

PrintCategoryBagets.displayName = "Výroba baget";
