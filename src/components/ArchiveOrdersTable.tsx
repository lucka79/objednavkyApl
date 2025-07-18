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
import { useState, useMemo, useEffect, forwardRef } from "react";

import { Card } from "./ui/card";
import { Badge } from "./ui/badge";

import {
  Container,
  Printer,
  FileText,
  StickyNote,
  Lock,
  Unlock,
  Download,
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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

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
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [isComparisonActive, setIsComparisonActive] = useState(false);

  // Calculate current week number
  const getCurrentWeek = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor(
      (now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
    );
    return Math.ceil((days + start.getDay() + 1) / 7);
  };

  const currentWeek = getCurrentWeek();
  const currentYear = new Date().getFullYear();

  // Calculate last week
  const lastWeek = currentWeek === 1 ? 52 : currentWeek - 1;
  const lastWeekYear = currentWeek === 1 ? currentYear - 1 : currentYear;

  // Calculate current and last month
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const [comparisonWeek1, setComparisonWeek1] = useState<number>(lastWeek);
  const [comparisonWeek2, setComparisonWeek2] = useState<number>(currentWeek);
  const [comparisonYear1, setComparisonYear1] = useState<number>(lastWeekYear);
  const [comparisonYear2, setComparisonYear2] = useState<number>(currentYear);
  const [comparisonType, setComparisonType] = useState<"week" | "month">(
    "week"
  );
  const [globalFilter, setGlobalFilter] = useState("");

  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedDriver, setSelectedDriver] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedAllUsers, setSelectedAllUsers] = useState("all");
  const [selectedAllOZ, setSelectedAllOZ] = useState("all");
  const setSelectedOrderId = useOrderStore((state) => state.setSelectedOrderId);
  const [selectedReport, setSelectedReport] = useState<string>("");
  const { data: driverUsers } = useDriverUsers();
  const [table, setTable] = useState<any>(null);

  const handleStartComparison = () => {
    setIsComparisonActive(true);
  };

  const handleStopComparison = () => {
    setIsComparisonActive(false);
    setIsComparisonMode(false);
  };

  // Update comparison values when type changes
  const handleComparisonTypeChange = (type: "week" | "month") => {
    setComparisonType(type);
    if (type === "week") {
      setComparisonWeek1(lastWeek);
      setComparisonWeek2(currentWeek);
      setComparisonYear1(lastWeekYear);
      setComparisonYear2(currentYear);
    } else {
      setComparisonWeek1(lastMonth);
      setComparisonWeek2(currentMonth);
      setComparisonYear1(lastMonthYear);
      setComparisonYear2(currentYear);
    }
  };

  const {
    data: orders,
    error,
    isLoading,
  } = useOrdersByMonth(date, isSpecificDay);

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

  // Update filteredOrders to include role filtering
  const filteredOrders = useMemo(() => {
    let filtered = orders || [];

    if (selectedStatus !== "all") {
      filtered = filtered.filter((order) => order.status === selectedStatus);
    }

    // Add role filtering
    if (selectedRole !== "all") {
      filtered = filtered.filter((order) => order.user?.role === selectedRole);
    }

    // Fix driver filtering
    if (selectedDriver !== "all") {
      if (selectedDriver === "none") {
        filtered = filtered.filter((order) => !order.driver_id);
      } else {
        filtered = filtered.filter(
          (order) => order.driver_id === selectedDriver
        );
      }
    }

    // Update OZ filter to include "no OZ" option
    if (selectedAllOZ === "oz") {
      filtered = filtered.filter((order) => order.user?.oz === true);
    } else if (selectedAllOZ === "mo_partners") {
      filtered = filtered.filter((order) => order.user?.mo_partners === true);
    } else if (selectedAllOZ === "oz_new") {
      filtered = filtered.filter((order) => order.user?.oz_new === true);
    } else if (selectedAllOZ === "no_oz") {
      filtered = filtered.filter((order) => order.user?.oz === false);
    } else if (selectedAllOZ === "oz_new_false") {
      filtered = filtered.filter((order) => order.user?.oz_new === false);
    } else if (selectedAllOZ === "no_oz_both") {
      filtered = filtered.filter(
        (order) => order.user?.oz === false && order.user?.oz_new === false
      );
    }

    // Add filtering for the new dropdowns
    if (selectedAllUsers !== "all") {
      filtered = filtered.filter(
        (order) => order.user.full_name === selectedAllUsers
      );
    }

    if (selectedAllOZ !== "all") {
      if (selectedAllOZ === "oz") {
        filtered = filtered.filter((order) => order.user?.oz === true);
      } else if (selectedAllOZ === "mo_partners") {
        filtered = filtered.filter((order) => order.user?.mo_partners === true);
      } else if (selectedAllOZ === "oz_new") {
        filtered = filtered.filter((order) => order.user?.oz_new === true);
      } else if (selectedAllOZ === "no_oz_both") {
        filtered = filtered.filter(
          (order) => order.user?.oz === false && order.user?.oz_new === false
        );
      }
    }

    return filtered;
  }, [
    orders,
    selectedRole,
    selectedDriver,
    selectedStatus,
    selectedAllUsers,
    selectedAllOZ,
  ]);

  // Custom hook for comparison orders
  const useComparisonOrders = (
    week1: number,
    year1: number,
    week2: number,
    year2: number,
    type: "week" | "month"
  ) => {
    return useQuery({
      queryKey: [
        "comparisonOrders",
        week1,
        year1,
        week2,
        year2,
        type,
        selectedRole,
        selectedDriver,
        selectedStatus,
        selectedAllUsers,
        selectedAllOZ,
      ],
      queryFn: async () => {
        try {
          // Calculate week start and end dates
          const getWeekDates = (weekNum: number, year: number) => {
            const firstDayOfYear = new Date(year, 0, 1);
            const daysToAdd = (weekNum - 1) * 7;
            const weekStart = new Date(firstDayOfYear);
            weekStart.setDate(
              firstDayOfYear.getDate() + daysToAdd - firstDayOfYear.getDay()
            );
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            return { start: weekStart, end: weekEnd };
          };

          const week1Dates = getWeekDates(week1, year1);
          const week2Dates = getWeekDates(week2, year2);

          let startDate: Date;
          let endDate: Date;

          // Apply date filters
          if (type === "week") {
            // For week comparison, get data for both weeks
            startDate =
              week1Dates.start < week2Dates.start
                ? week1Dates.start
                : week2Dates.start;
            endDate =
              week1Dates.end > week2Dates.end ? week1Dates.end : week2Dates.end;
          } else {
            // For month comparison, use the month numbers directly
            const month1Start = new Date(year1, week1 - 1, 1);
            const month1End = new Date(year1, week1, 0);
            const month2Start = new Date(year2, week2 - 1, 1);
            const month2End = new Date(year2, week2, 0);

            startDate = month1Start < month2Start ? month1Start : month2Start;
            endDate = month1End > month2End ? month1End : month2End;
          }

          // Format dates for Supabase
          const startDateStr = startDate.toISOString().split("T")[0];
          const endDateStr = endDate.toISOString().split("T")[0];

          console.log(
            "Fetching orders for date range:",
            startDateStr,
            "to",
            endDateStr
          );

          // Fetch all orders using pagination to handle large datasets
          let allOrders: any[] = [];
          let hasMore = true;
          let page = 0;
          const pageSize = 1000;

          while (hasMore) {
            const { data: pageData, error } = await supabase
              .from("orders")
              .select(
                `
                id,
                date,
                total,
                status,
                driver_id,
                user_id,
                user:profiles!orders_user_id_fkey(
                  id,
                  full_name,
                  oz,
                  oz_new,
                  mo_partners,
                  role
                )
              `
              )
              .gte("date", startDateStr)
              .lte("date", endDateStr)
              .order("date", { ascending: true })
              .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
              console.error("Supabase query error:", error);
              throw error;
            }

            if (pageData && pageData.length > 0) {
              allOrders = [...allOrders, ...pageData];
              page++;
            } else {
              hasMore = false;
            }

            // Safety check to prevent infinite loops
            if (page > 10) {
              console.warn("Reached maximum page limit, stopping pagination");
              break;
            }
          }

          console.log("Fetched orders:", allOrders.length);

          let filteredData = allOrders;

          // Apply existing filters
          if (selectedRole !== "all") {
            filteredData = filteredData.filter((order) => {
              const user = Array.isArray(order.user)
                ? order.user[0]
                : order.user;
              return user?.role === selectedRole;
            });
          }

          if (selectedDriver !== "all") {
            if (selectedDriver === "none") {
              filteredData = filteredData.filter((order) => !order.driver_id);
            } else {
              filteredData = filteredData.filter(
                (order) => order.driver_id === selectedDriver
              );
            }
          }

          if (selectedStatus !== "all") {
            filteredData = filteredData.filter(
              (order) => order.status === selectedStatus
            );
          }

          if (selectedAllUsers !== "all") {
            filteredData = filteredData.filter((order) => {
              const user = Array.isArray(order.user)
                ? order.user[0]
                : order.user;
              return user?.full_name === selectedAllUsers;
            });
          }

          if (selectedAllOZ !== "all") {
            if (selectedAllOZ === "oz") {
              filteredData = filteredData.filter((order) => {
                const user = Array.isArray(order.user)
                  ? order.user[0]
                  : order.user;
                return user?.oz === true;
              });
            } else if (selectedAllOZ === "mo_partners") {
              filteredData = filteredData.filter((order) => {
                const user = Array.isArray(order.user)
                  ? order.user[0]
                  : order.user;
                return user?.mo_partners === true;
              });
            } else if (selectedAllOZ === "oz_new") {
              filteredData = filteredData.filter((order) => {
                const user = Array.isArray(order.user)
                  ? order.user[0]
                  : order.user;
                return user?.oz_new === true;
              });
            } else if (selectedAllOZ === "no_oz_both") {
              filteredData = filteredData.filter((order) => {
                const user = Array.isArray(order.user)
                  ? order.user[0]
                  : order.user;
                return user?.oz === false && user?.oz_new === false;
              });
            }
          }

          return filteredData;
        } catch (error) {
          console.error("Error in comparison query:", error);
          throw error;
        }
      },
      enabled: isComparisonActive,
      retry: 2,
      retryDelay: 1000,
    });
  };

  const { data: comparisonOrders, isLoading: isLoadingComparison } =
    useComparisonOrders(
      comparisonWeek1,
      comparisonYear1,
      comparisonWeek2,
      comparisonYear2,
      comparisonType
    );

  // Calculate comparison data
  const comparisonData = useMemo(() => {
    if (!comparisonOrders) return [];

    const calculatePeriodData = (
      orders: any[],
      targetWeek: number,
      targetYear: number,
      type: "week" | "month"
    ) => {
      const userData = new Map();

      // Filter orders for the specific period
      const filteredOrders = orders.filter((order) => {
        const orderDate = new Date(order.date);

        if (type === "week") {
          // Calculate week number for the order date
          const start = new Date(orderDate.getFullYear(), 0, 1);
          const days = Math.floor(
            (orderDate.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)
          );
          const orderWeek = Math.ceil((days + start.getDay() + 1) / 7);

          return (
            orderWeek === targetWeek && orderDate.getFullYear() === targetYear
          );
        } else {
          // For month comparison, check if order is in the target month
          return (
            orderDate.getMonth() + 1 === targetWeek &&
            orderDate.getFullYear() === targetYear
          );
        }
      });

      filteredOrders.forEach((order) => {
        const userName = order.user?.full_name || "Unknown";
        const currentData = userData.get(userName) || {
          name: userName,
          orderCount: 0,
          totalSum: 0,
        };

        currentData.orderCount += 1;
        currentData.totalSum += order.total || 0;

        userData.set(userName, currentData);
      });

      return Array.from(userData.values()).sort(
        (a, b) => b.totalSum - a.totalSum
      );
    };

    const period1Data = calculatePeriodData(
      comparisonOrders,
      comparisonWeek1,
      comparisonYear1,
      comparisonType
    );
    const period2Data = calculatePeriodData(
      comparisonOrders,
      comparisonWeek2,
      comparisonYear2,
      comparisonType
    );

    // Combine data for comparison
    const allUsers = new Set([
      ...period1Data.map((d) => d.name),
      ...period2Data.map((d) => d.name),
    ]);

    const combinedData = Array.from(allUsers).map((userName) => {
      const period1 = period1Data.find((d) => d.name === userName) || {
        orderCount: 0,
        totalSum: 0,
      };
      const period2 = period2Data.find((d) => d.name === userName) || {
        orderCount: 0,
        totalSum: 0,
      };

      return {
        userName,
        period1: {
          orderCount: period1.orderCount,
          totalSum: period1.totalSum,
        },
        period2: {
          orderCount: period2.orderCount,
          totalSum: period2.totalSum,
        },
        difference: {
          orderCount: period2.orderCount - period1.orderCount,
          totalSum: period2.totalSum - period1.totalSum,
        },
      };
    });

    // Sort by user name using Czech locale
    return combinedData.sort((a, b) =>
      a.userName.localeCompare(b.userName, "cs")
    );
  }, [
    comparisonOrders,
    comparisonWeek1,
    comparisonYear1,
    comparisonWeek2,
    comparisonYear2,
    comparisonType,
  ]);

  // CSV export function for comparison data
  const exportComparisonToCSV = () => {
    if (!comparisonData.length) return;

    const period1Label =
      comparisonType === "week"
        ? `Týden ${comparisonWeek1}, ${comparisonYear1}`
        : `Měsíc ${comparisonWeek1}, ${comparisonYear1}`;

    const period2Label =
      comparisonType === "week"
        ? `Týden ${comparisonWeek2}, ${comparisonYear2}`
        : `Měsíc ${comparisonWeek2}, ${comparisonYear2}`;

    // Create multi-row header
    const headerRow1 = [
      "Uživatel",
      period1Label,
      "",
      period2Label,
      "",
      "Rozdíl",
      "",
    ];

    const headerRow2 = [
      "Jméno",
      "Počet objednávek",
      "Celková suma (Kč)",
      "Počet objednávek",
      "Celková suma (Kč)",
      "Počet objednávek",
      "Celková suma (Kč)",
    ];

    // Convert users to CSV rows
    const csvRows = comparisonData.map((item) => [
      item.userName,
      item.period1.orderCount,
      item.period1.totalSum.toFixed(2),
      item.period2.orderCount,
      item.period2.totalSum.toFixed(2),
      item.difference.orderCount,
      item.difference.totalSum.toFixed(2),
    ]);

    // Combine headers and rows
    const csvContent = [headerRow1, headerRow2, ...csvRows]
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `porovnani_${comparisonType}_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      <Card className="my-0 p-4 print:border-none print:shadow-none print:absolute print:top-0 print:left-0 print:right-0 print:m-0 print:h-auto print:overflow-visible print:transform-none w-full">
        <div className="space-y-4 w-full print:!m-0">
          <div className="space-y-2 print:hidden w-full">
            <div className="flex flex-col sm:flex-row justify-start items-start sm:items-center gap-2 w-full">
              <Input
                placeholder="Search orders..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="max-w-sm w-full sm:w-auto"
              />

              {/* <Select
                value={selectedUser}
                onValueChange={setSelectedUser}
                onOpenChange={() => setUserSearchQuery("")}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
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
                  {filteredUserNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select> */}

              <div className="flex flex-wrap gap-2 print:hidden">
                <span className="text-muted-foreground text-sm font-semibold">
                  Vydáno:
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
                  Přijato:
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
              <Badge
                variant="secondary"
                className="flex items-center gap-2 ml-auto"
              >
                {date
                  ? `${filteredOrders.length} orders`
                  : `${filteredOrders.length} total orders`}
              </Badge>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-full sm:w-[200px]">
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
                <SelectTrigger className="w-full sm:w-[200px]">
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
                <SelectTrigger className="w-full sm:w-[200px]">
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

              <Select
                value={selectedAllUsers}
                onValueChange={setSelectedAllUsers}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Všichni odběratelé..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všichni odběratelé</SelectItem>
                  {uniqueUserNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedAllOZ} onValueChange={setSelectedAllOZ}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Všichni..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vyber OZ/Mo Partners</SelectItem>
                  <SelectItem value="oz">Obchodní zást. původní</SelectItem>
                  <SelectItem value="oz_new">ObchZást (Hanka)</SelectItem>
                  <SelectItem value="mo_partners">Mo Partners</SelectItem>

                  <SelectItem value="no_oz_both">Bez OZ i Hanky</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="w-full">
            <div className="flex flex-wrap gap-2 mb-4 items-center justify-between">
              <div className="flex flex-wrap gap-2">
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

                {/* Comparison Mode Toggle */}
                <Button
                  variant={isComparisonMode ? "default" : "outline"}
                  onClick={() => setIsComparisonMode(!isComparisonMode)}
                  className="ml-4"
                >
                  {isComparisonMode ? "Zavřít porovnání" : "Porovnání období"}
                </Button>
              </div>
            </div>

            {/* Comparison Mode UI */}
            {isComparisonMode && (
              <div className="mb-4 p-4 border rounded-lg bg-gray-50">
                <div className="flex flex-wrap gap-4 items-center mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Typ porovnání:</span>
                    <Select
                      value={comparisonType}
                      onValueChange={(value: "week" | "month") =>
                        handleComparisonTypeChange(value)
                      }
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="week">Týden</SelectItem>
                        <SelectItem value="month">Měsíc</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {comparisonType === "week" ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Týden 1:</span>
                        <Select
                          value={comparisonWeek1.toString()}
                          onValueChange={(value) =>
                            setComparisonWeek1(parseInt(value))
                          }
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 52 }, (_, i) => i + 1).map(
                              (week) => (
                                <SelectItem key={week} value={week.toString()}>
                                  {week}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                        <Select
                          value={comparisonYear1.toString()}
                          onValueChange={(value) =>
                            setComparisonYear1(parseInt(value))
                          }
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[2023, 2024, 2025].map((year) => (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Týden 2:</span>
                        <Select
                          value={comparisonWeek2.toString()}
                          onValueChange={(value) =>
                            setComparisonWeek2(parseInt(value))
                          }
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 52 }, (_, i) => i + 1).map(
                              (week) => (
                                <SelectItem key={week} value={week.toString()}>
                                  {week}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                        <Select
                          value={comparisonYear2.toString()}
                          onValueChange={(value) =>
                            setComparisonYear2(parseInt(value))
                          }
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[2023, 2024, 2025].map((year) => (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Měsíc 1:</span>
                        <Select
                          value={comparisonWeek1.toString()}
                          onValueChange={(value) =>
                            setComparisonWeek1(parseInt(value))
                          }
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(
                              (month) => (
                                <SelectItem
                                  key={month}
                                  value={month.toString()}
                                >
                                  {new Date(
                                    comparisonYear1,
                                    month - 1,
                                    1
                                  ).toLocaleDateString("cs-CZ", {
                                    month: "long",
                                  })}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                        <Select
                          value={comparisonYear1.toString()}
                          onValueChange={(value) =>
                            setComparisonYear1(parseInt(value))
                          }
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[2023, 2024, 2025, 2026, 2027].map((year) => (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Měsíc 2:</span>
                        <Select
                          value={comparisonWeek2.toString()}
                          onValueChange={(value) =>
                            setComparisonWeek2(parseInt(value))
                          }
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(
                              (month) => (
                                <SelectItem
                                  key={month}
                                  value={month.toString()}
                                >
                                  {new Date(
                                    comparisonYear2,
                                    month - 1,
                                    1
                                  ).toLocaleDateString("cs-CZ", {
                                    month: "long",
                                  })}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                        <Select
                          value={comparisonYear2.toString()}
                          onValueChange={(value) =>
                            setComparisonYear2(parseInt(value))
                          }
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[2023, 2024, 2025, 2026, 2027].map((year) => (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {/* CSV Export Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportComparisonToCSV}
                    className="flex items-center gap-1 bg-green-50 hover:bg-green-100 border-green-200 text-green-700 ml-auto"
                    disabled={!comparisonData.length}
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>

                  {/* Start Comparison Button */}
                  {!isComparisonActive && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleStartComparison}
                      className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      Porovnej
                    </Button>
                  )}

                  {/* Stop Comparison Button */}
                  {isComparisonActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStopComparison}
                      className="flex items-center gap-1 text-red-600 border-red-600 hover:bg-red-50"
                    >
                      Zastavit porovnání
                    </Button>
                  )}
                </div>

                {/* Week Range Display */}
                {comparisonType === "week" && isComparisonActive && (
                  <div className="mb-4 text-sm text-gray-600">
                    <div className="flex gap-8">
                      <div>
                        <strong>
                          Týden {comparisonWeek1}, {comparisonYear1}:
                        </strong>{" "}
                        {(() => {
                          const firstDayOfYear = new Date(
                            comparisonYear1,
                            0,
                            1
                          );
                          const daysToAdd = (comparisonWeek1 - 1) * 7;
                          const weekStart = new Date(firstDayOfYear);
                          weekStart.setDate(
                            firstDayOfYear.getDate() +
                              daysToAdd -
                              firstDayOfYear.getDay()
                          );
                          const weekEnd = new Date(weekStart);
                          weekEnd.setDate(weekStart.getDate() + 6);
                          return `${format(weekStart, "dd.MM.yyyy", { locale: cs })} - ${format(weekEnd, "dd.MM.yyyy", { locale: cs })}`;
                        })()}
                        <span className="ml-2 text-orange-500 font-medium">
                          (
                          {
                            comparisonData.filter(
                              (item) => item.period1.orderCount > 0
                            ).length
                          }{" "}
                          uživatelů)
                        </span>
                      </div>
                      <div>
                        <strong>
                          Týden {comparisonWeek2}, {comparisonYear2}:
                        </strong>{" "}
                        {(() => {
                          const firstDayOfYear = new Date(
                            comparisonYear2,
                            0,
                            1
                          );
                          const daysToAdd = (comparisonWeek2 - 1) * 7;
                          const weekStart = new Date(firstDayOfYear);
                          weekStart.setDate(
                            firstDayOfYear.getDate() +
                              daysToAdd -
                              firstDayOfYear.getDay()
                          );
                          const weekEnd = new Date(weekStart);
                          weekEnd.setDate(weekStart.getDate() + 6);
                          return `${format(weekStart, "dd.MM.yyyy", { locale: cs })} - ${format(weekEnd, "dd.MM.yyyy", { locale: cs })}`;
                        })()}
                        <span className="ml-2 text-orange-500 font-medium">
                          (
                          {
                            comparisonData.filter(
                              (item) => item.period2.orderCount > 0
                            ).length
                          }{" "}
                          uživatelů)
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Month Range Display */}
                {comparisonType === "month" && isComparisonActive && (
                  <div className="mb-4 text-sm text-gray-600">
                    <div className="flex gap-8">
                      <div>
                        <strong>
                          Měsíc {comparisonWeek1}, {comparisonYear1}:
                        </strong>{" "}
                        {new Date(
                          comparisonYear1,
                          comparisonWeek1 - 1,
                          1
                        ).toLocaleDateString("cs-CZ", {
                          month: "long",
                          year: "numeric",
                        })}
                        <span className="ml-2 text-orange-500 font-medium">
                          (
                          {
                            comparisonData.filter(
                              (item) => item.period1.orderCount > 0
                            ).length
                          }{" "}
                          uživatelů)
                        </span>
                      </div>
                      <div>
                        <strong>
                          Měsíc {comparisonWeek2}, {comparisonYear2}:
                        </strong>{" "}
                        {new Date(
                          comparisonYear2,
                          comparisonWeek2 - 1,
                          1
                        ).toLocaleDateString("cs-CZ", {
                          month: "long",
                          year: "numeric",
                        })}
                        <span className="ml-2 text-orange-500 font-medium">
                          (
                          {
                            comparisonData.filter(
                              (item) => item.period2.orderCount > 0
                            ).length
                          }{" "}
                          uživatelů)
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Comparison Results */}
                {isComparisonActive && (
                  <>
                    {isLoadingComparison ? (
                      <div className="text-center py-4">
                        Načítání dat pro porovnání...
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-300">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="border border-gray-300 p-2 text-left">
                                Uživatel
                              </th>
                              <th
                                className="border border-gray-300 p-2 text-center"
                                colSpan={2}
                              >
                                {comparisonType === "week"
                                  ? `Týden ${comparisonWeek1}`
                                  : "Měsíc 1"}
                              </th>
                              <th
                                className="border border-gray-300 p-2 text-center"
                                colSpan={2}
                              >
                                {comparisonType === "week"
                                  ? `Týden ${comparisonWeek2}`
                                  : "Měsíc 2"}
                              </th>
                              <th
                                className="border border-gray-300 p-2 text-center"
                                colSpan={2}
                              >
                                Rozdíl
                              </th>
                            </tr>
                            <tr>
                              <th className="border border-gray-300 p-2 text-left">
                                Jméno
                              </th>
                              <th className="border border-gray-300 p-2 text-center">
                                Počet objednávek
                              </th>
                              <th className="border border-gray-300 p-2 text-center">
                                Celková suma (Kč)
                              </th>
                              <th className="border border-gray-300 p-2 text-center">
                                Počet objednávek
                              </th>
                              <th className="border border-gray-300 p-2 text-center">
                                Celková suma (Kč)
                              </th>
                              <th className="border border-gray-300 p-2 text-center">
                                Počet objednávek
                              </th>
                              <th className="border border-gray-300 p-2 text-center">
                                Celková suma (Kč)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {comparisonData.map((item, index) => (
                              <tr
                                key={index}
                                className={
                                  index % 2 === 0 ? "bg-white" : "bg-gray-50"
                                }
                              >
                                <td className="border border-gray-300 p-2 font-medium">
                                  {item.userName}
                                </td>
                                <td className="border border-gray-300 p-2 text-center">
                                  {item.period1.orderCount}
                                </td>
                                <td className="border border-gray-300 p-2 text-center">
                                  {item.period1.totalSum.toFixed(2)}
                                </td>
                                <td className="border border-gray-300 p-2 text-center">
                                  {item.period2.orderCount}
                                </td>
                                <td className="border border-gray-300 p-2 text-center">
                                  {item.period2.totalSum.toFixed(2)}
                                </td>
                                <td
                                  className={`border border-gray-300 p-2 text-center ${
                                    item.difference.orderCount > 0
                                      ? "text-green-600"
                                      : item.difference.orderCount < 0
                                        ? "text-red-600"
                                        : ""
                                  }`}
                                >
                                  {item.difference.orderCount > 0 ? "+" : ""}
                                  {item.difference.orderCount}
                                </td>
                                <td
                                  className={`border border-gray-300 p-2 text-center ${
                                    item.difference.totalSum > 0
                                      ? "text-green-600"
                                      : item.difference.totalSum < 0
                                        ? "text-red-600"
                                        : ""
                                  }`}
                                >
                                  {item.difference.totalSum > 0 ? "+" : ""}
                                  {item.difference.totalSum.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="w-full">
              <PrintSummary
                orders={filteredOrders}
                period={
                  date ? format(date, "LLLL yyyy", { locale: cs }) : "All"
                }
                globalFilter={globalFilter}
              />

              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4 w-full">
                <div className="flex flex-wrap gap-2 print:hidden w-full lg:w-auto">
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
    <div className="border rounded-md print:hidden w-full">
      <div className="w-full overflow-x-auto">
        <Table className="w-full">
          <TableHeader className="sticky top-0 bg-background z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="px-2 whitespace-nowrap">
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
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={() => setSelectedOrderId(row.original.id)}
                className="cursor-pointer hover:bg-muted/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-2 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
