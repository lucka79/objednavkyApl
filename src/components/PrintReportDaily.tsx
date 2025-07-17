import { Order } from "../../types";
import { forwardRef } from "react";

interface PrintReportDailyProps {
  orders: Order[];
}

export const PrintReportDaily = forwardRef<
  HTMLDivElement,
  PrintReportDailyProps
>(({ orders }, ref) => {
  // Group orders by date
  const dailySummary = orders.reduce(
    (acc, order) => {
      const orderDate = new Date(order.date);
      const dateKey = `${orderDate.getDate()}.${orderDate.getMonth() + 1}.${orderDate.getFullYear()}`;

      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: orderDate,
          totalQuantity: 0,
          totalAmount: 0,
          orders: [],
        };
      }

      // Sum up quantities and amounts from order items
      const orderTotals = order.order_items.reduce(
        (sum, item) => ({
          quantity: sum.quantity + item.quantity,
          amount: sum.amount + item.quantity * item.price,
        }),
        { quantity: 0, amount: 0 }
      );

      acc[dateKey].totalQuantity += orderTotals.quantity;
      acc[dateKey].totalAmount += orderTotals.amount;
      acc[dateKey].orders.push(order);

      return acc;
    },
    {} as Record<
      string,
      {
        date: Date;
        totalQuantity: number;
        totalAmount: number;
        orders: Order[];
      }
    >
  );

  // Convert to array and sort by date
  const sortedDailySummary = Object.entries(dailySummary)
    .map(([dateKey, summary]) => ({
      dateKey,
      ...summary,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div ref={ref} style={{ fontSize: "12px", margin: "0 10px" }}>
      <h2 className="text-xl font-bold mb-4">Denní přehled objednávek</h2>
      <table className="w-full mb-4">
        <thead>
          <tr className="border-b">
            <th style={{ fontSize: "12px", textAlign: "left" }}>Datum</th>
            <th style={{ fontSize: "12px", textAlign: "right" }}>
              Počet objednávek
            </th>
            <th style={{ fontSize: "12px", textAlign: "right" }}>
              Celkem položek
            </th>
            <th style={{ fontSize: "12px", textAlign: "right" }}>Celkem Kč</th>
          </tr>
        </thead>
        <tbody>
          {sortedDailySummary.map((summary) => (
            <tr key={summary.dateKey} className="border-b">
              <td style={{ fontSize: "12px" }} className="py-2">
                {summary.dateKey}
              </td>
              <td
                style={{ fontSize: "12px", textAlign: "right" }}
                className="py-2"
              >
                {summary.orders.length}
              </td>
              <td
                style={{ fontSize: "12px", textAlign: "right" }}
                className="py-2"
              >
                {summary.totalQuantity}
              </td>
              <td
                style={{ fontSize: "12px", textAlign: "right" }}
                className="py-2"
              >
                {summary.totalAmount.toFixed(2)}
              </td>
            </tr>
          ))}
          {/* Total row */}
          <tr className="border-t-2 border-black font-bold">
            <td style={{ fontSize: "12px" }} className="py-2">
              Celkem
            </td>
            <td
              style={{ fontSize: "12px", textAlign: "right" }}
              className="py-2"
            >
              {sortedDailySummary.reduce(
                (sum, day) => sum + day.orders.length,
                0
              )}
            </td>
            <td
              style={{ fontSize: "12px", textAlign: "right" }}
              className="py-2"
            >
              {sortedDailySummary.reduce(
                (sum, day) => sum + day.totalQuantity,
                0
              )}
            </td>
            <td
              style={{ fontSize: "12px", textAlign: "right" }}
              className="py-2"
            >
              {sortedDailySummary
                .reduce((sum, day) => sum + day.totalAmount, 0)
                .toFixed(2)}
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

PrintReportDaily.displayName = "PrintReportDaily";
