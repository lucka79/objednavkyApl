import { fetchAllOrders } from "@/hooks/useOrders";
import { OrderItem } from "../../types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface ZeroQuantityOrdersProps {
  date: string;
}

interface ProductSummary {
  name: string;
  totalOriginalQuantity: number;
}

export const ZeroQuantityOrders = ({ date }: ZeroQuantityOrdersProps) => {
  const { data: orders, isLoading, error } = fetchAllOrders();
  const [itemHistories, setItemHistories] = useState<Record<number, number>>(
    {}
  );
  const [productSummaries, setProductSummaries] = useState<ProductSummary[]>(
    []
  );

  useEffect(() => {
    const fetchHistories = async () => {
      const histories: Record<number, number> = {};
      for (const order of orders || []) {
        for (const item of order.order_items) {
          if (item.quantity === 0) {
            const { data } = await supabase
              .from("order_items_history")
              .select("old_quantity")
              .eq("order_item_id", item.id)
              .order("changed_at", { ascending: true })
              .limit(1)
              .single();
            if (data) histories[item.id] = data.old_quantity;
          }
        }
      }
      setItemHistories(histories);
    };

    if (orders) fetchHistories();
  }, [orders]);

  useEffect(() => {
    if (orders && itemHistories) {
      const summaries: Record<string, number> = {};

      orders
        .filter((order) => format(new Date(order.date), "yyyy-MM-dd") === date)
        .forEach((order) => {
          order.order_items
            .filter((item: OrderItem) => item.quantity === 0)
            .forEach((item: OrderItem) => {
              const productName = item.product.name;
              const originalQuantity = itemHistories[item.id] || 0;
              summaries[productName] =
                (summaries[productName] || 0) + originalQuantity;
            });
        });

      const summaryArray = Object.entries(summaries)
        .map(([name, totalOriginalQuantity]) => ({
          name,
          totalOriginalQuantity,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setProductSummaries(summaryArray);
    }
  }, [orders, itemHistories, date]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  // Filter and sort orders
  const ordersWithZeroItems = orders
    ?.filter(
      (order) =>
        order.order_items.some((item: OrderItem) => item.quantity === 0) &&
        format(new Date(order.date), "yyyy-MM-dd") === date
    )
    .sort((a, b) => {
      // First sort by date
      const dateComparison =
        new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateComparison !== 0) return dateComparison;

      // Then by driver name
      const driverA = a.driver?.full_name || "";
      const driverB = b.driver?.full_name || "";
      return driverA.localeCompare(driverB);
    });

  if (!ordersWithZeroItems?.length) {
    return (
      <div className="w-full py-4">
        <div className="text-center p-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600 text-lg">
            Neexistují žádné položky s nulovým množstvím v objednávkách pro
            tento den.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-4">
      <h2 className="text-2xl font-bold mb-4">
        Objednávky s nulovým množstvím položek
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {productSummaries.map((summary) => (
          <div key={summary.name} className="bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold text-lg">{summary.name}</h3>
            <p className="text-gray-600">
              Původní množství: {summary.totalOriginalQuantity}
            </p>
          </div>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead>Items with Changed Quantity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordersWithZeroItems?.map((order) => (
            <TableRow key={order.id}>
              <TableCell>
                {format(new Date(order.date), "dd.MM.yyyy")}
              </TableCell>
              <TableCell>{order.user?.full_name || "N/A"}</TableCell>
              <TableCell>{order.driver?.full_name || "N/A"}</TableCell>
              <TableCell>
                <ul className="list-disc list-inside">
                  {order.order_items
                    .filter((item: OrderItem) => item.quantity === 0)
                    .map((item: OrderItem) => (
                      <li key={item.id}>
                        {item.product.name}
                        <span className="text-gray-500 ml-2">
                          (Original: {itemHistories[item.id] || "?"} → Current:
                          0)
                        </span>
                      </li>
                    ))}
                </ul>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
