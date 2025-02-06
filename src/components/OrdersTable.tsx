import ReactDOMServer from "react-dom/server";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
} from "@tanstack/react-table";
import {
  fetchAllOrders,
  useDeleteOrder,
  useUpdateOrder,
} from "@/hooks/useOrders";
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
  CalendarIcon,
  Container,
  Printer,
  FileText,
  StickyNote,
  Undo2,
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
import { OrdersTableSummary } from "./OrdersTablePrintSummary";
import { useIsOrderInvoiced } from "@/hooks/useInvoices";
import { useOrderLockStore } from "@/providers/orderLockStore";
import { PrintDonutSummary } from "./PrintDonutSummary";
import { PrintSweetSummary } from "./PrintSweetSummary";

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
  period:
    | "today"
    | "tomorrow"
    | "afterTomorrow"
    | "week"
    | "month"
    | "lastMonth"
    | "nextWeek",
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
      case "afterTomorrow":
        const afterTomorrow = new Date(now);
        afterTomorrow.setDate(afterTomorrow.getDate() + 2);
        return orderDate.toDateString() === afterTomorrow.toDateString();
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
    cell: ({ row }) => {
      const driverName = row.original.driver?.full_name || "-";
      return <div>{driverName}</div>;
    },
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
    header: () => {
      const user = useAuthStore((state) => state.user);
      return user?.role === "admin" ? (
        <div className="text-right">Celkem</div>
      ) : null;
    },
    cell: ({ row }) => {
      const user = useAuthStore((state) => state.user);
      return user?.role === "admin" ? (
        <div className="text-right">{row.original.total.toFixed(2)} Kč</div>
      ) : null;
    },
  },
  {
    accessorKey: "crateSmallReceived",
    header: () => (
      <div className="text-right justify-center flex items-center print:hidden">
        <Undo2 size={16} />
        Malé
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-start w-12 text-right print:hidden">
        <Badge variant="outline" className="text-yellow-700 ">
          {row.original.crateSmallReceived}
          <Container size={16} className="mx-1" />
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: "crateBigReceived",
    header: () => (
      <div className="text-right justify-center flex items-center print:hidden">
        <Undo2 size={16} />
        Velké
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-end w-12 text-right print:hidden">
        <Badge variant="outline" className="flex flex-row gap-1 text-red-800 ">
          {row.original.crateBigReceived}
          <Container size={20} className="mx-1" />
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
      const nonZeroQuantityCount =
        row.original.order_items?.filter((item) => item.quantity > 0).length ||
        0;

      return (
        <div className="text-right flex justify-end gap-2 items-center">
          {checkedCount > 0 && (
            <Badge variant="outline" className="border-green-700 bg-green-400">
              {checkedCount} / {nonZeroQuantityCount}
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
          <Badge
            variant="outline"
            className={cn(
              row.original.status === "Expedice R" ||
                row.original.status === "New"
                ? "bg-orange-600 text-white"
                : row.original.status === "Expedice O"
                  ? "bg-orange-800 text-white"
                  : row.original.status === "Přeprava"
                    ? "bg-sky-600 text-white"
                    : ""
            )}
          >
            {row.original.status}
          </Badge>
        </div>
      );
    },
  },
  {
    id: "lock",
    header: () => <div className="w-8 text-center print:hidden">Lock</div>,
    cell: ({ row }) => {
      const order = row.original;
      const { mutate: updateOrder } = useUpdateOrder();
      const { toast } = useToast();
      const user = useAuthStore((state) => state.user);
      const canManageLocks =
        user?.role === "admin" || user?.role === "expedition";

      const handleLockToggle = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent row selection
        if (!canManageLocks) return;

        updateOrder(
          {
            id: order.id,
            updatedFields: { isLocked: !order.isLocked },
          },
          {
            onSuccess: () => {
              toast({
                title: order.isLocked
                  ? "Objednávka odemčena"
                  : "Objednávka uzamčena",
                description: order.isLocked
                  ? "Objednávka je nyní editovatelná"
                  : "Objednávka je nyní jen pro čtení",
              });
            },
            onError: () => {
              toast({
                title: "Error",
                description: "Failed to update order lock status",
                variant: "destructive",
              });
            },
          }
        );
      };

      return (
        <div className="flex justify-center print:hidden">
          {canManageLocks ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLockToggle}
              className={cn(
                "h-8 w-8 p-0",
                order.isLocked ? "text-muted-foreground" : "text-orange-500"
              )}
            >
              {order.isLocked ? (
                <Lock className="h-4 w-4" />
              ) : (
                <Unlock className="h-4 w-4" />
              )}
            </Button>
          ) : order.isLocked ? (
            <Lock className="h-4 w-4 text-muted-foreground" />
          ) : null}
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
      const { data: invoicedOrderIds } = useIsOrderInvoiced();
      const { unlockOrder, lockOrder, isOrderUnlocked } = useOrderLockStore();
      const [isUnlocked, setIsUnlocked] = useState(false);
      const isLocked = invoicedOrderIds?.has(order.id);
      const canUnlock = user?.role === "admin";

      const toggleLock = () => {
        if (!canUnlock) return;
        const isUnlocked = isOrderUnlocked(order.id);
        if (isUnlocked) {
          lockOrder(order.id);
        } else {
          unlockOrder(order.id);
        }
        setIsUnlocked(!isUnlocked);
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
        <div className="flex justify-end gap-2">
          {isLocked && canUnlock && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLock}
              className={isUnlocked ? "text-red-600" : "text-muted-foreground"}
            >
              {isUnlocked ? (
                <Unlock className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
            </Button>
          )}
          {user?.role === "admin" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  disabled={isLocked && !isUnlocked}
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
          )}
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
  const authUser = useAuthStore((state) => state.user);
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
const printProductSummary = (orders: Order[]) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>Tisk výroby podle abecedy</title>
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

const printCategoryDonuts = (orders: Order[]) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>Tisk výroby koblih</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div id="print-content">
          ${ReactDOMServer.renderToString(<PrintDonutSummary orders={orders} />)}
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.print();
};

const printCategorySweets = (orders: Order[]) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>Tisk výroby zákusků a čajového</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div id="print-content">
          ${ReactDOMServer.renderToString(<PrintSweetSummary orders={orders} />)}
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
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const { data: driverUsers } = useDriverUsers();
  const [table, setTable] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState("all");
  const [userSearchQuery, setUserSearchQuery] = useState("");

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

    if (selectedStatus !== "all") {
      filtered = filtered.filter((order) => order.status === selectedStatus);
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

    if (selectedUser !== "all") {
      filtered = filtered.filter(
        (order) => order.user.full_name === selectedUser
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
    selectedStatus,
    selectedUser,
  ]);

  const getDateFilteredOrders = (
    orders: Order[],
    period:
      | "today"
      | "tomorrow"
      | "afterTomorrow"
      | "week"
      | "nextWeek"
      | "month"
      | "lastMonth"
  ) => {
    return filterOrdersByDate(orders || [], period);
  };

  const calculateTotalQuantityForPeriod = (
    productId: string,
    period:
      | "today"
      | "tomorrow"
      | "afterTomorrow"
      | "week"
      | "nextWeek"
      | "month"
      | "lastMonth"
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
          @page { size: A4;  }
            body { font-family: Arial; sans-serif; padding: 10px; }
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
  // const calculateOrderTotalsByDate = (orders: Order[]) => {
  //   const totalsByDate = new Map<
  //     string,
  //     Map<string, { name: string; quantity: number; categoryId: number }>
  //   >();

  //   orders.forEach((order) => {
  //     const date = new Date(order.date).toLocaleDateString();
  //     if (!totalsByDate.has(date)) {
  //       totalsByDate.set(date, new Map());
  //     }

  //     const dateMap = totalsByDate.get(date)!;
  //     order.order_items.forEach((item) => {
  //       const product = products?.find((p) => p.id === item.product_id);
  //       const current = dateMap.get(item.product_id.toString()) || {
  //         name: product?.name || "Unknown",
  //         quantity: 0,
  //         categoryId: product?.category_id || 0,
  //       };
  //       dateMap.set(item.product_id.toString(), {
  //         ...current,
  //         quantity: current.quantity + item.quantity,
  //       });
  //     });
  //   });

  //   return totalsByDate;
  // };

  // Update the printOrderTotalsByDate function
  // const printOrderTotalsByDate = (orders: Order[]) => {
  //   const totalsByDate = calculateOrderTotalsByDate(orders);
  //   const printWindow = window.open("", "_blank");
  //   if (!printWindow) return;

  //   printWindow.document.write(`
  //     <html>
  //       <head>
  //         <title>Výroba podle dnů</title>
  //         <style>
  //           body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
  //           h1 { font-size: 18px; margin-bottom: 10px; }
  //           h2 { font-size: 16px; color: #666; margin: 30px 0 10px 0; }
  //           table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  //           th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
  //           th { background-color: #f5f5f5; }
  //           td:last-child { text-align: right; }
  //           .date { margin-bottom: 20px; color: #666; }
  //           .print-date { text-align: right; color: #666; margin-bottom: 20px; }
  //         </style>
  //       </head>
  //       <body>
  //         ${Array.from(totalsByDate.entries())
  //           .map(
  //             ([date, products]) => `
  //           <h1>Datum výroby: ${date}</h1>
  //           <table>
  //             <thead>
  //               <tr>
  //                 <th>Výrobky podle kategorie</th>
  //                 <th style="text-align: right">Množství</th>
  //               </tr>
  //             </thead>
  //             <tbody>
  //               ${Array.from(products.values())
  //                 .filter((item) => item.quantity > 0) // Filter out zero quantity items
  //                 .sort(
  //                   (a, b) =>
  //                     a.categoryId - b.categoryId ||
  //                     a.name.localeCompare(b.name)
  //                 )
  //                 .map(
  //                   (item) => `
  //                   <tr>
  //                     <td>${item.name}</td>
  //                     <td style="text-align: right">${item.quantity}</td>
  //                   </tr>
  //                 `
  //                 )
  //                 .join("")}
  //             </tbody>
  //           </table>
  //         `
  //           )
  //           .join("")}
  //           <div class="print-date">Vytištěno: ${new Date().toLocaleString()}</div>
  //       </body>
  //     </html>
  //   `);

  //   printWindow.document.close();
  //   printWindow.print();
  // };

  // 1. Add print state
  const [isPrinting] = useState(false);
  const productPrintRef = useRef<HTMLDivElement>(null);
  const authUser = useAuthStore((state) => state.user);

  // 2. Update print handler
  // const handleProductPrint = useReactToPrint({
  //   content: () => productPrintRef.current,
  //   onAfterPrint: () => setIsPrinting(false),
  // });

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    return products?.filter((product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

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
              <Select
                value={selectedProductId}
                onValueChange={setSelectedProductId}
                onOpenChange={() => setSearchQuery("")}
              >
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue placeholder="Výrobky v objednávkách..." />
                </SelectTrigger>
                <SelectContent>
                  <Input
                    placeholder="Hledat produkt..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="sticky top-0 bg-background z-10 border-orange-600 hover:border-orange-600 focus-visible:ring-orange-600 mx-2 w-[calc(100%-16px)] pr-8"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-3 top-1.5 h-6 w-6 p-0"
                      onClick={() => setSearchQuery("")}
                    >
                      ×
                    </Button>
                  )}
                  <SelectItem value="all">All Products</SelectItem>
                  {filteredProducts?.map((product) => (
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
                                | "afterTomorrow"
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
                                  | "afterTomorrow"
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
                { value: "afterTomorrow", label: "Pozítří" },
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
              "afterTomorrow",
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
                  | "afterTomorrow"
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
                        <Container size={16} className="mx-1" />
                      </Badge>
                      <Badge variant="outline" className="text-red-800">
                        {crateSums.crateBig}
                        <Container size={20} className="mx-1" />
                      </Badge>
                      <span className="text-muted-foreground text-sm font-semibold">
                        Přijato celkem:
                      </span>
                      <Badge variant="secondary" className="text-yellow-700">
                        {crateSums.crateSmallReceived}
                        <Container size={16} className="mx-1" />
                      </Badge>
                      <Badge variant="secondary" className="text-red-800">
                        {crateSums.crateBigReceived}
                        <Container size={20} className="mx-1" />
                      </Badge>
                    </div>

                    <div className="flex gap-2 print:hidden">
                      {/* <div className="flex items-center gap-2 mr-4">
                        <Badge variant="outline" className="text-yellow-700">
                          {crateSums.crateSmall}
                          <Container size={16} className="mx-1" /> ↑
                        </Badge>
                        <Badge variant="outline" className="text-red-800">
                          {crateSums.crateBig}
                          <Container size={20} className="mx-1" /> ↑
                        </Badge>
                        <Badge variant="secondary" className="text-yellow-700">
                          {crateSums.crateSmallReceived}
                          <Container size={16} className="mx-1" /> ↓
                        </Badge>
                        <Badge variant="secondary" className="text-red-800">
                          {crateSums.crateBigReceived}
                          <Container size={20} className="mx-1" /> ↓
                        </Badge>
                      </div> */}

                      {/* <Button
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
                          printOrderTotalsByDate(orders);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Tisk výroby
                      </Button> */}

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
                          printCategoryDonuts(orders);
                        }}
                      >
                        <Printer className="h-4 w-4 mr-2" />
                        Výroba koblih
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
                          printCategorySweets(orders);
                        }}
                      >
                        <Printer className="h-4 w-4 mr-2" />
                        Výroba dortů
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
                        Výroba pekaři
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const orders =
                              table.getFilteredSelectedRowModel().rows.length >
                              0
                                ? table
                                    .getFilteredSelectedRowModel()
                                    .rows.map(
                                      (row: { original: Order }) => row.original
                                    )
                                : filteredPeriodOrders;
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
                                        orders={orders}
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

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const orders =
                              table.getFilteredSelectedRowModel().rows.length >
                              0
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
                      </div>
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
    <div className="border rounded-md print:hidden">
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
