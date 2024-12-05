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
import { useState, useMemo } from "react";
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
              {checkedCount}
            </Badge>
          )}
          {uncheckedCount > 0 && (
            <Badge variant="outline" className="border-amber-700 bg-amber-400">
              {uncheckedCount}
            </Badge>
          )}
          {zeroQuantityCount > 0 && (
            <Badge variant="outline" className="border-red-700 bg-red-400">
              {zeroQuantityCount}
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

      const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent row click event

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

      return (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
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

// Add this new function near other print functions
const printProductSummary = (orders: Order[]) => {
  const productSummary = orders.reduce(
    (acc, order) => {
      order.order_items.forEach((item) => {
        if (!acc[item.product_id]) {
          acc[item.product_id] = {
            name: item.product.name,
            quantity: 0,
            total: 0,
          };
        }
        acc[item.product_id].quantity += item.quantity;
        acc[item.product_id].total += item.quantity * item.price;
      });
      return acc;
    },
    {} as Record<string, { name: string; quantity: number; total: number }>
  );

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>Product Summary</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #f5f5f5; }
          .total { font-weight: bold; }
          .print-date { text-align: right; color: #666; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h2>Souhrn produktů</h2>
        <table>
          <thead>
            <tr>
              <th>Produkt</th>
              <th style="text-align: right">Množství</th>
              
            </tr>
          </thead>
          <tbody>
            ${Object.values(productSummary)
              .filter((item) => item.quantity > 0)
              .sort((a, b) => b.quantity - a.quantity)
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
        <div class="print-date">Vytištěno: ${new Date().toLocaleString()}</div>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.print();
};

export function OrdersTable({
  selectedProductId: initialProductId,
}: OrdersTableProps) {
  const { data: orders, error, isLoading } = fetchAllOrders();
  const [globalFilter, setGlobalFilter] = useState("");
  const [date, setDate] = useState<Date>();
  const setSelectedOrderId = useOrderStore((state) => state.setSelectedOrderId);
  const [selectedProductId, setSelectedProductId] = useState(
    initialProductId || ""
  );
  const { data: products } = fetchActiveProducts();
  const [activeTab, setActiveTab] = useState("today");

  const filteredOrders = useMemo(() => {
    let filtered = orders || [];

    if (date) {
      filtered = filterOrdersByDate(filtered, "today", date);
    }

    if (selectedProductId && selectedProductId !== "all") {
      filtered = filtered.filter((order) =>
        order.order_items.some(
          (item: { product_id: number | string }) =>
            item.product_id.toString() === selectedProductId
        )
      );
    }

    return filtered;
  }, [orders, selectedProductId, date]);

  const getDateFilteredOrders = (
    orders: Order[],
    period: "today" | "tomorrow" | "week" | "month" | "lastMonth"
  ) => {
    return filterOrdersByDate(orders || [], period);
  };

  const calculateTotalQuantityForPeriod = (
    productId: string,
    period: "today" | "tomorrow" | "week" | "month" | "lastMonth"
  ) => {
    const dateFiltered = getDateFilteredOrders(orders || [], period);
    return dateFiltered.reduce((total, order) => {
      const quantity = order.order_items
        .filter((item) => item.product_id.toString() === productId)
        .reduce((sum, item) => sum + item.quantity, 0);
      return total + quantity;
    }, 0);
  };

  const printOrderTotals = (orders: Order[], period: string) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Objednávky - ${period}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 20px; 
            }
            .order-page {
              position: relative;
              padding: 20px;
              border-bottom: 1px dashed #ccc;
              margin-bottom: 20px;
              min-height: 90vh;
            }
            .order-page:last-child {
              border-bottom: none;
              margin-bottom: 0;
            }
            .order-content {
              padding-bottom: 120px; /* Space for crates info */
            }
            .order-header {
              display: flex;
              justify-content: space-between;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 1px solid #ddd;
            }
            .customer-info {
              font-size: 1.2em;
              font-weight: bold;
            }
            .order-meta {
              color: #666;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            .items-table th, .items-table td {
              padding: 8px;
              text-align: left;
              border-bottom: 1px solid #ddd;
            }
            .items-table th:first-child,
            .items-table td:first-child {
              text-align: left;
              width: 40%;
            }
            .items-table th:not(:first-child),
            .items-table td:not(:first-child) {
              text-align: right;
              width: 20%;
            }
            .crates-info {
              position: absolute;
              bottom: 20px;
              left: 20px;
              right: 20px;
              padding: 15px;
              background: #f5f5f5;
              border-radius: 4px;
              border-top: 2px solid #ddd;
            }
            .crate-section {
              display: flex;
              justify-content: space-between;
              margin: 5px 0;
            }
            .crate-group {
              flex: 1;
              padding: 0 20px;
            }
            .crate-group:first-child {
              border-right: 1px solid #ddd;
            }
            @media print {
              .order-page { 
                page-break-after: always;
              }
            }
          </style>
        </head>
        <body>
          ${orders
            .map(
              (order) => `
            <div class="order-page">
              <div class="order-content">
                <div class="order-header">
                  <div class="customer-info">
                    ${order.user.full_name}
                    <div class="status-badge">${order.status}</div>
                  </div>
                  <div class="order-meta">
                    <div>Objednávka #${order.id}</div>
                    <div>${new Date(order.date).toLocaleDateString()}</div>
                  </div>
                </div>

                <table class="items-table">
                  <thead>
                    <tr>
                      <th>Produkt</th>
                      <th>Množství</th>
                      <th>Cena</th>
                      <th>Celkem</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${order.order_items
                      .filter((item) => item.quantity > 0) // Filter out zero quantity items
                      .map(
                        (item) => `
                      <tr>
                        <td>${item.product.name}</td>
                        <td>${item.quantity}</td>
                        <td>${item.price} Kč</td>
                        <td>${item.quantity * item.price} Kč</td>
                      </tr>
                    `
                      )
                      .join("")}
                  </tbody>
                </table>

                <div style="text-align: right; margin-top: 20px;">
                  <strong>Celková cena: ${order.total} Kč</strong>
                </div>

                <div class="crates-info">
                  <div class="crate-section">
                    <div>
                      <strong>Vydané přepravky:</strong>
                      <span>Malé: ${order.crateSmall || 0}</span>
                      <span>Velké: ${order.crateBig || 0}</span>
                    </div>
                    <div>
                      <strong>Přijaté přepravky:</strong>
                      <span>Malé: ${order.crateSmallReceived || 0}</span>
                      <span>Velké: ${order.crateBigReceived || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `
            )
            .join("")}
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

  if (isLoading) return <div>Loading orders...</div>;
  if (error) return <div>Error loading orders</div>;

  return (
    <Card className="my-0 p-4 print:border-none print:shadow-none print:absolute print:top-0 print:left-0 print:right-0 print:m-0 print:h-auto print:overflow-visible  print:transform-none">
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
            <Badge variant="secondary">
              {date
                ? `${filteredOrders.length} orders`
                : `${filteredOrders.length} total orders`}
            </Badge>
          </div>

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
        </div>

        <Tabs
          defaultValue="today"
          className="w-full"
          onValueChange={(value) => {
            setDate(undefined);
            setActiveTab(value);
          }}
        >
          <TabsList className="print:hidden">
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

          {["today", "tomorrow", "week", "month", "lastMonth"].map((period) => {
            const filteredPeriodOrders = filterOrdersByDate(
              filteredOrders || [],
              period as "today" | "tomorrow" | "week" | "month" | "lastMonth",
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
                      <Container size={20} className="mx-1" /> ↓
                    </Badge>
                  </div>

                  <Select
                    onValueChange={(value) => {
                      switch (value) {
                        case "summary":
                          window.print();
                          break;
                        case "production":
                          printOrderTotalsByDate(filteredPeriodOrders);
                          break;
                        case "orders":
                          printOrderTotals(filteredPeriodOrders, period);
                          break;
                        case "products":
                          printProductSummary(filteredPeriodOrders);
                          break;
                      }
                    }}
                  >
                    <SelectTrigger className="w-[180px] print:hidden">
                      <Printer className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Tisk..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="summary">Tisk souhrnu</SelectItem>
                      <SelectItem value="production">Tisk výroby</SelectItem>
                      <SelectItem value="orders">Tisk objednávek</SelectItem>
                      <SelectItem value="products">Tisk produktů</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <OrderTableContent
                  data={filteredPeriodOrders}
                  globalFilter={globalFilter}
                  columns={columns}
                  setSelectedOrderId={setSelectedOrderId}
                />
              </TabsContent>
            );
          })}
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
    </>
  );
}
