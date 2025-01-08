import { Order } from "../../types";
import { format } from "date-fns";

interface OrdersTableSummaryProps {
  orders: Order[];
  user?: any;
  driver?: any;
}

export const OrdersTableSummary = ({
  orders,
  user,
}: OrdersTableSummaryProps) => {
  // Sort orders by date and then by customer name
  const sortedOrders = [...orders].sort((a, b) => {
    const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateCompare === 0) {
      return (a.driver?.full_name || "").localeCompare(
        b.driver?.full_name || ""
      );
    }
    return dateCompare;
  });

  // Calculate total sum
  const totalSum = orders.reduce((sum, order) => sum + order.total, 0);

  // const showTotal = user?.role === "admin" || user?.role === "expedition"; // Only admin can see totals

  // Add these helper functions at the top of the component
  const countAllItems = (order: Order) => {
    return order.order_items?.length || 0;
  };

  const countUncheckedItems = (order: Order) => {
    return order.order_items?.filter((item) => !item.checked).length || 0;
  };

  const countZeroItems = (order: Order) => {
    return order.order_items?.filter((item) => item.quantity === 0).length || 0;
  };

  const countNonZeroItems = (order: Order) => {
    return order.order_items?.filter((item) => item.quantity > 0).length || 0;
  };

  return (
    <div style={{ fontSize: "12px", margin: "0 10px" }}>
      <h2 className="text-2xl font-bold mb-6">Přehled objednávek</h2>
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th style={{ textAlign: "left" }}>Datum</th>
            <th style={{ textAlign: "left" }}>Odběratel</th>
            <th style={{ textAlign: "left" }}>Řidič</th>

            <th style={{ textAlign: "left" }}>Položky</th>
            <th style={{ textAlign: "left" }}>X</th>
            <th style={{ textAlign: "left" }}>Status</th>
            {user?.role === "admin" && (
              <th style={{ textAlign: "left" }}>Celkem</th>
            )}
          </tr>
        </thead>
        <tbody style={{ textAlign: "left", fontSize: "12px" }}>
          {sortedOrders.map((order) => (
            <tr key={order.id} className="border-b">
              <td className="py-2">
                {format(new Date(order.date), "dd.MM.yyyy")}
              </td>
              <td className="py-2">{order.user?.full_name || "-"}</td>
              <td className="py-2">{order.driver?.full_name || "-"}</td>

              <td className="py-2" style={{ textAlign: "right" }}>
                {countUncheckedItems(order)}/{countNonZeroItems(order)}
              </td>
              <td className="py-2" style={{ textAlign: "right" }}>
                {countZeroItems(order)}/{countAllItems(order)}
              </td>
              {user?.role === "admin" && (
                <td className="py-2" style={{ textAlign: "right" }}>
                  {order.total.toFixed(2)} Kč
                </td>
              )}
              <td className="py-2">{order.status || "-"}</td>
              <td className="py-2">{order.note || "-"}</td>
            </tr>
          ))}

          {user?.role === "admin" && (
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
