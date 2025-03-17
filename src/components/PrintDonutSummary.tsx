import { Order } from "../../types";
import { forwardRef } from "react";

interface PrintDonutSummaryProps {
  orders: Order[];
}

export const PrintDonutSummary = forwardRef<
  HTMLDivElement,
  PrintDonutSummaryProps
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
        // Only process items from category 4
        if (item.product.category_id === 4) {
          const productId = item.product_id;
          if (!acc[productId]) {
            acc[productId] = {
              name: item.product.name,
              quantity: 0,
              total: 0,
              category_id: item.product.category_id || 0,
              // @ts-ignore
              category_name: item.product.category?.name || "Ostatní",
              // @ts-ignore
              printId: item.product.printId,
              // @ts-ignore
              isChild: item.product.isChild,
              koef: Number(item.product.koef), // Get koef directly from the product
            };
          }
          acc[productId].quantity += item.quantity;
          acc[productId].total += item.quantity * item.price;
        }
      });
      return acc;
    },
    {} as Record<
      string,
      {
        name: string;
        quantity: number;
        total: number;
        koef: number;
        category_id: number;
        category_name: string;
        printId: number;
        isChild: boolean;
      }
    >
  );

  // Group products by category
  const productsByCategory = Object.values(productSummary)
    .filter((item) => item.quantity > 0)
    .reduce(
      (acc, product) => {
        const category = product.category_name;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(product);
        return acc;
      },
      // @ts-ignore
      {} as Record<string, (typeof Object.values<typeof productSummary>)[0][]>
    );

  // Sort categories and products within each category
  const sortedCategories = Object.entries(productsByCategory).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return (
    <div ref={ref} style={{ fontSize: "12px", margin: "0 10px" }}>
      <h2 className="text-xl font-bold mb-4">Výroba koblih ({dateRange})</h2>
      {sortedCategories.map(([category, products]) => {
        // Group products by printId
        type ProductItem = {
          isChild: boolean;
          name: string;
          printId: number;
          quantity: number;
          koef: number;
        };
        const groupedByPrintId: Record<number, ProductItem[]> = products.reduce(
          (acc, product) => {
            const printId = product.printId;
            if (!acc[printId]) {
              acc[printId] = [];
            }
            acc[printId].push(product);
            return acc;
          },
          {}
        );

        // Sort groups by parent product name
        const sortedGroups = Object.entries(groupedByPrintId).sort(
          ([, a], [, b]) => {
            const parentA = a.find((p) => !p.isChild)?.name || "";
            const parentB = b.find((p) => !p.isChild)?.name || "";
            return parentA.localeCompare(parentB);
          }
        );

        return (
          <div key={category} className="mb-6">
            <h3 className="text-lg font-semibold mb-2">{category}</h3>
            <table className="w-[50%] mb-4">
              <colgroup>
                <col style={{ width: "50px" }} />
                <col style={{ width: "250px" }} />
                <col style={{ width: "50px" }} />
                <col style={{ width: "50px" }} />
              </colgroup>
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 bg-gray-50">PrintID</th>
                  <th className="text-left py-2 bg-gray-50">Položka</th>
                  <th className="text-right py-2 bg-gray-50">Množství</th>
                  <th className="text-right py-2 bg-gray-50">Celkem</th>
                </tr>
              </thead>
              <tbody>
                {sortedGroups.flatMap(([_, group]) =>
                  group
                    .sort((a, b) => {
                      // Keep existing sort within group (parent first, then children)
                      if (a.isChild !== b.isChild) {
                        return a.isChild ? 1 : -1;
                      }
                      return a.name.localeCompare(b.name);
                    })
                    .map((item, index, array) => {
                      const prevItem = index > 0 ? array[index - 1] : null;
                      const showPrintId =
                        !prevItem || prevItem.printId !== item.printId;

                      // Calculate total quantity for parent items or first child if parent is missing
                      let totalQuantity = 0;
                      const productsWithSamePrintId = array.filter(
                        (i) => i.printId === item.printId
                      );
                      const hasParent = productsWithSamePrintId.some(
                        (i) => !i.isChild
                      );
                      const isFirstChild =
                        item.isChild &&
                        (!prevItem || prevItem.printId !== item.printId);

                      if (!item.isChild || (!hasParent && isFirstChild)) {
                        totalQuantity = productsWithSamePrintId.reduce(
                          (sum, i) => sum + i.quantity * i.koef,
                          0
                        );
                      }

                      return (
                        <tr key={index} className="border-b">
                          <td style={{ fontSize: "10px" }} className="py-2">
                            {showPrintId ? item.printId : ""}
                          </td>

                          <td
                            style={{
                              fontSize: "12px",
                              fontWeight: !item.isChild ? "bold" : "normal",
                              paddingLeft: item.isChild ? "20px" : "0",
                            }}
                            className="py-2"
                          >
                            {item.name}
                          </td>
                          <td
                            style={{
                              fontSize: "12px",
                              fontWeight:
                                !item.isChild && !totalQuantity
                                  ? "bold"
                                  : "normal",
                            }}
                            className="text-right py-2"
                          >
                            {item.koef !== 1
                              ? `${item.quantity} (${item.quantity * item.koef})`
                              : item.quantity}
                          </td>
                          <td
                            style={{ fontSize: "14px", fontWeight: "bold" }}
                            className="text-right py-2"
                          >
                            {!item.isChild || (!hasParent && isFirstChild)
                              ? totalQuantity || item.quantity
                              : ""}
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        );
      })}
      <div className="text-right text-gray-600 mt-4 text-xs">
        Vytištěno: {new Date().toLocaleString()}
      </div>
    </div>
  );
});

PrintDonutSummary.displayName = "Výroba koblih";
