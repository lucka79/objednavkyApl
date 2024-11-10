import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  flexRender,
} from "@tanstack/react-table";
import { fetchAllOrders } from "@/hooks/useOrders";
import { Order } from "../../types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState, useMemo } from "react";
import { useOrderStore } from "@/providers/orderStore";
import { FileSearch2 } from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const filterOrdersByDate = (
  orders: Order[],
  period: "today" | "tomorrow" | "week" | "month" | "lastMonth",
  selectedDate?: Date
) => {
  if (selectedDate) {
    return orders.filter((order) => {
      const orderDate = new Date(order.date);
      return orderDate.toDateString() === selectedDate.toDateString();
    });
  }

  const now = new Date();
  return orders.filter((order) => {
    const orderDate = new Date(order.date);
    switch (period) {
      case "today":
        return orderDate.toDateString() === now.toDateString();
      case "tomorrow":
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return orderDate.toDateString() === tomorrow.toDateString();
      case "week":
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return orderDate >= weekStart && orderDate <= weekEnd;
      case "month":
        return (
          orderDate.getMonth() === now.getMonth() &&
          orderDate.getFullYear() === now.getFullYear()
        );
      case "lastMonth":
        const lastMonth = new Date(now);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        return (
          orderDate.getMonth() === lastMonth.getMonth() &&
          orderDate.getFullYear() === lastMonth.getFullYear()
        );
    }
  });
};

const columns: ColumnDef<Order>[] = [
  {
    accessorKey: "date",
    header: () => <div className="w-20 text-right">Datum</div>,
    cell: ({ row }) => (
      <div className="w-20 text-right">
        {new Date(row.original.date).toLocaleDateString()}
      </div>
    ),
  },
  {
    accessorKey: "id",
    header: "# ID",
  },
  {
    accessorKey: "user.full_name",
    header: "Odběratel",
  },
  {
    accessorKey: "total",
    header: () => <div className="text-right">Celkem</div>,
    cell: ({ row }) => (
      <div className="text-right">{row.original.total.toFixed(2)} Kč</div>
    ),
  },
  {
    accessorKey: "status",
    header: () => <div className="text-right">Status</div>,
    cell: ({ row }) => {
      const checkedCount =
        row.original.order_items?.filter((item) => item.checked).length || 0;
      const uncheckedCount =
        row.original.order_items?.filter((item) => !item.checked).length || 0;

      return (
        <div className="text-right flex justify-end gap-2 items-center">
          {checkedCount > 0 && (
            <Badge variant="outline" className="bg-green-400">
              {checkedCount}
            </Badge>
          )}
          {uncheckedCount > 0 && (
            <Badge variant="outline" className="bg-amber-400">
              {uncheckedCount}
            </Badge>
          )}
          <Badge variant="outline">{row.original.status}</Badge>
        </div>
      );
    },
  },
];

interface OrdersTableProps {
  selectedProductId?: string | null;
}

export function OrdersTable({ selectedProductId }: OrdersTableProps) {
  const { data: orders, error, isLoading } = fetchAllOrders();
  const [globalFilter, setGlobalFilter] = useState("");
  const [date, setDate] = useState<Date>();
  const setSelectedOrderId = useOrderStore((state) => state.setSelectedOrderId);

  const filteredOrders = useMemo(() => {
    let filtered = orders || [];

    // Filter by product if selected
    if (selectedProductId) {
      filtered = filtered.filter((order) =>
        order.order_items.some(
          (item) => item.product_id.toString() === selectedProductId
        )
      );
    }

    // Apply other existing filters
    if (date) {
      filtered = filterOrdersByDate(filtered, "today", date);
    }

    return filtered;
  }, [orders, selectedProductId, date]);

  if (isLoading) return <div>Loading orders...</div>;
  if (error) return <div>Error loading orders</div>;

  return (
    <Card className="my-0 p-4">
      <div className="space-y-4 overflow-x-auto">
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Input
              placeholder="Search orders..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="max-w-sm"
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <Badge variant="secondary">
            {date
              ? `${filterOrdersByDate(orders || [], "today", date).length} orders`
              : `${orders?.length || 0} total orders`}
          </Badge>
        </div>

        <Tabs
          defaultValue="today"
          className="w-full"
          onValueChange={() => setDate(undefined)}
        >
          <TabsList>
            {[
              { value: "today", label: "Today" },
              { value: "tomorrow", label: "Tomorrow" },
              { value: "week", label: "This Week" },
              { value: "month", label: "This Month" },
              { value: "lastMonth", label: "Last Month" },
            ].map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}{" "}
                <Badge variant="outline" className="ml-2">
                  {filterOrdersByDate(orders || [], tab.value as any).length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {["today", "tomorrow", "week", "month", "lastMonth"].map((period) => (
            <TabsContent key={period} value={period}>
              <OrderTableContent
                data={filterOrdersByDate(
                  filteredOrders || [],
                  period as
                    | "today"
                    | "tomorrow"
                    | "week"
                    | "month"
                    | "lastMonth",
                  date
                )}
                globalFilter={globalFilter}
                columns={columns}
                setSelectedOrderId={setSelectedOrderId}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </Card>
  );
}

// Updated OrderTableContent component
function OrderTableContent({
  data,
  globalFilter,
  columns,
  setSelectedOrderId,
}: {
  data: Order[];
  globalFilter: string;
  columns: ColumnDef<Order>[];
  setSelectedOrderId: (id: number) => void;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { globalFilter },
  });

  return (
    <>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={() => setSelectedOrderId(row.original.id)}
                className="cursor-pointer hover:bg-muted/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
                {/* <div className="flex mt-2 self-center gap-2">
                  <Badge variant="outline">{row.original.status}</Badge>
                </div> */}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </>
  );
}
