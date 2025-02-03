import { fetchAllOrders } from "@/hooks/useOrders";

import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addWeeks,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cs } from "date-fns/locale";

interface Driver {
  id: number;
  full_name: string;
}

interface ProductSummary {
  name: string;
  totalOriginalQuantity: number;
  customers: string[];
}

export const ZeroQuantityByDriver = () => {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(format(today, "yyyy-MM-dd"));
  const [viewMode, setViewMode] = useState<"today" | "week" | "month">("today");
  const { data: orders, isLoading, error } = fetchAllOrders();
  const [itemHistories, setItemHistories] = useState<Record<number, number>>(
    {}
  );
  const [selectedDriver, setSelectedDriver] = useState<string>("all");
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>(
    format(today, "yyyy-MM")
  );

  // Date range calculations
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
  const todayStart = useMemo(
    () => startOfDay(new Date(selectedDate)),
    [selectedDate]
  );
  const todayEnd = useMemo(
    () => endOfDay(new Date(selectedDate)),
    [selectedDate]
  );

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

  //   const dateRangeText = useMemo(() => {
  //     if (viewMode === "today") {
  //       return format(todayStart, "dd.MM.yyyy");
  //     }
  //     return viewMode === "week"
  //       ? `${format(weekStart, "dd.MM.")} - ${format(weekEnd, "dd.MM.yyyy")}`
  //       : `${format(monthStart, "dd.MM.")} - ${format(monthEnd, "dd.MM.yyyy")}`;
  //   }, [viewMode, weekStart, weekEnd, monthStart, monthEnd, todayStart]);

  // Calendar selection handler
  const onDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(format(date, "yyyy-MM-dd"));
      setViewMode("today");
    }
  };

  // Get unique drivers from orders
  const drivers = useMemo(() => {
    if (!orders) return [];
    const uniqueDrivers = new Map<number, Driver>();

    orders.forEach((order) => {
      if (order.driver && !uniqueDrivers.has(Number(order.driver.id))) {
        uniqueDrivers.set(Number(order.driver.id), {
          id: Number(order.driver.id),
          full_name: order.driver.full_name,
        });
      }
    });

    return Array.from(uniqueDrivers.values()).sort((a, b) =>
      a.full_name.localeCompare(b.full_name)
    );
  }, [orders]);

  // Fetch histories for zero quantity items
  useEffect(() => {
    const fetchHistories = async () => {
      if (!orders) return;

      const zeroQuantityItemIds = orders.flatMap((order) =>
        order.order_items
          .filter((item) => item.quantity === 0)
          .map((item) => Number(item.product_id))
      );

      if (zeroQuantityItemIds.length === 0) {
        setItemHistories({});
        return;
      }

      const { data } = await supabase
        .from("order_items_history")
        .select("order_item_id, old_quantity")
        .in("order_item_id", zeroQuantityItemIds)
        .order("changed_at", { ascending: true });

      const histories: Record<number, number> = {};
      if (data) {
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

  // Update filteredOrders to use dateRange
  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    return orders.filter((order) => {
      const orderDate = format(new Date(order.date), "yyyy-MM-dd");
      const isInRange = dateRange.some(
        (date) => format(date, "yyyy-MM-dd") === orderDate
      );

      if (!isInRange) return false;

      if (
        selectedDriver !== "all" &&
        order.driver?.id.toString() !== selectedDriver
      ) {
        return false;
      }

      const hasZeroItems = order.order_items.some(
        (item) => Number(item.quantity) === 0
      );

      if (!hasZeroItems) return false;

      if (globalFilter) {
        const searchTerm = globalFilter.toLowerCase();
        const matchesProducts = order.order_items.some((item) =>
          item.product.name.toLowerCase().includes(searchTerm)
        );
        const matchesCustomer = order.user.full_name
          ?.toLowerCase()
          .includes(searchTerm);
        return matchesProducts || matchesCustomer;
      }

      return true;
    });
  }, [orders, selectedDriver, dateRange, globalFilter]);

  // Summarize products by driver
  const driverProductSummaries = useMemo(() => {
    const summaries: Record<string, ProductSummary> = {};

    filteredOrders.forEach((order) => {
      order.order_items
        .filter((item) => Number(item.quantity) === 0)
        .forEach((item) => {
          const productName = item.product.name;
          if (!summaries[productName]) {
            summaries[productName] = {
              name: productName,
              totalOriginalQuantity: 0,
              customers: [],
            };
          }

          summaries[productName].totalOriginalQuantity +=
            itemHistories[Number(item.product_id)] || 0;
          if (
            order.user?.full_name &&
            !summaries[productName].customers.includes(order.user.full_name)
          ) {
            summaries[productName].customers.push(order.user.full_name);
          }
        });
    });

    return Object.values(summaries).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [filteredOrders, itemHistories]);

  // Generate array of months for the current year
  const monthsOfYear = useMemo(() => {
    const months = [];
    const currentYear = new Date().getFullYear();
    for (let month = 0; month < 12; month++) {
      const date = new Date(currentYear, month, 1);
      months.push({
        value: format(date, "yyyy-MM"),
        label: format(date, "MMMM yyyy", { locale: cs }),
        start: startOfMonth(date),
        end: endOfMonth(date),
      });
    }
    return months;
  }, []);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

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
            <Select
              value={selectedMonth}
              onValueChange={(value) => {
                const month = monthsOfYear.find((m) => m.value === value);
                if (month) {
                  setSelectedDate(format(month.start, "yyyy-MM-dd"));
                  setSelectedMonth(value);
                  setViewMode("month");
                }
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Vybrat měsíc" />
              </SelectTrigger>
              <SelectContent>
                {monthsOfYear.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Select value={selectedDriver} onValueChange={setSelectedDriver}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Vybrat řidiče" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všichni řidiči</SelectItem>
                {drivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id.toString()}>
                    {driver.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Hledat produkty nebo zákazníky..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {driverProductSummaries.map((summary) => (
            <div
              key={summary.name}
              className="bg-white p-4 rounded-lg shadow-sm border"
            >
              <h3 className="font-semibold text-lg mb-2">{summary.name}</h3>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-500">Celkem chybí:</span>
                <Badge
                  variant="secondary"
                  className="bg-orange-100 text-orange-800"
                >
                  {summary.totalOriginalQuantity}
                </Badge>
              </div>
              <div className="mt-2">
                <p className="text-sm text-gray-500 mb-1">Zákazníci:</p>
                <div className="space-y-1">
                  {summary.customers.map((customer, index) => (
                    <p key={index} className="text-sm text-gray-700">
                      {customer}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
