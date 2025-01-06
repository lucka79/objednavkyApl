import ReactDOMServer from "react-dom/server";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
} from "@tanstack/react-table";
import { fetchAllOrders, useDeleteOrder } from "@/hooks/useOrders";
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
import { useState, useMemo, useEffect, useRef, forwardRef } from "react";
import { useOrderStore } from "@/providers/orderStore";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowDown,
  ArrowUp,
  CalendarIcon,
  Container,
  Printer,
  FileText,
  StickyNote,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchActiveProducts } from "@/hooks/useProducts";

import { Trash2 } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useDriverUsers } from "@/hooks/useProfiles";
import { useAuthStore } from "@/lib/supabase";
import { cs } from "date-fns/locale";

import { ProductSummaryPrint } from "./ProductSummaryPrint";
import { OrderPrint } from "./OrderPrint";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ProductPrintWrapper = forwardRef<HTMLDivElement, { orders: Order[] }>(
  ({ orders }, ref) => (
    <div ref={ref} className="p-8">
      <ProductSummaryPrint orders={orders} />
    </div>
  )
);

ProductPrintWrapper.displayName = "ProductPrintWrapper";

const filterOrdersByDate = (
  orders: Order[],
  period: "today" | "tomorrow" | "week" | "month" | "lastMonth" | "nextWeek",
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
      case "nextWeek":
        const nextWeekStart = new Date(now);
        nextWeekStart.setDate(
          nextWeekStart.getDate() - nextWeekStart.getDay() + 7
        );
        const nextWeekEnd = new Date(nextWeekStart);
        nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
        return orderDate >= nextWeekStart && orderDate <= nextWeekEnd;
    }
  });
};

const calculateCrateSums = (orders: Order[]) => {
  return orders.reduce(
    (sums, order) => ({
      crateSmall: sums.crateSmall + (order.crateSmall || 0),
      crateBig: sums.crateBig + (order.crateBig || 0),
      crateSmallReceived:
        sums.crateSmallReceived + (order.crateSmallReceived || 0),
      crateBigReceived: sums.crateBigReceived + (order.crateBigReceived || 0),
    }),
    { crateSmall: 0, crateBig: 0, crateSmallReceived: 0, crateBigReceived: 0 }
  );
};

