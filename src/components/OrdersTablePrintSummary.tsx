import { Order } from "../../types";
import { format } from "date-fns";

interface OrdersTableSummaryProps {
  orders: Order[];
  user?: any;
}

export const OrdersTableSummary = ({
  orders,
  user,
}: OrdersTableSummaryProps) => {
  // Sort orders by date and then by customer name
  const sortedOrders = [...orders].sort((a, b) => {
    const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateCompare === 0) {
      return (a.user?.full_name || "").localeCompare(b.user?.full_name || "");
    }
    return dateCompare;
  });

  // Calculate total sum
  const totalSum = orders.reduce((sum, order) => sum + order.total, 0);

  const showTotal = user?.role === "admin"; // Only admin can see totals

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6">Přehled objednávek</h2>
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Datum</th>
            <th className="text-left py-2">Odběratel</th>
            <th className="text-left py-2">Řidič</th>
            {showTotal && <th className="text-right py-2">Celkem</th>}
          </tr>
        </thead>
        <tbody>
          {sortedOrders.map((order) => (
            <tr key={order.id} className="border-b">
              <td className="py-2">
                {format(new Date(order.date), "dd.MM.yyyy")}
              </td>
              <td className="py-2">{order.user?.full_name || "-"}</td>
              <td className="py-2">{order.driver?.full_name || "-"}</td>
              {showTotal && (
                <td className="py-2 text-right">{order.total.toFixed(2)} Kč</td>
              )}
            </tr>
          ))}
          {showTotal && (
            <tr className="font-bold">
              <td colSpan={3} className="py-4 text-right">
                Celková suma:
              </td>
              <td className="py-4 text-right">{totalSum.toFixed(2)} Kč</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="text-right text-sm text-gray-500 mt-4">
        Vytištěno: {format(new Date(), "dd.MM.yyyy HH:mm")}
      </div>
    </div>
  );
};
