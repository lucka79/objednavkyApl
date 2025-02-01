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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { OrderDetailsDialog } from "./OrderDetailsDialog";
import { useOrderStore } from "@/providers/orderStore";

interface ProductSummary {
  name: string;
  totalOriginalQuantity: number;
  totalLostPrice: number;
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

  // Update todayStart and todayEnd to use selectedDate instead of new Date()
  const todayStart = useMemo(
    () => startOfDay(new Date(selectedDate)),
    [selectedDate]
  );
  const todayEnd = useMemo(
    () => endOfDay(new Date(selectedDate)),
    [selectedDate]
  );

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

  // Modify the fetch histories useEffect
  useEffect(() => {
    const fetchHistories = async () => {
      if (!orders) return;

      // Get all order item IDs with zero quantity
      const zeroQuantityItemIds = orders.flatMap((order) =>
        order.order_items
          .filter((item: OrderItem) => item.quantity === 0)
          .map((item: OrderItem) => item.id)
      );

      if (zeroQuantityItemIds.length === 0) {
        setItemHistories({});
        return;
      }

      // Fetch all histories in a single query
      const { data } = await supabase
        .from("order_items_history")
        .select("order_item_id, old_quantity")
        .in("order_item_id", zeroQuantityItemIds)
        .order("changed_at", { ascending: true });

      // Process the results into a map
      const histories: Record<number, number> = {};
      if (data) {
        // Group by order_item_id and take the first entry for each
        data.forEach((history) => {
          if (!histories[history.order_item_id]) {
            histories[history.order_item_id] = history.old_quantity;
          }
        });
      }

      setItemHistories(histories);
    };

    fetchHistories();
  }, [orders]);

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
        const nameA = a.driver?.full_name || "";
        const nameB = b.driver?.full_name || "";
        return nameA.localeCompare(nameB);
      });
  }, [orders, dateRange, globalFilter]);

  // Product summaries useEffect
  useEffect(() => {
    if (!filteredOrders || !itemHistories) return;

    const summaries: Record<string, { quantity: number; price: number }> = {};

    filteredOrders.forEach((order) => {
      order.order_items
        .filter((item: OrderItem) => item.quantity === 0)
        .forEach((item: OrderItem) => {
          const productName = item.product.name;
          const originalQuantity = itemHistories[item.id] || 0;
          const lostPrice = originalQuantity * item.price;

          if (!summaries[productName]) {
            summaries[productName] = { quantity: 0, price: 0 };
          }
          summaries[productName].quantity += originalQuantity;
          summaries[productName].price += lostPrice;
        });
    });

    const summaryArray = Object.entries(summaries)
      .map(([name, { quantity, price }]) => ({
        name,
        totalOriginalQuantity: quantity,
        totalLostPrice: price,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    setProductSummaries(summaryArray);
  }, [filteredOrders, itemHistories]);

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

  // Add calendar selection handler
  const onDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(format(date, "yyyy-MM-dd"));
      setViewMode("today");
    }
  };

  // Add setSelectedOrderId from orderStore
  const { setSelectedOrderId } = useOrderStore();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  if (!filteredOrders.length) {
    return (
      <div className="w-full py-4">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground",
                      viewMode === "today" &&
                        format(new Date(selectedDate), "yyyy-MM-dd") !==
                          format(today, "yyyy-MM-dd")
                        ? "bg-blue-500 text-white"
                        : ""
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate
                      ? format(new Date(selectedDate), "dd.MM.yyyy")
                      : "Vybrat datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={new Date(selectedDate)}
                    onSelect={onDateSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Button
                onClick={() => {
                  setSelectedDate(format(today, "yyyy-MM-dd"));
                  setViewMode("today");
                }}
                className={`px-3 py-1 rounded ${
                  viewMode === "today" &&
                  format(new Date(selectedDate), "yyyy-MM-dd") ===
                    format(today, "yyyy-MM-dd")
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
          <div className="flex items-center space-x-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground",
                    viewMode === "today" &&
                      format(new Date(selectedDate), "yyyy-MM-dd") !==
                        format(today, "yyyy-MM-dd")
                      ? "bg-blue-500 text-white"
                      : ""
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate
                    ? format(new Date(selectedDate), "dd.MM.yyyy")
                    : "Vybrat datum"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={new Date(selectedDate)}
                  onSelect={onDateSelect}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button
              onClick={() => {
                setSelectedDate(format(today, "yyyy-MM-dd"));
                setViewMode("today");
              }}
              className={`px-3 py-1 rounded ${
                viewMode === "today" &&
                format(new Date(selectedDate), "yyyy-MM-dd") ===
                  format(today, "yyyy-MM-dd")
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
          <Badge
            className="ml-2 justify-center bg-red-500 text-white"
            variant="outline"
          >
            {filteredOrders
              .reduce(
                (total: number, order) =>
                  total +
                  order.order_items
                    .filter((item: OrderItem) => item.quantity === 0)
                    .reduce(
                      (itemTotal: number, item: OrderItem) =>
                        itemTotal + (itemHistories[item.id] || 0) * item.price,
                      0
                    ),
                0
              )
              .toFixed(2)}{" "}
            Kč
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
            <div className="absolute bottom-2 right-2 flex flex-col items-end">
              <Badge className="bg-orange-500 mb-1">
                {summary.totalOriginalQuantity}
              </Badge>
              <span className="text-red-700 text-sm font-semibold">
                {summary.totalLostPrice.toFixed(2)} Kč
              </span>
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
            <TableHead className="text-right">Ztráta</TableHead>
            <TableHead>Položky s nulovým množstvím</TableHead>
            <TableHead>Poznámka</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredOrders.map((order) => (
            <TableRow
              key={order.id}
              className="cursor-pointer hover:bg-gray-100"
              onClick={() => setSelectedOrderId(order.id)}
            >
              <TableCell>
                {format(new Date(order.date), "dd.MM.yyyy")}
              </TableCell>
              <TableCell>{order.user?.full_name || "N/A"}</TableCell>
              <TableCell>{order.driver?.full_name || "N/A"}</TableCell>
              <TableCell className="text-right text-red-700 font-semibold">
                {order.order_items
                  .filter((item: OrderItem) => item.quantity === 0)
                  .reduce(
                    (total: number, item: OrderItem) =>
                      total + (itemHistories[item.id] || 0) * item.price,
                    0
                  )
                  .toFixed(2)}{" "}
                Kč
              </TableCell>
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

      {/* Add OrderDetailsDialog component */}
      <OrderDetailsDialog />
    </div>
  );
};
