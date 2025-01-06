import React from "react";
import { Order } from "types";

export const OrderPrint = ({ orders }: { orders: Order[] }) => {
  return (
    <div className="p-8">
      {orders.map((order) => (
        <div
          key={order.id}
          className="mb-8 pb-8 border-b page-break-after-always relative"
          style={{
            pageBreakAfter: "always",
            minHeight: "90vh",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div className="mb-20">
            <div className="flex-1">
              <span className="text-gray-800 text-sm text-center">
                APLICA s.r.o., IČO: 00555801, DIČ: CZ00555801, Veleslavínova
                2045/7, Ústí nad Labem
              </span>
            </div>
            <div className="mb-4 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold">{order.user.full_name}</h2>
                <p className="text-gray-800">{order.user.address}</p>
                {order.driver?.full_name && (
                  <p className="text-gray-800">
                    Řidič: {order.driver.full_name}
                  </p>
                )}
                <p className="text-gray-800">Poznámka: {order.note}</p>
              </div>
              <div className="text-right">
                <span className="text-gray-800 text-sm">
                  Objednávka #{order.id}
                </span>
                <p className="text-gray-800">
                  {new Date(order.date).toLocaleDateString()}
                </p>
              </div>
            </div>

            <table className="w-full mb-4">
              <thead>
                <tr>
                  <th className="text-left border-b">Kód</th>
                  <th className="text-left border-b">Produkt</th>
                  <th className="text-right border-b">Množství</th>
                  <th className="text-right border-b">Cena</th>
                  <th className="text-right border-b">Celkem</th>
                </tr>
              </thead>
              <tbody>
                {order.order_items
                  .filter((item) => item.quantity > 0)
                  .sort((a, b) => a.product.name.localeCompare(b.product.name))
                  .map((item, index, array) => {
                    const needsPageBreak =
                      array.length > 35 &&
                      index === Math.floor(array.length / 2) - 1;

                    return (
                      <React.Fragment key={`${order.id}-${item.product.name}`}>
                        <tr>
                          <td className="border-b py-1">{item.product.code}</td>
                          <td className="border-b py-1">{item.product.name}</td>
                          <td className="text-right border-b py-1">
                            {item.quantity}
                          </td>
                          <td className="text-right border-b py-1">
                            {item.price} Kč
                          </td>
                          <td className="text-right border-b py-1">
                            {(item.quantity * item.price).toFixed(2)} Kč
                          </td>
                        </tr>
                        {needsPageBreak && (
                          <>
                            <tr className="page-break-after">
                              <td colSpan={5} style={{ height: "300px" }}></td>
                            </tr>
                            <tr>
                              <td colSpan={5}>
                                <div
                                  style={{
                                    position: "absolute",
                                    bottom: "20px",
                                    left: "0",
                                    right: "0",
                                    backgroundColor: "#f3f4f6",
                                    padding: "1rem",
                                    borderRadius: "0.25rem",
                                    marginBottom: "1.25rem",
                                  }}
                                ></div>
                              </td>
                            </tr>
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </table>

            <div className="text-right mb-4">
              <p className="text-right font-semibold">
                {order.user?.role === "mobil"
                  ? Math.round(order.total).toFixed(2)
                  : order.total.toFixed(2)}{" "}
                Kč
              </p>
              {order.user?.role === "buyer" && (
                <>
                  <p className="text-right">
                    DPH 12%: {(order.total * 0.12).toFixed(2)} Kč
                  </p>
                  <p className="text-right font-bold">
                    Celkem s DPH:{" "}
                    {order.paid_by === "Hotově"
                      ? Math.round(order.total * 1.12).toFixed(2)
                      : (order.total * 1.12).toFixed(2)}{" "}
                    Kč
                  </p>
                </>
              )}
            </div>
            <div style={{ display: "flex" }}>
              <div
                style={{
                  flex: "1 1 0%",
                  textAlign: "left",
                }}
              >
                <p style={{ fontWeight: "bold" }}>Vydané přepravky:</p>
                <p>Malé: {order.crateSmall || 0}</p>
                <p>Velké: {order.crateBig || 0}</p>
              </div>
              <div
                style={{
                  flex: "1 1 0%",
                  textAlign: "right",
                }}
              >
                <p style={{ fontWeight: "bold" }}>Přijaté přepravky:</p>
                <p>Malé: {order.crateSmallReceived || 0}</p>
                <p>Velké: {order.crateBigReceived || 0}</p>
              </div>
            </div>
          </div>

          <style>
            {`
              @media print {
                .flex { display: flex !important; }
                .flex-1 { flex: 1 1 0% !important; }
                .text-left { text-align: left !important; }
                .text-right { text-align: right !important; }
                .text-center { text-align: center !important; }
                .justify-between { justify-content: space-between !important; }
                .items-start { align-items: flex-start !important; }
                .text-xl { font-size: 1.25rem !important; }
                .font-bold { font-weight: bold !important; }
                .font-semibold { font-weight: 600 !important; }
                .border-t { border-top: 1px solid #718096 !important; }
                .text-sm { font-size: 0.875rem !important; }
                .text-gray-800 { color: #333 !important; }
                .text-gray-600 { color: #718096 !important; }
                .border-b { border-bottom: 1px solid #718096 !important; }

                /* Remove all edges and margins */
                @page {
                  margin: 10px;
                  padding: 0;
                }
                
                /* Position crates at bottom */
                .crates-container {
                  position: fixed !important;
                  bottom: 0 !important;
                  left: 0 !important;
                  right: 0 !important;
                  margin-bottom: 20px !important;
                }
              }
            `}
          </style>
        </div>
      ))}
    </div>
  );
};
