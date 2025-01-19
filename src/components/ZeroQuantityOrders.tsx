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
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";

interface ZeroQuantityOrdersProps {
  date: string; // This will be the start date of the week
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
  const [globalFilter, setGlobalFilter] = useState("");

  // Get the week's date range
  const weekStart = useMemo(
    () => startOfWeek(new Date(date), { weekStartsOn: 1 }),
    [date]
  );
  const weekEnd = useMemo(
    () => endOfWeek(new Date(date), { weekStartsOn: 1 }),
    [date]
  );

  // Get array of all dates in the week
  const datesInWeek = useMemo(
    () =>
      eachDayOfInterval({
        start: weekStart,
        end: weekEnd,
      }),
    [weekStart, weekEnd]
  );

  // Fetch histories useEffect
  useEffect(() => {
    const fetchHistories = async () => {
      const histories: Record<number, number> = {};
      for (const order of orders || []) {
        for (const item of order.order_items) {
          if (item.quantity === 0 && !histories[item.id]) {
            // Add check to prevent duplicate fetches
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
  }, [orders]); // Only depend on orders

  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    return orders
      .filter((order) => {
        const orderDate = format(new Date(order.date), "yyyy-MM-dd");
        const isInWeek = datesInWeek.some(
          (date) => format(date, "yyyy-MM-dd") === orderDate
        );
        if (!isInWeek) return false;

        const hasZeroItems = order.order_items.some(
          (item: OrderItem) => item.quantity === 0
        );
        if (!hasZeroItems) return false;

        if (globalFilter) {
          const searchTerm = globalFilter.toLowerCase();
          const matchesProducts = order.order_items.some((item: OrderItem) =>
            item.product.name.toLowerCase().includes(searchTerm)
          );
          const matchesCustomer = order.user.full_name
            ?.toLowerCase()
            .includes(searchTerm);
          return matchesProducts || matchesCustomer;
        }
        return true;
      })
      .sort((a, b) => {
        const dateComparison =
          new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateComparison !== 0) return dateComparison;
        const nameA = a.user?.full_name || "";
        const nameB = b.user?.full_name || "";
        return nameA.localeCompare(nameB);
      });
  }, [orders, datesInWeek, globalFilter]);

  // Product summaries useEffect
  useEffect(() => {
    if (!filteredOrders || !itemHistories) return;

    const summaries: Record<string, number> = {};

    filteredOrders.forEach((order) => {
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
  }, [filteredOrders, itemHistories]); // Only depend on filteredOrders and itemHistories

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  if (!filteredOrders.length) {
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
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">
          Objednávky s nulovým množstvím položek ({format(weekStart, "dd.MM.")}{" "}
          - {format(weekEnd, "dd.MM.yyyy")})
        </h2>
        <Input
          placeholder="Hledat v objednávkách..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
      </div>

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
          {filteredOrders.map((order) => (
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
                          (Original: {itemHistories[item.id] || "?"} → Nyní: 0)
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
