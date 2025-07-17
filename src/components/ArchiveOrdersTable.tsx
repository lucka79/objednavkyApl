import ReactDOMServer from "react-dom/server";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
} from "@tanstack/react-table";
import { useDeleteOrder, fetchOrdersForPrinting } from "@/hooks/useOrders";
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

import { Card } from "./ui/card";
import { Badge } from "./ui/badge";

import {
  Container,
  Printer,
  FileText,
  StickyNote,
  Lock,
  Unlock,
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
// import { fetchActiveProducts } from "@/hooks/useProducts";

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
import { OrdersTableSummary } from "./OrdersTablePrintSummary";
import { useOrderLockStore } from "@/providers/orderLockStore";
import { PrintDonutSummary } from "./PrintDonutSummary";
import { PrintSweetSummary } from "./PrintSweetSummary";

import { useVirtualizer } from "@tanstack/react-virtual";
import { PrintReportBuyerOrders } from "./PrintReportBuyerOrders";
import { PrintReportProducts } from "./PrintReportProducts";
import { PrintReportBuyersSummary } from "./PrintReportBuyersSummary";
import { PrintCategoryBagets } from "./PrintCategoryBagets";

import { useOrdersByMonth } from "@/hooks/useOrders";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

import { useOrderStore } from "@/providers/orderStore";
import { PrintReportDaily } from "./PrintReportDaily";

const ProductPrintWrapper = forwardRef<HTMLDivElement, { orders: Order[] }>(
  ({ orders }, ref) => (
    <div ref={ref} className="p-8">
      <ProductSummaryPrint orders={orders} />
    </div>
  )
);

ProductPrintWrapper.displayName = "ProductPrintWrapper";

// const filterOrdersByDate = (orders: Order[], selectedDate?: Date) => {
//   if (!selectedDate) return orders;

//   const monthStart = new Date(
//     selectedDate.getFullYear(),
//     selectedDate.getMonth(),
//     1
//   );
//   const monthEnd = new Date(
//     selectedDate.getFullYear(),
//     selectedDate.getMonth() + 1,
//     0
//   );

//   return orders.filter((order) => {
//     const orderDate = new Date(order.date);
//     return orderDate >= monthStart && orderDate <= monthEnd;
//   });
// };

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

const roleTranslations: Record<string, string> = {
  admin: "Administrátor",
  user: "Uživatel",
  driver: "Řidič (vzorky)",
  mobil: "Mobil",
  expedition: "Expedice",
  store: "APLICA prodejny",
  buyer: "Odběratel",
  all: "Všichni odběratelé",
};

const columns: ColumnDef<Order>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center gap-2 w-[40px]">
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
      <div className="w-[40px]">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
          className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-white"
        />
      </div>
    ),
  },
  {
    accessorKey: "date",
    header: () => <div className=""></div>,
    cell: ({ row }) => (
      <div className="w-[80px]">
        {new Date(row.original.date).toLocaleDateString()}
      </div>
    ),
  },
  {
    accessorKey: "id",
    header: () => <div className=""></div>,
    cell: ({ row }) => <div className="w-[60px]">{row.original.id}</div>,
  },
  {
    accessorKey: "crateSmall",
    header: () => <div className="print:hidden"></div>,
    cell: ({ row }) => (
      <div className="flex items-center w-[50px] text-right print:hidden">
        <Badge variant="outline" className="text-yellow-700 ml-auto">
          {row.original.crateSmall}
          <Container size={16} className="ml-2" />
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: "crateBig",
    header: () => <div className="print:hidden"></div>,
    cell: ({ row }) => (
      <div className="flex items-center w-[50px] justify-end print:hidden">
        <Badge variant="outline" className="text-red-800">
          {row.original.crateBig}
          <Container size={20} className="ml-2" />
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: "user.full_name",
    header: () => <div className=""></div>,
    cell: ({ row }) => (
      <div className="w-[180px]">{row.original.user.full_name}</div>
    ),
  },
  {
    accessorKey: "paid_by",
    header: () => <div className=""></div>,
    cell: ({ row }) => <div className="w-[60px]">{row.original.paid_by}</div>,
  },
  {
    accessorKey: "driver.full_name",
    header: () => <div className=""></div>,
    cell: ({ row }) => (
      <div className="w-[80px]">{row.original.driver?.full_name || "-"}</div>
    ),
  },
  {
    accessorKey: "note",
    header: () => <div className=""></div>,
    cell: ({ row }) => (
      <div className="flex justify-center w-[40px]">
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
    header: () => {
      const { user: authUser } = useAuthStore();
      return authUser?.role === "admin" ? <div className=""></div> : null;
    },
    cell: ({ row }) => {
      const { user: authUser } = useAuthStore();
      return authUser?.role === "admin" ? (
        <div className="w-[80px] text-right">
          {row.original.total.toFixed(2)} Kč
        </div>
      ) : null;
    },
  },
  {
    accessorKey: "crateSmallReceived",
    header: () => <div className="print:hidden"></div>,
    cell: ({ row }) => (
      <div className="flex items-center w-[50px] text-right print:hidden">
        <Badge variant="outline" className="text-yellow-700 ml-auto">
          {row.original.crateSmallReceived}
          <Container size={16} className="mx-1" />
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: "crateBigReceived",
    header: () => <div className="print:hidden"></div>,
    cell: ({ row }) => (
      <div className="flex items-center w-[50px] justify-end print:hidden">
        <Badge variant="outline" className="text-red-800">
          {row.original.crateBigReceived}
          <Container size={20} className="mx-1" />
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: () => <div className=""></div>,
    cell: ({ row }) => {
      const order = row.original;

      // const checkedItems =
      //   order.order_items?.filter((item) => item.checked).length || 0;
      // const totalItems = order.order_items?.length || 0;

      return (
        <div className="w-[220px] text-right flex justify-end gap-2 items-center">
          {/* {totalItems > 0 && (
            <>
              <Badge variant="outline" className="border-green-500 w-[50px]">
                {checkedItems}/{totalItems}
              </Badge>
            </>
          )} */}
          <Badge
            variant="outline"
            className={cn(
              "w-[80px] text-center",
              order.status === "Expedice R"
                ? "bg-orange-600 text-white"
                : order.status === "Expedice O"
                  ? "bg-orange-800 text-white"
                  : order.status === "Přeprava"
                    ? "bg-sky-600 text-white"
                    : ""
            )}
          >
            {order.status}
          </Badge>
        </div>
      );
    },
  },
  {
    id: "actions",
    header: () => <div className="w-[60px]"></div>,
    cell: ({ row }) => {
      const order = row.original;
      const deleteOrder = useDeleteOrder();
      const { toast } = useToast();
      const { user: authUser } = useAuthStore();
      const { unlockOrder, lockOrder, isOrderUnlocked } = useOrderLockStore();
      const canUnlock = authUser?.role === "admin";

      const toggleLock = () => {
        if (!canUnlock) return;
        const isUnlocked = isOrderUnlocked(order.id);
        if (isUnlocked) {
          lockOrder(order.id);
        } else {
          unlockOrder(order.id);
        }
        toast({
          title: isUnlocked ? "Order locked" : "Order unlocked",
          description: isUnlocked
            ? "The order has been locked"
            : "The order is now unlocked. You can make changes.",
          variant: isUnlocked ? "default" : "destructive",
        });
      };

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

      return (
        <div className="w-[60px] flex justify-end gap-2">
          {canUnlock && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLock}
              className={
                order.isLocked ? "text-muted-foreground" : "text-red-600"
              }
            >
              {order.isLocked ? (
                <Lock className="h-4 w-4" />
              ) : (
                <Unlock className="h-4 w-4" />
              )}
            </Button>
          )}
          {authUser?.role === "admin" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  disabled={order.isLocked}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Opravdu smazat objednávku?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Tato akce je nevratná. Smaže se objednávka a všechny
                    přiřazené položky.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
                    Zrušit
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete();
                    }}
                    className="bg-red-700 hover:bg-red-800"
                  >
                    Smazat
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      );
    },
  },
];

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
  const { user: authUser } = useAuthStore();
  const isAdmin = authUser?.role === "admin";

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

      {/* Product Summary Table */}
      <table className="w-full mb-8">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Produkt</th>
            <th className="text-right py-2">Množství</th>
            {isAdmin && (
              <>
                <th className="text-right py-2">Cena</th>
                <th className="text-right py-2">Celkem</th>
              </>
            )}
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
              {isAdmin && (
                <>
                  <td className="text-right py-2">
                    {item.price.toFixed(2)} Kč
                  </td>
                  <td className="text-right py-2">
                    {item.total.toFixed(2)} Kč
                  </td>
                </>
              )}
            </tr>
          ))}
          {isAdmin && (
            <tr className="font-bold">
              <td colSpan={2} className="py-2 text-right">
                Celková suma:
              </td>
              <td colSpan={2} className="text-right py-2">
                {totalAmount.toFixed(2)} Kč
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Detailed Orders Table */}
      <h3 className="text-lg font-bold mb-4">Seznam objednávek</h3>
      <table className="w-full mb-8">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Datum</th>
            <th className="text-left py-2">ID</th>
            <th className="text-left py-2">Odběratel</th>
            {isAdmin && <th className="text-right py-2">Celkem</th>}
          </tr>
        </thead>
        <tbody>
          {filteredOrders
            .sort(
              (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            )
            .map((order) => (
              <tr key={order.id} className="border-b">
                <td className="py-2">
                  {new Date(order.date).toLocaleDateString()}
                </td>
                <td className="py-2">{order.id}</td>
                <td className="py-2">{order.user.full_name}</td>
                {isAdmin && (
                  <td className="text-right py-2">
                    {order.total.toFixed(2)} Kč
                  </td>
                )}
              </tr>
            ))}
        </tbody>
      </table>

      {/* Crates Summary */}
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

      <div className="text-right text-sm text-gray-500 mt-4">
        Vytištěno: {new Date().toLocaleString()}
      </div>
    </div>
  );
}

