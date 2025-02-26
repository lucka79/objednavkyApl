import { Order } from "../../types";
import { forwardRef } from "react";

interface PrintReportProductsProps {
  orders: Order[];
}

export const PrintReportProducts = forwardRef<
  HTMLDivElement,
  PrintReportProductsProps
>(({ orders }, ref) => {
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
        // Skip products from categories 4, 5, and 17
        // if (
        //   item.product.category_id !== 4 &&
        //   item.product.category_id !== 5 &&
        //   item.product.category_id !== 17
        // ) {
        if (!acc[item.product_id]) {
          acc[item.product_id] = {
            name: item.product.name,
            quantity: 0,
            total: 0,
            price: item.price,
            category_id: item.product.category_id || 0,
          };
        }
        acc[item.product_id].quantity += item.quantity;
        acc[item.product_id].total += item.quantity * item.price;
        // }
      });
      return acc;
    },
    {} as Record<
      string,
      {
        name: string;
        quantity: number;
        total: number;
        price: number;
        category_id: number;
      }
    >
  );

  // Calculate totals
  const totals = Object.values(productSummary).reduce(
    (acc, item) => ({
      quantity: acc.quantity + item.quantity,
      total: acc.total + item.total,
    }),
    { quantity: 0, total: 0 }
  );

  return (
    <div ref={ref} style={{ fontSize: "12px", margin: "0 10px" }}>
      <h2 className="text-xl font-bold mb-4">
        Report vyrobených výrobků ({dateRange})
      </h2>
      <table className="w-[60%] mb-4">
        <thead>
          <tr className="border-b">
            <th style={{ fontSize: "12px", textAlign: "right" }}>Cena</th>
            <th style={{ fontSize: "12px", textAlign: "left" }}>Položka</th>
            <th style={{ fontSize: "12px", textAlign: "right" }}>Množství</th>
            <th style={{ fontSize: "12px", textAlign: "right" }}>Celkem</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(productSummary)
            .filter((item) => item.quantity > 0)
            .sort((a, b) => {
              // First sort by category_id
              if (a.category_id !== b.category_id) {
                return a.category_id - b.category_id;
              }
              // Then sort by name within the same category
              return a.name.localeCompare(b.name);
            })
            .map((item, index) => (
              <tr key={index} className="border-b">
                <td
                  style={{ fontSize: "12px", textAlign: "right" }}
                  className="py-2"
                >
                  {item.price.toFixed(2)}
                </td>
                <td style={{ fontSize: "12px" }} className="py-2">
                  {item.name}
                </td>
                <td
                  style={{ fontSize: "12px", textAlign: "right" }}
                  className="text-right py-2"
                >
                  {item.quantity}
                </td>
                <td
                  style={{ fontSize: "12px", textAlign: "right" }}
                  className="text-right py-2"
                >
                  {(item.price * item.quantity).toFixed(2)}
                </td>
              </tr>
            ))}
          {/* Total row */}
          <tr className="border-t-2 border-black font-bold">
            <td
              style={{
                fontSize: "12px",
                textAlign: "right",
                fontWeight: "bold",
              }}
              className="py-2"
            >
              Celkem
            </td>
            <td></td>
            <td
              style={{ fontSize: "12px", textAlign: "right" }}
              className="text-right py-2"
            >
              {totals.quantity}
            </td>
            <td
              style={{ fontSize: "12px", textAlign: "right" }}
              className="text-right py-2"
            >
              {totals.total.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="text-right text-gray-600 mt-4 text-xs">
        Vytištěno: {new Date().toLocaleString()}
      </div>
    </div>
  );
});

PrintReportProducts.displayName = "PrintReportProducts";