const columns: ColumnDef<Order>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center gap-2">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-white"
        />
        {table.getFilteredSelectedRowModel().rows.length > 0 && (
          <Badge variant="secondary">
            {table.getFilteredSelectedRowModel().rows.length}
          </Badge>
        )}
      </div>
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
        className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-white"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "date",
    header: () => <div className="w-18 text-left">Datum</div>,
    cell: ({ row }) => (
      <div className="w-18 text-left">
        {new Date(row.original.date).toLocaleDateString()}
      </div>
    ),
  },
  {
    accessorKey: "id",
    header: "# ID",
  },
  {
    accessorKey: "crateSmall",
    header: () => <div className="w-12 text-right print:hidden"></div>,
    cell: ({ row }) => (
      <div className="flex items-center w-12 text-right print:hidden">
        <Badge variant="outline" className="text-yellow-700 ">
          {row.original.crateSmall}
          <Container size={16} className="ml-2" />
          <ArrowUp size={16} />
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: "crateBig",
    header: () => <div className="text-right print:hidden"></div>,
    cell: ({ row }) => (
      <div className="flex items-center justify-end w-12 text-right print:hidden">
        <Badge variant="outline" className="text-red-800 ">
          {row.original.crateBig}
          <Container size={20} className="ml-2" />
          <ArrowUp size={16} />
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: "user.full_name",
    header: "Odběratel",
  },
  {
    accessorKey: "paid_by",
    header: "Platba",
  },
  {
    accessorKey: "driver.full_name",
    header: "Řidič",
  },
  {
    accessorKey: "note",
    header: "Pozn.",
    cell: ({ row }) => (
      <div className="flex justify-center">
        {row.original.note && row.original.note !== "-" && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <StickyNote size={16} className="text-orange-500" />
              </TooltipTrigger>
              <TooltipContent className="bg-orange-500 text-white border-orange-500">
                <p>{row.original.note}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    ),
  },
  {
    accessorKey: "total",
    header: () => <div className="text-right">Celkem</div>,
    cell: ({ row }) => (
      <div className="text-right">{row.original.total.toFixed(2)} Kč</div>
    ),
  },
  {
    accessorKey: "crateSmallReceived",
    header: () => <div className="text-right print:hidden"></div>,
    cell: ({ row }) => (
      <div className="flex items-center justify-start w-12 text-right print:hidden">
        <Badge variant="outline" className="text-yellow-700 ">
          {row.original.crateSmallReceived}
          <Container size={16} className="mx-1" />
          <ArrowDown size={16} />
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: "crateBigReceived",
    header: () => <div className="text-right print:hidden"></div>,
    cell: ({ row }) => (
      <div className="flex items-center justify-end w-12 text-right print:hidden">
        <Badge variant="outline" className="flex flex-row gap-1 text-red-800 ">
          {row.original.crateBigReceived}
          <Container size={20} className="mx-1" />
          <ArrowDown size={16} />
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: () => <div className="text-right">Status</div>,
    cell: ({ row }) => {
      const allCount = row.original.order_items?.length || 0;
      row.original.order_items?.filter((item) => item.checked).length || 0;
      const checkedCount =
        row.original.order_items?.filter((item) => item.checked).length || 0;
      const uncheckedCount =
        row.original.order_items?.filter((item) => !item.checked).length || 0;
      const zeroQuantityCount =
        row.original.order_items?.filter((item) => item.quantity === 0)
          .length || 0;

      return (
        <div className="text-right flex justify-end gap-2 items-center">
          {checkedCount > 0 && (
            <Badge variant="outline" className="border-green-700 bg-green-400">
              {checkedCount} / {allCount}
            </Badge>
          )}
          {uncheckedCount > 0 && (
            <Badge variant="outline" className="border-amber-700 bg-amber-400">
              {uncheckedCount}
            </Badge>
          )}
          {zeroQuantityCount > 0 && (
            <Badge variant="outline" className="border-red-700 bg-red-400">
              {zeroQuantityCount} / {allCount}
              {/* <Flag size={14} /> */}
            </Badge>
          )}
          <Badge variant="outline">{row.original.status}</Badge>
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const order = row.original;
      const deleteOrder = useDeleteOrder();
      const { toast } = useToast();
      const user = useAuthStore((state) => state.user);

      const handleDelete = async () => {
        try {
          await deleteOrder.mutateAsync(order.id);
          toast({
            title: "Success",
            description: "Order deleted successfully",
          });
        } catch (error) {
          console.error("Failed to delete order:", error);
          toast({
            title: "Error",
            description: "Failed to delete order",
            variant: "destructive",
          });
        }
      };

      // Only show delete button for admin users
      if (user?.role !== "admin") return null;

      return (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Opravdu smazat objednávku?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tato akce je nevratná. Smaže se objednávka a všechny přiřazené
                  položky.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Zrušit</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-700 hover:bg-red-800"
                >
                  Smazat
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      );
    },
  },
];

interface OrdersTableProps {
  selectedProductId: string | null;
}

// Add this component for the print summary
function PrintSummary({
  orders,
  period,
  globalFilter,
}: {
  orders: Order[];
  period: string;
  globalFilter: string;
}) {
  // Filter orders based on globalFilter first
  const filteredOrders = orders.filter((order) => {
    if (!globalFilter) return true;
    const searchTerm = globalFilter.toLowerCase();

    // Search in order items
    const matchesProducts = order.order_items.some((item) =>
      item.product.name.toLowerCase().includes(searchTerm)
    );

    // Search in customer name
    const matchesCustomer = order.user.full_name
      ?.toLowerCase()
      .includes(searchTerm);

    return matchesProducts || matchesCustomer;
  });

  // Group items by product name and price
  const totals = filteredOrders.reduce(
    (acc, order) => {
      order.order_items.forEach((item) => {
        if (item.quantity > 0) {
          // Only consider items with quantity > 0
          const key = `${item.product.name}-${item.price}`;
          if (!acc[key]) {
            acc[key] = {
              name: item.product.name,
              price: item.price,
              quantity: 0,
              total: 0,
            };
          }
          acc[key].quantity += item.quantity;
          acc[key].total += item.quantity * item.price;
        }
      });
      return acc;
    },
    {} as Record<
      string,
      { name: string; price: number; quantity: number; total: number }
    >
  );

  // Convert to array and sort by name
  const sortedTotals = Object.values(totals).sort((a, b) =>
    a.name.localeCompare(b.name, "cs")
  );

  // Calculate grand total
  const totalAmount = sortedTotals.reduce((sum, item) => sum + item.total, 0);

  // Calculate crate totals (unchanged)
  const crateTotals = filteredOrders.reduce(
    (sums, order) => ({
      crateSmall: sums.crateSmall + (order.crateSmall || 0),
      crateBig: sums.crateBig + (order.crateBig || 0),
      crateSmallReceived:
        sums.crateSmallReceived + (order.crateSmallReceived || 0),
      crateBigReceived: sums.crateBigReceived + (order.crateBigReceived || 0),
    }),
    { crateSmall: 0, crateBig: 0, crateSmallReceived: 0, crateBigReceived: 0 }
  );

  return (
    <div className="hidden print:block mt-8 p-4">
      <h2 className="text-xl font-bold mb-4">Souhrn objednávek - {period}</h2>
      <table className="w-full mb-8">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Produkt</th>
            <th className="text-right py-2">Množství</th>
            <th className="text-right py-2">Cena</th>
            <th className="text-right py-2">Celkem</th>
          </tr>
        </thead>
        <tbody>
          {sortedTotals.map((item, index) => (
            <tr
              key={`${item.name}-${item.price}-${index}`}
              className="border-b"
            >
              <td className="py-2">{item.name}</td>
              <td className="text-right py-2">{item.quantity}</td>
              <td className="text-right py-2">{item.price} Kč</td>
              <td className="text-right py-2">{item.total.toFixed(2)} Kč</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td colSpan={3} className="py-2 text-right">
              Celková suma:
            </td>
            <td className="text-right py-2">{totalAmount.toFixed(2)} Kč</td>
          </tr>
        </tbody>
      </table>

      {/* Crates Summary (unchanged) */}
      <div className="mt-4 border-t pt-4">
        <h3 className="font-bold mb-2">Přepravky:</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p>Vydané přepravky:</p>
            <p>Malé: {crateTotals.crateSmall}</p>
            <p>Velké: {crateTotals.crateBig}</p>
          </div>
          <div>
            <p>Vrácené přepravky:</p>
            <p>Malé: {crateTotals.crateSmallReceived}</p>
            <p>Velké: {crateTotals.crateBigReceived}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// 1. Create print function
const printProductSummary = (orders: Order[]) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>Product Summary 2</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div id="print-content">
          ${ReactDOMServer.renderToString(<ProductSummaryPrint orders={orders} />)}
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.print();
};

export function OrdersTable({
  selectedProductId: initialProductId,
}: OrdersTableProps) {
  const [selectedOrders] = useState<Order[]>([]);

  const { data: orders, error, isLoading } = fetchAllOrders();
  const [globalFilter, setGlobalFilter] = useState("");
  const [date, setDate] = useState<Date>();
  const setSelectedOrderId = useOrderStore((state) => state.setSelectedOrderId);
  const [selectedProductId, setSelectedProductId] = useState(
    initialProductId || ""
  );
  const { data: products } = fetchActiveProducts();
  const [activeTab, setActiveTab] = useState("today");
  const [selectedPaidBy, setSelectedPaidBy] = useState<string>("all");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedDriver, setSelectedDriver] = useState<string>("all");
  const { data: driverUsers } = useDriverUsers();
  const [table, setTable] = useState<any>(null);

  // Get unique paid_by values from orders
  const uniquePaidByValues = useMemo(() => {
    if (!orders) return [];
    const values = new Set(
      orders.map((order) => order.paid_by).filter(Boolean)
    );
    return Array.from(values).sort();
  }, [orders]);

  // Get unique roles from orders
  const uniqueRoles = useMemo(() => {
    if (!orders) return [];
    const roles = new Set(
      orders.map((order) => order.user?.role).filter(Boolean)
    );
    return Array.from(roles).sort();
  }, [orders]);

  // Update filteredOrders to include role filtering
  const filteredOrders = useMemo(() => {
    let filtered = orders || [];

    if (date) {
      filtered = filterOrdersByDate(filtered, "today", date);
    }

    if (selectedProductId && selectedProductId !== "all") {
      filtered = filtered.filter((order) =>
        order.order_items.some(
          (item: { product_id: number }) =>
            item.product_id.toString() === selectedProductId
        )
      );
    }

    if (selectedPaidBy !== "all") {
      filtered = filtered.filter((order) => order.paid_by === selectedPaidBy);
    }

    // Add role filtering
    if (selectedRole !== "all") {
      filtered = filtered.filter((order) => order.user?.role === selectedRole);
    }

    // Add driver filtering
    if (selectedDriver !== "all") {
      filtered = filtered.filter((order) =>
        selectedDriver === "none"
          ? !order.driver_id
          : order.driver_id === selectedDriver
      );
    }

    return filtered;
  }, [
    orders,
    selectedProductId,
    date,
    selectedPaidBy,
    selectedRole,
    selectedDriver,
  ]);

  const getDateFilteredOrders = (
    orders: Order[],
    period: "today" | "tomorrow" | "week" | "nextWeek" | "month" | "lastMonth"
  ) => {
    return filterOrdersByDate(orders || [], period);
  };

  const calculateTotalQuantityForPeriod = (
    productId: string,
    period: "today" | "tomorrow" | "week" | "nextWeek" | "month" | "lastMonth"
  ) => {
    const dateFiltered = getDateFilteredOrders(orders || [], period);
    return dateFiltered.reduce((total, order) => {
      const quantity = order.order_items
        .filter((item) => item.product_id.toString() === productId)
        .reduce((sum, item) => sum + item.quantity, 0);
      return total + quantity;
    }, 0);
  };

  const printOrderTotals = (orders: Order[]) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Objednávky</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          </style>
        </head>
        <body>
          <div id="print-content">
            ${ReactDOMServer.renderToString(<OrderPrint orders={orders} />)}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  // Modify the calculateOrderTotalsByDate function
  const calculateOrderTotalsByDate = (orders: Order[]) => {
    const totalsByDate = new Map<
      string,
      Map<string, { name: string; quantity: number; categoryId: number }>
    >();

    orders.forEach((order) => {
      const date = new Date(order.date).toLocaleDateString();
      if (!totalsByDate.has(date)) {
        totalsByDate.set(date, new Map());
      }

      const dateMap = totalsByDate.get(date)!;
      order.order_items.forEach((item) => {
        const product = products?.find((p) => p.id === item.product_id);
        const current = dateMap.get(item.product_id.toString()) || {
          name: product?.name || "Unknown",
          quantity: 0,
          categoryId: product?.category_id || 0,
        };
        dateMap.set(item.product_id.toString(), {
          ...current,
          quantity: current.quantity + item.quantity,
        });
      });
    });

    return totalsByDate;
  };

  // Update the printOrderTotalsByDate function
  const printOrderTotalsByDate = (orders: Order[]) => {
    const totalsByDate = calculateOrderTotalsByDate(orders);
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Výroba podle dnů</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 18px; margin-bottom: 10px; }
            h2 { font-size: 16px; color: #666; margin: 30px 0 10px 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f5f5f5; }
            td:last-child { text-align: right; }
            .date { margin-bottom: 20px; color: #666; }
            .print-date { text-align: right; color: #666; margin-bottom: 20px; }
          </style>
        </head>
        <body>        
          ${Array.from(totalsByDate.entries())
            .map(
              ([date, products]) => `
            <h1>Datum výroby: ${date}</h1>
            <table>
              <thead>
                <tr>
                  <th>Produkt by categoryId</th>
                  <th style="text-align: right">Množství</th>
                </tr>
              </thead>
              <tbody>
                ${Array.from(products.values())
                  .filter((item) => item.quantity > 0) // Filter out zero quantity items
                  .sort(
                    (a, b) =>
                      a.categoryId - b.categoryId ||
                      a.name.localeCompare(b.name)
                  )
                  .map(
                    (item) => `
                    <tr>
                      <td>${item.name}</td>
                      <td style="text-align: right">${item.quantity}</td>
                    </tr>
                  `
                  )
                  .join("")}
              </tbody>
            </table>
          `
            )
            .join("")}
            <div class="print-date">Vytištěno: ${new Date().toLocaleString()}</div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  // 1. Add print state
  const [isPrinting] = useState(false);
  const productPrintRef = useRef<HTMLDivElement>(null);

  // 2. Update print handler
  // const handleProductPrint = useReactToPrint({
  //   content: () => productPrintRef.current,
  //   onAfterPrint: () => setIsPrinting(false),
  // });

  if (isLoading) return <div>Loading orders...</div>;
  if (error) return <div>Error loading orders</div>;

  return (
    <>
      <Card className="my-0 p-4 print:border-none print:shadow-none print:absolute print:top-0 print:left-0 print:right-0 print:m-0 print:h-auto print:overflow-visible print:transform-none">
        <div className="space-y-4 overflow-x-auto print:!m-0">
          <div className="space-y-2 print:hidden">
            <div className="flex justify-between items-center gap-2">
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
                    {date ? format(date, "PPP") : <span>Vyberte datum</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    locale={cs}
                  />
                </PopoverContent>
              </Popover>
              <Badge variant="secondary">
                {date
                  ? `${filteredOrders.length} orders`
                  : `${filteredOrders.length} total orders`}
              </Badge>
            </div>
            <div className="flex flex-row gap-2">
              <Select
                value={selectedProductId}
                onValueChange={setSelectedProductId}
              >
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue placeholder="Filter by product..." />
                  {/* {selectedProductId && selectedProductId !== "all" && (
                  // <Badge variant="secondary" className="ml-2">
                  //   {filteredOrders.length} obj. (
                  //   {calculateTotalQuantityForPeriod(
                  //     selectedProductId,
                  //     activeTab as
                  //       | "today"
                  //       | "tomorrow"
                  //       | "week"
                  //       | "month"
                  //       | "lastMonth"
                  //   )}
                  //   ks)
                  // </Badge>
                )} */}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {products?.map((product) => (
                    <SelectItem key={product.id} value={product.id.toString()}>
                      <div className="flex justify-between items-center w-full">
                        <span className="mr-2">{product.name}</span>
                        <div className="flex gap-2">
                          {" "}
                          <Badge variant="outline" className="border-green-500">
                            {calculateTotalQuantityForPeriod(
                              product.id.toString(),
                              activeTab as
                                | "today"
                                | "tomorrow"
                                | "week"
                                | "nextWeek"
                                | "month"
                                | "lastMonth"
                            )}{" "}
                            ks
                          </Badge>
                          <Badge variant="outline" className="border-amber-500">
                            {
                              getDateFilteredOrders(
                                orders || [],
                                activeTab as
                                  | "today"
                                  | "tomorrow"
                                  | "week"
                                  | "nextWeek"
                                  | "month"
                                  | "lastMonth"
                              ).filter((order) =>
                                order.order_items.some(
                                  (item: { product_id: number | string }) =>
                                    item.product_id.toString() ===
                                    product.id.toString()
                                )
                              ).length
                            }{" "}
                            objed.
                          </Badge>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedPaidBy} onValueChange={setSelectedPaidBy}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Typ platby..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Typ platby</SelectItem>
                  {uniquePaidByValues.map((paidBy) => (
                    <SelectItem key={paidBy} value={paidBy}>
                      {paidBy}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Typ odběratele..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Typ odběratele</SelectItem>
                  {uniqueRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrovat řidiče..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všichni řidiči</SelectItem>
                  <SelectItem value="none">Bez řidiče</SelectItem>
                  {driverUsers?.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs
            defaultValue="tomorrow"
            className="w-full"
            onValueChange={(value) => {
              setDate(undefined);
              setActiveTab(value);
            }}
          >
            <TabsList className="print:hidden">
              {[
                { value: "tomorrow", label: "Zítra" },
                { value: "today", label: "Dnes" },
                { value: "week", label: "Tento týden" },
                { value: "nextWeek", label: "Příští týden" },
                { value: "month", label: "Tento měsíc" },
                { value: "lastMonth", label: "Minulý měsíc" },
              ].map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}{" "}
                  <Badge variant="outline" className="ml-2">
                    {filterOrdersByDate(orders || [], tab.value as any).length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {[
              "today",
              "tomorrow",
              "week",
              "nextWeek",
              "month",
              "lastMonth",
            ].map((period) => {
              const filteredPeriodOrders = filterOrdersByDate(
                filteredOrders || [],
                period as
                  | "today"
                  | "tomorrow"
                  | "week"
                  | "nextWeek"
                  | "month"
                  | "lastMonth",
                date
              );
              const crateSums = calculateCrateSums(filteredPeriodOrders);

              return (
                <TabsContent key={period} value={period}>
                  <PrintSummary
                    orders={filteredPeriodOrders}
                    period={period}
                    globalFilter={globalFilter}
                  />

                  <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-2 print:hidden">
                      <span className="text-muted-foreground text-sm font-semibold">
                        Vydáno celkem:
                      </span>
                      <Badge variant="outline" className="text-yellow-700 ">
                        {crateSums.crateSmall}
                        <Container size={16} className="mx-1" /> ↑
                      </Badge>
                      <Badge variant="outline" className="text-red-800">
                        {crateSums.crateBig}
                        <Container size={20} className="mx-1" /> ↑
                      </Badge>
                      <span className="text-muted-foreground text-sm font-semibold">
                        Přijato celkem:
                      </span>
                      <Badge variant="secondary" className="text-yellow-700">
                        {crateSums.crateSmallReceived}
                        <Container size={16} className="mx-1" /> ↓
                      </Badge>
                      <Badge variant="secondary" className="text-red-800">
                        {crateSums.crateBigReceived}
                        <Container size={20} className="mx-1" /> ↑
                      </Badge>
                    </div>

                    <div className="flex gap-2">
                      <Select
                        onValueChange={(value) => {
                          const selectedOrders =
                            table.getFilteredSelectedRowModel().rows.length > 0
                              ? table
                                  .getFilteredSelectedRowModel()
                                  .rows.map(
                                    (row: { original: Order }) => row.original
                                  )
                              : filteredPeriodOrders;

                          switch (value) {
                            case "summary":
                              window.print();
                              break;
                            case "production":
                              printOrderTotalsByDate(selectedOrders);
                              break;
                            case "orders":
                              printOrderTotals(selectedOrders);
                              break;
                            case "products":
                              printProductSummary(selectedOrders);
                              break;
                          }
                        }}
                      >
                        <SelectTrigger className="w-[180px] print:hidden">
                          <Printer className="mr-2 h-4 w-4" />
                          <SelectValue placeholder="Tisk..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tisk</SelectItem>
                          <SelectItem value="summary">Tisk souhrnu</SelectItem>
                          <SelectItem value="production">
                            Tisk výroby
                          </SelectItem>
                          <SelectItem value="orders">
                            Tisk objednávek
                          </SelectItem>
                          <SelectItem value="products">
                            Tisk produktů
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const orders =
                            table.getFilteredSelectedRowModel().rows.length > 0
                              ? table
                                  .getFilteredSelectedRowModel()
                                  .rows.map(
                                    (row: { original: Order }) => row.original
                                  )
                              : filteredPeriodOrders;
                          printOrderTotals(orders);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Tisk objednávek
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const orders =
                            table.getFilteredSelectedRowModel().rows.length > 0
                              ? table
                                  .getFilteredSelectedRowModel()
                                  .rows.map(
                                    (row: { original: Order }) => row.original
                                  )
                              : filteredPeriodOrders;
                          printProductSummary(orders);
                        }}
                      >
                        <Printer className="h-4 w-4 mr-2" />
                        Tisk produktů
                      </Button>
                    </div>
                  </div>

                  <OrderTableContent
                    data={filteredPeriodOrders}
                    globalFilter={globalFilter}
                    columns={columns}
                    setSelectedOrderId={setSelectedOrderId}
                    onTableReady={(t) => setTable(t)}
                  />
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </Card>

      {isPrinting && (
        <div style={{ position: "fixed", top: "-9999px", left: "-9999px" }}>
          <ProductPrintWrapper ref={productPrintRef} orders={selectedOrders} />
        </div>
      )}
    </>
  );
}

// Updated OrderTableContent component
function OrderTableContent({
  data,
  globalFilter,
  columns,
  setSelectedOrderId,
  onTableReady,
}: {
  data: Order[];
  globalFilter: string;
  columns: ColumnDef<Order>[];
  setSelectedOrderId: (id: number) => void;
  onTableReady: (table: any) => void;
}) {
  const [rowSelection, setRowSelection] = useState({});

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter,
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
  });

  useEffect(() => {
    onTableReady(table);
  }, [table, onTableReady]);

  return (
    <div className="border rounded-md">
      <div className="max-h-[800px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
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
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
