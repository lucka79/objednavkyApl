import { Order } from "../../types";
import { forwardRef } from "react";

interface ProductSummaryPrintProps {
  orders: Order[];
}

export const ProductSummaryPrint = forwardRef<
  HTMLDivElement,
  ProductSummaryPrintProps
>(({ orders }, ref) => {
  const productSummary = orders.reduce(
    (acc, order) => {
      order.order_items.forEach((item) => {
        if (!acc[item.product_id]) {
          acc[item.product_id] = {
            name: item.product.name,
            quantity: 0,
            total: 0,
          };
        }
        acc[item.product_id].quantity += item.quantity;
        acc[item.product_id].total += item.quantity * item.price;
      });
      return acc;
    },
    {} as Record<string, { name: string; quantity: number; total: number }>
  );

  return (
    <div ref={ref} className="p-8">
      <h2 className="text-xl font-bold mb-4">
        Souhrn produktů - {new Date().toLocaleDateString()}
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
                <td className="py-2">{item.name}</td>
                <td className="text-right py-2">{item.quantity}</td>
              </tr>
            ))}
        </tbody>
      </table>
      <div className="text-right text-gray-600 mt-4">
        Vytištěno: {new Date().toLocaleString()}
      </div>
    </div>
  );
});

ProductSummaryPrint.displayName = "ProductSummaryPrint";