// 1. Create print function
const printProductSummary = async (orders: Order[]) => {
  try {
    const orderIds = orders.map((order) => order.id);
    const completeOrders = await fetchOrdersForPrinting(orderIds);

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
        <head>
          <title>Výroba pekaři</title>
          <style>
            @page { size: A4; }
            body { font-family: Arial, sans-serif; padding: 10px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          </style>
        </head>
          <body>
            ${ReactDOMServer.renderToString(<ProductSummaryPrint orders={completeOrders} />)}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  } catch (error) {
    console.error("Error printing bakery products:", error);
  }
};

const printCategoryBagets = async (orders: Order[]) => {
  try {
    const orderIds = orders.map((order) => order.id);
    const completeOrders = await fetchOrdersForPrinting(orderIds);

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Výroba baget</title>
          <style>
            @page { size: A4; }
            body { font-family: Arial, sans-serif; padding: 10px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          </style>
          </head>
          <body>
            ${ReactDOMServer.renderToString(<PrintCategoryBagets orders={completeOrders} />)}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  } catch (error) {
    console.error("Error printing bagets:", error);
  }
};

const printCategoryDonuts = async (orders: Order[]) => {
  try {
    const orderIds = orders.map((order) => order.id);
    const completeOrders = await fetchOrdersForPrinting(orderIds);

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
        <head>
          <title>Výroba koblih</title>
          <style>
            @page { size: A4; }
            body { font-family: Arial, sans-serif; padding: 10px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          </style>
        </head>
          <body>
            ${ReactDOMServer.renderToString(<PrintDonutSummary orders={completeOrders} />)}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  } catch (error) {
    console.error("Error printing donuts:", error);
  }
};

const printCategorySweets = async (orders: Order[]) => {
  try {
    const orderIds = orders.map((order) => order.id);
    const completeOrders = await fetchOrdersForPrinting(orderIds);

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
        <head>
          <title>Výroba dortů a čajových výrobků</title>
          <style>
            @page { size: A4; }
            body { font-family: Arial, sans-serif; padding: 10px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          </style>
        </head>
          <body>
            ${ReactDOMServer.renderToString(<PrintSweetSummary orders={completeOrders} />)}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  } catch (error) {
    console.error("Error printing sweets:", error);
  }
};

const printReportBuyerOrders = (orders: Order[]) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>Tisk reportu objednávek</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div id="print-content">
          ${ReactDOMServer.renderToString(<PrintReportBuyerOrders orders={orders} />)}
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.print();
};

const printReportProducts = (orders: Order[]) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>Tisk reportu výrobků</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div id="print-content">
          ${ReactDOMServer.renderToString(<PrintReportProducts orders={orders} />)}
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.print();
};

const printReportBuyersSummary = (orders: Order[]) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>Tisk reportu odběratelů</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div id="print-content">
          ${ReactDOMServer.renderToString(<PrintReportBuyersSummary orders={orders} />)}
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.print();
};

const printOrderTotals = async (orders: Order[]) => {
  try {
    // Get the IDs of orders to print
    const orderIds = orders.map((order) => order.id);

    // Fetch complete order data for printing
    const completeOrders = await fetchOrdersForPrinting(orderIds);

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Objednávky</title>
          <style>
            @page { size: A4; }
            body { font-family: Arial, sans-serif; padding: 10px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          </style>
        </head>
        <body>
          <div id="print-content">
            ${ReactDOMServer.renderToString(<OrderPrint orders={completeOrders} />)}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  } catch (error) {
    console.error("Error preparing print data:", error);
    // You might want to show a toast or other error notification here
  }
};

const printReportDaily = (orders: Order[]) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>Denní přehled objednávek</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div id="print-content">
          ${ReactDOMServer.renderToString(<PrintReportDaily orders={orders} />)}
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.print();
};

// Add this helper function at the top level
// const getMonthName = (monthOffset: number) => {
//   const date = new Date();
//   date.setMonth(date.getMonth() + monthOffset);
//   return format(date, "LLLL yyyy", { locale: cs });
// };

export function ArchiveOrdersTable() {
  const [date, setDate] = useState<Date>(new Date());
  const [isSpecificDay, setIsSpecificDay] = useState(false);
  const {
    data: orders,
    error,
    isLoading,
  } = useOrdersByMonth(date, isSpecificDay);
  const [globalFilter, setGlobalFilter] = useState("");

  const [selectedPaidBy, setSelectedPaidBy] = useState<string>("all");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedDriver, setSelectedDriver] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const { data: driverUsers } = useDriverUsers();
  const [table, setTable] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState("all");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedOZ, setSelectedOZ] = useState<string>("all");
  const setSelectedOrderId = useOrderStore((state) => state.setSelectedOrderId);
  const [selectedReport, setSelectedReport] = useState<string>("");

  // Get unique paid_by values from orders
  const uniquePaidByValues = useMemo(() => {
    if (!orders) return [];
    const values = new Set(
      orders.map((order) => order.paid_by).filter(Boolean)
    );
    return Array.from(values).sort();
  }, [orders]);

  const uniqueStatusValues = useMemo(() => {
    if (!orders) return [];
    const values = new Set(orders.map((order) => order.status).filter(Boolean));
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

  // Get unique user names from orders
  const uniqueUserNames = useMemo(() => {
    if (!orders) return [];
    const names = new Set(
      orders.map((order) => order.user.full_name).filter(Boolean)
    );
    return Array.from(names).sort();
  }, [orders]);

  const filteredUserNames = useMemo(() => {
    if (!userSearchQuery) return uniqueUserNames;
    return uniqueUserNames.filter((name) =>
      name.toLowerCase().includes(userSearchQuery.toLowerCase())
    );
  }, [uniqueUserNames, userSearchQuery]);

  // Update filteredOrders to include role filtering
  const filteredOrders = useMemo(() => {
    let filtered = orders || [];

    if (selectedPaidBy !== "all") {
      filtered = filtered.filter((order) => order.paid_by === selectedPaidBy);
    }

    if (selectedStatus !== "all") {
      filtered = filtered.filter((order) => order.status === selectedStatus);
    }

    // Add role filtering
    if (selectedRole !== "all") {
      filtered = filtered.filter((order) => order.user?.role === selectedRole);
    }

    // Fix driver filtering
    if (selectedDriver !== "all") {
      filtered = filtered.filter((order) => {
        if (selectedDriver === "none") {
          return !order.driver_id;
        }
        return order.driver_id === selectedDriver;
      });
    }

    if (selectedUser !== "all") {
      filtered = filtered.filter(
        (order) => order.user.full_name === selectedUser
      );
    }

    // Update OZ filter to include "no OZ" option
    if (selectedOZ === "oz") {
      filtered = filtered.filter((order) => order.user?.oz === true);
    } else if (selectedOZ === "mo_partners") {
      filtered = filtered.filter((order) => order.user?.mo_partners === true);
    } else if (selectedOZ === "no_oz") {
      filtered = filtered.filter((order) => order.user?.oz === false);
    }

    return filtered;
  }, [
    orders,
    selectedPaidBy,
    selectedRole,
    selectedDriver,
    selectedStatus,
    selectedUser,
    selectedOZ,
  ]);

  // Add calendar component
  const handleDateSelect = (newDate: Date | undefined) => {
    if (newDate) {
      setDate(newDate);
      setIsSpecificDay(true);
    }
  };

  const handleMonthSelect = (newDate: Date) => {
    setDate(newDate);
    setIsSpecificDay(false);
  };

  const { user: authUser } = useAuthStore();

  if (isLoading) return <div>Loading orders...</div>;
  if (error) return <div>Error loading orders</div>;

  return (
    <>
      <Card className="my-0 p-4 print:border-none print:shadow-none print:absolute print:top-0 print:left-0 print:right-0 print:m-0 print:h-auto print:overflow-visible print:transform-none">
        <div className="space-y-4 overflow-x-auto print:!m-0">
          <div className="space-y-2 print:hidden">
            <div className="flex justify-start items-center gap-2">
              <Input
                placeholder="Search orders..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="max-w-sm"
              />

              <Select
                value={selectedUser}
                onValueChange={setSelectedUser}
                onOpenChange={() => setUserSearchQuery("")}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Odběratel..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="sticky top-0 z-50 bg-white p-2">
                    <Input
                      placeholder="Hledat odběratele..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="border-orange-600 hover:border-orange-600 focus-visible:ring-orange-600 w-full"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  <SelectItem value="all">Všichni odběratelé</SelectItem>
                  {filteredUserNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedOZ} onValueChange={setSelectedOZ}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Obchodní zástupce..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všichni</SelectItem>
                  <SelectItem value="oz">Obchodní zástupce</SelectItem>
                  <SelectItem value="mo_partners">Mo Partners</SelectItem>
                  <SelectItem value="no_oz">Bez Obchod.zástupce</SelectItem>
                </SelectContent>
              </Select>

              <Badge
                variant="secondary"
                className="flex items-center gap-2 ml-auto"
              >
                {date
                  ? `${filteredOrders.length} orders`
                  : `${filteredOrders.length} total orders`}
              </Badge>
            </div>
            <div className="flex flex-row gap-2">
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
                      {roleTranslations[role] || role}
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

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Stav objednávky..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Stav objednávky</SelectItem>
                  {uniqueStatusValues.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="w-full">
            <div className="flex gap-2 mb-4">
              {/* Calendar */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    {isSpecificDay
                      ? format(date, "PP", { locale: cs })
                      : "Vybrat den"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={isSpecificDay ? date : undefined}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {/* Month buttons */}
              {[-2, -1, 0, 1].map((offset) => {
                const monthDate = new Date();
                // Set to first day of the month to avoid month boundary issues
                monthDate.setDate(1);
                monthDate.setMonth(monthDate.getMonth() + offset);
                const buttonMonth = monthDate.getMonth();
                const buttonYear = monthDate.getFullYear();

                return (
                  <Button
                    key={offset}
                    variant={
                      !isSpecificDay &&
                      date.getMonth() === buttonMonth &&
                      date.getFullYear() === buttonYear
                        ? "default"
                        : "outline"
                    }
                    onClick={() => handleMonthSelect(monthDate)}
                  >
                    {format(monthDate, "LLLL yyyy", { locale: cs })}
                  </Button>
                );
              })}
            </div>

            <div>
              <PrintSummary
                orders={filteredOrders}
                period={
                  date ? format(date, "LLLL yyyy", { locale: cs }) : "All"
                }
                globalFilter={globalFilter}
              />

              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-2 print:hidden">
                  <span className="text-muted-foreground text-sm font-semibold">
                    Vydáno celkem:
                  </span>
                  <Badge variant="outline" className="text-yellow-700 ">
                    {calculateCrateSums(filteredOrders).crateSmall}
                    <Container size={16} className="mx-1" />
                  </Badge>
                  <Badge variant="outline" className="text-red-800">
                    {calculateCrateSums(filteredOrders).crateBig}
                    <Container size={20} className="mx-1" />
                  </Badge>
                  <span className="text-muted-foreground text-sm font-semibold">
                    Přijato celkem:
                  </span>
                  <Badge variant="secondary" className="text-yellow-700">
                    {calculateCrateSums(filteredOrders).crateSmallReceived}
                    <Container size={16} className="mx-1" />
                  </Badge>
                  <Badge variant="secondary" className="text-red-800">
                    {calculateCrateSums(filteredOrders).crateBigReceived}
                    <Container size={20} className="mx-1" />
                  </Badge>
                </div>

                <div className="flex gap-2 print:hidden">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const selectedOrders =
                        table.getFilteredSelectedRowModel().rows.length > 0
                          ? table
                              .getFilteredSelectedRowModel()
                              .rows.map(
                                (row: { original: Order }) => row.original
                              )
                          : filteredOrders;
                      printOrderTotals(selectedOrders);
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Tisk objednávek
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const selectedOrders =
                        table.getFilteredSelectedRowModel().rows.length > 0
                          ? table
                              .getFilteredSelectedRowModel()
                              .rows.map(
                                (row: { original: Order }) => row.original
                              )
                          : filteredOrders;
                      await printCategoryDonuts(selectedOrders);
                    }}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Výroba koblih
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const selectedOrders =
                        table.getFilteredSelectedRowModel().rows.length > 0
                          ? table
                              .getFilteredSelectedRowModel()
                              .rows.map(
                                (row: { original: Order }) => row.original
                              )
                          : filteredOrders;
                      await printCategorySweets(selectedOrders);
                    }}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Výroba dortů
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const selectedOrders =
                        table.getFilteredSelectedRowModel().rows.length > 0
                          ? table
                              .getFilteredSelectedRowModel()
                              .rows.map(
                                (row: { original: Order }) => row.original
                              )
                          : filteredOrders;
                      printCategoryBagets(selectedOrders);
                    }}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Výroba bagety
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const selectedOrders =
                        table.getFilteredSelectedRowModel().rows.length > 0
                          ? table
                              .getFilteredSelectedRowModel()
                              .rows.map(
                                (row: { original: Order }) => row.original
                              )
                          : filteredOrders;
                      printProductSummary(selectedOrders);
                    }}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Výroba pekaři
                  </Button>

                  {authUser?.role === "admin" && (
                    <div className="flex gap-2">
                      <Select
                        value={selectedReport}
                        onValueChange={(value) => {
                          setSelectedReport(value);
                          const selectedOrders =
                            table.getFilteredSelectedRowModel().rows.length > 0
                              ? table
                                  .getFilteredSelectedRowModel()
                                  .rows.map(
                                    (row: { original: Order }) => row.original
                                  )
                              : filteredOrders;

                          switch (value) {
                            case "orders":
                              printReportBuyerOrders(selectedOrders);
                              break;
                            case "products":
                              printReportProducts(selectedOrders);
                              break;
                            case "buyers":
                              printReportBuyersSummary(selectedOrders);
                              break;
                            case "daily":
                              printReportDaily(selectedOrders);
                              break;
                          }
                        }}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Vyberte tisk" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="orders">
                            Report objednávek
                          </SelectItem>
                          <SelectItem value="products">
                            Report výrobků
                          </SelectItem>
                          <SelectItem value="buyers">
                            Report odběratelů
                          </SelectItem>
                          <SelectItem value="daily">
                            Denní přehled objednávek
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedReport("")}
                        className="px-2"
                      >
                        Reset
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const selectedOrders =
                          table.getFilteredSelectedRowModel().rows.length > 0
                            ? table
                                .getFilteredSelectedRowModel()
                                .rows.map(
                                  (row: { original: Order }) => row.original
                                )
                            : filteredOrders;
                        const printWindow = window.open("", "_blank");
                        if (printWindow) {
                          printWindow.document.write(`
                            <html>
                              <head>
                                <title>Přehled objednávek</title>
                                <style>
                                  body { font-family: Arial, sans-serif; }
                                  table { width: 100%; border-collapse: collapse; }
                                  th, td { padding: 8px; }
                                  .border-b { border-bottom: 1px solid #ddd; }
                                </style>
                              </head>
                              <body>
                                ${ReactDOMServer.renderToString(
                                  <OrdersTableSummary
                                    orders={selectedOrders}
                                    isAdmin={authUser?.role === "admin"}
                                  />
                                )}
                              </body>
                            </html>
                          `);
                          printWindow.document.close();
                          printWindow.print();
                        }
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Tisk přehledu
                    </Button>
                  </div>
                </div>
              </div>

              <OrderTableContent
                data={filteredOrders}
                globalFilter={globalFilter}
                columns={columns}
                setSelectedOrderId={setSelectedOrderId}
                onTableReady={(t) => setTable(t)}
              />
            </div>
          </div>
        </div>
      </Card>
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
  const tableContainerRef = useRef<HTMLDivElement>(null);

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

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 45, // Approximate height of each row
    overscan: 10, // Number of items to render outside of the visible area
  });

  useEffect(() => {
    onTableReady(table);
  }, [table, onTableReady]);

  return (
    <div className="border rounded-md print:hidden">
      <div ref={tableContainerRef} className="max-h-[800px] overflow-auto">
        <Table className="relative table-fixed w-full">
          <TableHeader className="sticky top-0 bg-background z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="px-2">
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
          <TableBody
            className="relative"
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <TableRow
                  key={row.id}
                  onClick={() => setSelectedOrderId(row.original.id)}
                  className="cursor-pointer hover:bg-muted/50 absolute w-full"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-2">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
