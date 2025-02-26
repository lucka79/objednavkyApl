import { Order } from "../../types";
import { format } from "date-fns";

interface PrintReportBuyerOrdersProps {
  orders: Order[];
}

export const PrintReportBuyerOrders = ({
  orders,
}: PrintReportBuyerOrdersProps) => {
  // Get min and max dates from orders
  const dates = orders.map((order) => new Date(order.date));
  const minDate = new Date(Math.min(...dates.map((date) => date.getTime())));
  const maxDate = new Date(Math.max(...dates.map((date) => date.getTime())));

  const dateRange =
    minDate.toLocaleDateString() === maxDate.toLocaleDateString()
      ? minDate.toLocaleDateString()
      : `${minDate.toLocaleDateString()} - ${maxDate.toLocaleDateString()}`;

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

  // Add order count
  const orderCount = orders.length;

  return (
    <div style={{ fontSize: "12px", margin: "0 10px" }}>
      <h2 className="text-2xl font-bold mb-6">
        Report objednávek ({orderCount}) ({dateRange})
      </h2>
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th style={{ textAlign: "left" }}>Datum</th>
            <th style={{ textAlign: "left" }}>Odběratel</th>
            <th style={{ textAlign: "left" }}>Řidič</th>
            <th style={{ textAlign: "right" }}>Celkem</th>
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
                {order.total.toFixed(2)} Kč
              </td>
            </tr>
          ))}

          <tr className="font-bold">
            <td colSpan={3} className="py-4 text-right">
              Celková suma:
            </td>
            <td className="py-4 text-right">{totalSum.toFixed(2)} Kč</td>
          </tr>
        </tbody>
      </table>
      <div className="text-right text-sm text-gray-500 mt-4">
        Počet objednávek: {orderCount}
        <br />
        Vytištěno: {format(new Date(), "dd.MM.yyyy HH:mm")}
        <br />
        Ceny jsou bez DPH.
      </div>
    </div>
  );
};
