import { Order } from "../../types";
import { format } from "date-fns";

interface PrintReportBuyersSummaryProps {
  orders: Order[];
}

export const PrintReportBuyersSummary = ({
  orders,
}: PrintReportBuyersSummaryProps) => {
  // Sort orders by date and then by customer name
  //   const sortedOrders = [...orders].sort((a, b) => {
  //     const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
  //     if (dateCompare === 0) {
  //       return (a.driver?.full_name || "").localeCompare(
  //         b.driver?.full_name || ""
  //       );
  //     }
  //     return dateCompare;
  //   });

  // Calculate total sum
  const totalSum = orders.reduce((sum, order) => sum + order.total, 0);

  // Add order count
  const orderCount = orders.length;
  const uniqueUsersCount = new Set(orders.map((order) => order.user?.full_name))
    .size;

  // Calculate totals per user and overall sum
  const userTotals = orders.reduce(
    (acc, order) => {
      const userName = order.user?.full_name || "-";
      if (!acc[userName]) {
        acc[userName] = {
          total: 0,
          ico: order.user?.ico || "-",
        };
      }
      acc[userName].total += order.total;
      return acc;
    },
    {} as Record<string, { total: number; ico: string }>
  );

  // Sort users by name using Czech locale
  const sortedUsers = Object.keys(userTotals).sort((a, b) =>
    a.localeCompare(b, "cs")
  );

  return (
    <div style={{ fontSize: "10px", margin: "0 10px" }}>
      <h2 className="text-2xl font-bold mb-6">
        Report odběratelů ({uniqueUsersCount})
      </h2>

      {/* User totals table */}
      <table className="w-full mb-8">
        <thead>
          <tr className="border-b">
            <th style={{ textAlign: "right" }}>IČO</th>
            <th style={{ textAlign: "left" }}>Odběratel</th>

            <th style={{ textAlign: "right" }}>Celkem</th>
          </tr>
        </thead>
        <tbody>
          {sortedUsers.map((userName) => (
            <tr key={userName} className="border-b">
              <td style={{ textAlign: "right" }} className="py-2">
                {userTotals[userName].ico}
              </td>
              <td className="py-2">{userName}</td>

              <td className="py-2" style={{ textAlign: "right" }}>
                {userTotals[userName].total.toFixed(2)} Kč
              </td>
            </tr>
          ))}
          <tr className="font-bold border-t">
            <td className="py-2">Celková suma:</td>
            <td className="py-2"></td>
            <td className="py-2" style={{ textAlign: "right" }}>
              {totalSum.toFixed(2)} Kč
            </td>
          </tr>
        </tbody>
      </table>

      {/* Original orders table */}
      {/* <table className="w-full">
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
      </table> */}
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
