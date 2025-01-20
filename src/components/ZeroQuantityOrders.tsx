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
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  addWeeks,
  startOfDay,
  endOfDay,
} from "date-fns";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ProductSummary {
  name: string;
  totalOriginalQuantity: number;
}

export const ZeroQuantityOrders = () => {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(format(today, "yyyy-MM-dd"));
  const { data: orders, isLoading, error } = fetchAllOrders();
  const [itemHistories, setItemHistories] = useState<Record<number, number>>(
    {}
  );
  const [productSummaries, setProductSummaries] = useState<ProductSummary[]>(
    []
  );
  const [globalFilter, setGlobalFilter] = useState("");
  const [viewMode, setViewMode] = useState<"today" | "week" | "month">("today");

  // Get the week's and month's date ranges based on the selected date
  const weekStart = useMemo(
    () => startOfWeek(new Date(selectedDate), { weekStartsOn: 1 }),
    [selectedDate]
  );
  const weekEnd = useMemo(
    () => endOfWeek(new Date(selectedDate), { weekStartsOn: 1 }),
    [selectedDate]
  );
  const monthStart = useMemo(
    () => startOfMonth(new Date(selectedDate)),
    [selectedDate]
  );
  const monthEnd = useMemo(
    () => endOfMonth(new Date(selectedDate)),
    [selectedDate]
  );

  // Add today's date range
  const todayStart = useMemo(() => startOfDay(new Date()), []);
  const todayEnd = useMemo(() => endOfDay(new Date()), []);

  // Modify dateRange to include today option
  const dateRange = useMemo(() => {
    if (viewMode === "today") {
      return eachDayOfInterval({ start: todayStart, end: todayEnd });
    }
    const start = viewMode === "week" ? weekStart : monthStart;
    const end = viewMode === "week" ? weekEnd : monthEnd;
    return eachDayOfInterval({ start, end });
  }, [
    weekStart,
    weekEnd,
    monthStart,
    monthEnd,
    viewMode,
    todayStart,
    todayEnd,
  ]);

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
        const isInRange = dateRange.some(
          (date) => format(date, "yyyy-MM-dd") === orderDate
        );
        if (!isInRange) return false;

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
  }, [orders, dateRange, globalFilter]);

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

  // Update dateRangeText to handle today
  const dateRangeText = useMemo(() => {
    if (viewMode === "today") {
      return format(todayStart, "dd.MM.yyyy");
    }
    return viewMode === "week"
      ? `${format(weekStart, "dd.MM.")} - ${format(weekEnd, "dd.MM.yyyy")}`
      : `${format(monthStart, "dd.MM.")} - ${format(monthEnd, "dd.MM.yyyy")}`;
  }, [viewMode, weekStart, weekEnd, monthStart, monthEnd, todayStart]);

  const filteredOrdersCount = filteredOrders.length;

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  if (!filteredOrders.length) {
    return (
      <div className="w-full py-4">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => {
                  setSelectedDate(format(today, "yyyy-MM-dd"));
                  setViewMode("today");
                }}
                className={`px-3 py-1 rounded ${
                  viewMode === "today"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Dnes
              </Button>
              <Button
                onClick={() => {
                  setSelectedDate(format(weekStart, "yyyy-MM-dd"));
                  setViewMode("week");
                }}
                className={`px-3 py-1 rounded ${
                  viewMode === "week" &&
                  format(weekStart, "yyyy-MM-dd") === selectedDate
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {format(weekStart, "dd.MM.")} - {format(weekEnd, "dd.MM.")}
              </Button>
              <Button
                onClick={() => {
                  setSelectedDate(format(addWeeks(weekStart, 1), "yyyy-MM-dd"));
                  setViewMode("week");
                }}
                className={`px-3 py-1 rounded ${
                  viewMode === "week" &&
                  format(addWeeks(weekStart, 1), "yyyy-MM-dd") === selectedDate
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {format(addWeeks(weekStart, 1), "dd.MM.")} -{" "}
                {format(addWeeks(weekEnd, 1), "dd.MM.")}
              </Button>
              <Button
                onClick={() => {
                  setSelectedDate(format(monthStart, "yyyy-MM-dd"));
                  setViewMode("month");
                }}
                className={`px-3 py-1 rounded ${
                  viewMode === "month"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {format(monthStart, "dd.MM.")} - {format(monthEnd, "dd.MM.")}
              </Button>
            </div>
            <Input
              placeholder="Hledat v objednávkách..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="text-center p-8 bg-gray-50 rounded-lg">
            <p className="text-gray-600 text-lg">
              Neexistují žádné položky s nulovým množstvím v objednávkách pro{" "}
              {dateRangeText}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-4">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          {/* <h2 className="text-2xl font-bold flex items-center gap-2">
            Objednávky s nulovým množstvím položek
            <Badge variant="secondary">{filteredOrdersCount}</Badge>
          </h2> */}
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => {
                setSelectedDate(format(today, "yyyy-MM-dd"));
                setViewMode("today");
              }}
              className={`px-3 py-1 rounded ${
                viewMode === "today"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Dnes
            </Button>
            <Button
              onClick={() => {
                setSelectedDate(format(weekStart, "yyyy-MM-dd"));
                setViewMode("week");
              }}
              className={`px-3 py-1 rounded ${
                viewMode === "week" &&
                format(weekStart, "yyyy-MM-dd") === selectedDate
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {format(weekStart, "dd.MM.")} - {format(weekEnd, "dd.MM.")}
            </Button>
            <Button
              onClick={() => {
                setSelectedDate(format(addWeeks(weekStart, 1), "yyyy-MM-dd"));
                setViewMode("week");
              }}
              className={`px-3 py-1 rounded ${
                viewMode === "week" &&
                format(addWeeks(weekStart, 1), "yyyy-MM-dd") === selectedDate
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {format(addWeeks(weekStart, 1), "dd.MM.")} -{" "}
              {format(addWeeks(weekEnd, 1), "dd.MM.")}
            </Button>
            <Button
              onClick={() => {
                setSelectedDate(format(monthStart, "yyyy-MM-dd"));
                setViewMode("month");
              }}
              className={`px-3 py-1 rounded ${
                viewMode === "month"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {format(monthStart, "dd.MM.")} - {format(monthEnd, "dd.MM.")}
            </Button>
          </div>
          <Input
            placeholder="Hledat v objednávkách..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <h2 className="text-2xl font-bold">
          Objednávky s nulovým množstvím položek ({dateRangeText}){" "}
          <Badge
            className="justify-center border-orange-500 text-orange-500 bg-white"
            variant="secondary"
          >
            {filteredOrdersCount}
          </Badge>
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {productSummaries.map((summary) => (
          <div
            key={summary.name}
            className="bg-white p-4 rounded-lg shadow relative"
          >
            <h3 className="font-semibold text-lg">{summary.name}</h3>
            <div className="absolute bottom-2 right-2">
              <Badge className="bg-orange-500">
                {summary.totalOriginalQuantity}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Datum</TableHead>
            <TableHead>Odběratel</TableHead>
            <TableHead>Řidič</TableHead>
            <TableHead>Položky s nulovým množstvím</TableHead>
            <TableHead>Poznámka</TableHead>
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
              <TableCell>{order.note || "N/A"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
