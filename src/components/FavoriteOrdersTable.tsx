import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  flexRender,
} from "@tanstack/react-table";
// import { fetchAllOrders } from "@/hooks/useOrders";
import { FavoriteOrder, FavoriteItem } from "../../types";

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

import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchActiveProducts } from "@/hooks/useProducts";
import { useFavoriteOrders } from "@/hooks/useFavorites";
import { FavoriteDetailsDialog } from "./FavoriteDetailsDialog";
import { useInsertOrder, useInsertOrderItems } from "@/hooks/useOrders";
import { format } from "date-fns";

import {
  CirclePlus,
  Trash2,
  Lock,
  Copy,
  BarChart3,
  CheckCircle,
  XCircle,
  AlertCircle,
  TriangleAlert,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddFavoriteOrderDialog } from "./AddFavoriteOrderDialog";
import { supabase, useAuthStore } from "@/lib/supabase";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { useDeleteFavoriteOrder } from "@/hooks/useFavorites";
// import { useUpdateStoredItems } from "@/hooks/useFavorites";
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
// import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cs } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const DAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne", "X"] as const;
const ROLES = [
  "all",
  "user",
  "buyer",
  "driver",
  "store",
  "mobil",
  "expedition",
  "admin",
] as const;

const calculateZeroPriceFavoriteOrders = (orders: FavoriteOrder[]) => {
  return orders.filter((order) =>
    order.favorite_items?.some((item: FavoriteItem) => item.price === 0)
  ).length;
};

const columns: ColumnDef<FavoriteOrder>[] = [
  {
    accessorKey: "days",
    header: () => <div className="w-16 text-left">Den</div>,
    cell: ({ row }) => (
      <div className="w-18 text-left">
        {Array.isArray(row.original.days)
          ? row.original.days.join(", ")
          : row.original.days}
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
    accessorKey: "user.note",
    header: "Poznámka",
    cell: ({ row }) => (
      <div className="text-left">{row.original.user?.note || "—"}</div>
    ),
  },
  {
    accessorKey: "user.role",
    header: "Typ",
    cell: ({ row }) => {
      const role = row.original.user?.role;
      const roleMap: Record<string, string> = {
        user: "Uživatel",
        buyer: "Odběratel (Pohoda)",
        driver: "Řidič",
        store: "Prodejna",
        mobil: "Mobil",
        expedition: "Expedice",
        supplier: "Dodavatel",
        admin: "Administrátor",
      };

      const roleLabel =
        roleMap[role] || role?.charAt(0).toUpperCase() + role?.slice(1);

      return (
        <span
          className={`px-2 py-1 rounded text-xs ${
            role === "buyer"
              ? "bg-blue-100 text-blue-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {roleLabel}
        </span>
      );
    },
  },
  {
    accessorKey: "driver.full_name",
    header: "Řidič",
    cell: ({ row }) => (
      <div className="text-left">
        {row.original.driver?.full_name || "Bez řidiče"}
      </div>
    ),
  },
  {
    id: "priceWarning",
    header: () => <div className="w-[40px]">Cena</div>,
    cell: ({ row }) => {
      const hasZeroPriceItems = row.original.favorite_items?.some(
        (item: FavoriteItem) => item.price === 0
      );

      if (!hasZeroPriceItems) return <div className="w-[40px]"></div>;

      const zeroPriceItems = row.original.favorite_items?.filter(
        (item: FavoriteItem) => item.price === 0
      );

      return (
        <div className="flex justify-center w-[40px]">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <TriangleAlert size={16} className="text-red-500" />
              </TooltipTrigger>
              <TooltipContent className="bg-red-500 text-white border-red-500 max-w-xs">
                <p className="font-semibold mb-1">Položky s nulovou cenou:</p>
                <div className="space-y-1">
                  {zeroPriceItems?.map((item, index) => (
                    <div key={index} className="text-xs">
                      • {item.product?.name || "Neznámý produkt"} (množství:{" "}
                      {item.quantity})
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: () => <div className="text-right">Status</div>,
    cell: ({ row }) => {
      const itemCount = row.original.favorite_items?.length || 0;
      const zeroQuantityCount =
        row.original.favorite_items?.filter(
          (item: FavoriteItem) => item.quantity === 0
        ).length || 0;
      const manualPriceCount =
        row.original.favorite_items?.filter(
          (item: FavoriteItem) => item.price && item.price > 0
        ).length || 0;

      return (
        <div className="text-right flex justify-end gap-2 items-center">
          {manualPriceCount > 0 && (
            <Badge
              variant="outline"
              className="border-orange-500 text-orange-500"
            >
              {manualPriceCount} <Lock className="h-3 w-3 ml-1 inline" />
            </Badge>
          )}
          {zeroQuantityCount > 0 && (
            <Badge
              variant="outline"
              className="border-indigo-700 text-indigo-700"
            >
              {zeroQuantityCount} x 0
            </Badge>
          )}
          <Badge variant="outline">{row.original.status}</Badge>
          <Badge variant={itemCount === 0 ? "destructive" : "secondary"}>
            {itemCount} items
          </Badge>
        </div>
      );
    },
  },
  {
    accessorKey: "note",
    header: "Poznámka",
    cell: ({ row }) => (
      <div className="text-left">{row.original.note || "—"}</div>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const order = row.original;
      const deleteFavoriteOrder = useDeleteFavoriteOrder();
      const { toast } = useToast();

      const handleDelete = async () => {
        try {
          await deleteFavoriteOrder.mutateAsync(order.id);
          toast({
            title: "Success",
            description: "Favorite order deleted successfully",
          });
        } catch (error) {
          console.error("Failed to delete favorite order:", error);
          toast({
            title: "Error",
            description: "Failed to delete favorite order",
            variant: "destructive",
          });
        }
      };

      const handleCopy = async () => {
        try {
          // First create the favorite order
          const { data: newOrder, error: orderError } = await supabase
            .from("favorite_orders")
            .insert([
              {
                user_id: order.user_id,
                driver_id: order.driver?.id,
                days: ["X"],
                note: order.note,
                status: order.status,
              },
            ])
            .select()
            .single();

          if (orderError) throw orderError;

          // Then create the favorite items
          if (order.favorite_items?.length) {
            const { error: itemsError } = await supabase
              .from("favorite_items")
              .insert(
                order.favorite_items.map((item) => ({
                  order_id: newOrder.id,
                  product_id: item.product_id,
                  quantity: item.quantity,
                  price: item.price,
                  is_manual_price: false,
                }))
              );

            if (itemsError) throw itemsError;
          }

          toast({
            title: "Success",
            description: "Favorite order copied successfully",
          });
        } catch (error) {
          console.error("Failed to copy favorite order:", error);
          toast({
            title: "Error",
            description: "Failed to copy favorite order",
            variant: "destructive",
          });
        }
      };

      return (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
            onClick={handleCopy}
          >
            <Copy className="h-4 w-4" />
          </Button>
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
                <AlertDialogTitle>
                  Opravdu smazat oblíbenou objednávku?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Tato akce je nevratná. Smaže se oblíbená objednávka a všechny
                  přiřazené položky.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700"
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

interface FavoriteOrdersTableProps {
  selectedProductId: string | null;
}

// Create a type for the table content props
interface TableContentProps {
  data: FavoriteOrder[];
  columns: ColumnDef<FavoriteOrder>[];
  setSelectedOrderId: (id: number) => void;
  selectedOrders: Set<number>;
  setSelectedOrders: (orders: Set<number>) => void;
}

// Update the table content component
function FavoriteOrderTableContent({
  data,
  columns,
  setSelectedOrderId,
  selectedOrders,
  setSelectedOrders,
}: TableContentProps) {
  const tableColumns = useMemo(
    () => [
      {
        id: "select",
        header: () => (
          <Checkbox
            checked={
              data.length > 0 &&
              data.every((order) => selectedOrders.has(order.id))
            }
            onCheckedChange={(checked) => {
              const newSelected = new Set(selectedOrders);
              data.forEach((order) => {
                if (checked) {
                  newSelected.add(order.id);
                } else {
                  newSelected.delete(order.id);
                }
              });
              setSelectedOrders(newSelected);
            }}
            className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-white"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedOrders.has(row.original.id)}
            onCheckedChange={(checked) => {
              const newSelected = new Set(selectedOrders);
              if (checked) {
                newSelected.add(row.original.id);
              } else {
                newSelected.delete(row.original.id);
              }
              setSelectedOrders(newSelected);
            }}
            onClick={(e) => e.stopPropagation()}
            className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-white"
          />
        ),
      },
      ...columns,
    ],
    [columns, data, selectedOrders, setSelectedOrders]
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  });

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
              table.getRowModel().rows.map((row) => {
                // Check for conditional row coloring based on note
                const hasDoranNote =
                  row.original.note?.toLowerCase().includes("dorty") || false;
                const hasFreshNote =
                  row.original.note?.toLowerCase().includes("fresh") || false;
                const hasZeroPriceItems = row.original.favorite_items?.some(
                  (item: FavoriteItem) => item.price === 0
                );

                return (
                  <TableRow
                    key={row.id}
                    onClick={() => setSelectedOrderId(row.original.id)}
                    className={`cursor-pointer hover:bg-muted/50 ${
                      row.original.user?.role === "buyer"
                        ? "bg-blue-50"
                        : hasDoranNote
                          ? "bg-red-50"
                          : hasFreshNote
                            ? "bg-green-50"
                            : hasZeroPriceItems
                              ? "bg-yellow-50"
                              : ""
                    }`}
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
                );
              })
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

// Add comparison hook
const useOrdersComparison = (
  selectedDate: Date | undefined,
  selectedDay: string
) => {
  return useQuery({
    queryKey: ["ordersComparison", selectedDate, selectedDay],
    queryFn: async () => {
      if (!selectedDate || selectedDay === "all") return [];

      // Get the day of week for the selected date
      const dayOfWeek = format(selectedDate, "EEEE", { locale: cs });
      const dayMapping: Record<string, string> = {
        pondělí: "Po",
        úterý: "Út",
        středa: "St",
        čtvrtek: "Čt",
        pátek: "Pá",
        sobota: "So",
        neděle: "Ne",
      };
      const dayCode = dayMapping[dayOfWeek.toLowerCase()];

      // Fetch favorite orders for mobile users on this day
      const { data: favoriteOrders, error: favError } = await supabase
        .from("favorite_orders")
        .select(
          `
          *,
          user:profiles!favorite_orders_user_id_fkey(*),
          favorite_items (
            *,
            product:products(*)
          )
        `
        )
        .eq("user.role", "mobil")
        .contains("days", [dayCode])
        .eq("status", "active");

      if (favError) throw favError;

      // Fetch actual orders for the selected date
      const { data: actualOrders, error: actError } = await supabase
        .from("orders")
        .select(
          `
          *,
          user:profiles!orders_user_id_fkey(*),
          order_items (
            *,
            product:products(*)
          )
        `
        )
        .eq("date", format(selectedDate, "yyyy-MM-dd"))
        .eq("user.role", "mobil");

      if (actError) throw actError;

      // Create comparison data
      const comparison =
        favoriteOrders?.map((favOrder) => {
          const actualOrder = actualOrders?.find(
            (actOrder) => actOrder.user_id === favOrder.user_id
          );

          return {
            userId: favOrder.user_id,
            userName: favOrder.user?.full_name,
            userPhone: favOrder.user?.phone,
            scheduled: favOrder,
            actual: actualOrder,
            status: actualOrder ? "created" : "missing",
            scheduledItems: favOrder.favorite_items || [],
            actualItems: actualOrder?.order_items || [],
            scheduledTotal:
              favOrder.favorite_items?.reduce(
                (sum: number, item: FavoriteItem) => {
                  const price =
                    item.price && item.price > 0
                      ? item.price
                      : item.product.priceMobil;
                  return sum + item.quantity * price;
                },
                0
              ) || 0,
            actualTotal: actualOrder?.total || 0,
          };
        }) || [];

      return comparison;
    },
    enabled: !!selectedDate && selectedDay !== "all",
  });
};

// Comparison component
function OrdersComparisonTable({ comparisonData }: { comparisonData: any[] }) {
  if (!comparisonData.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No comparison data available for the selected date and day.
      </div>
    );
  }

  const createdCount = comparisonData.filter(
    (item) => item.status === "created"
  ).length;
  const missingCount = comparisonData.filter(
    (item) => item.status === "missing"
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 border-green-200"
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          {createdCount} Created
        </Badge>
        <Badge
          variant="outline"
          className="bg-red-50 text-red-700 border-red-200"
        >
          <XCircle className="h-4 w-4 mr-1" />
          {missingCount} Missing
        </Badge>
        <Badge
          variant="outline"
          className="bg-orange-50 text-orange-700 border-orange-200"
        >
          <AlertCircle className="h-4 w-4 mr-1" />
          {comparisonData.length} Total Scheduled
        </Badge>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Scheduled Items</TableHead>
              <TableHead>Actual Items</TableHead>
              <TableHead>Scheduled Total</TableHead>
              <TableHead>Actual Total</TableHead>
              <TableHead>Difference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparisonData.map((item) => (
              <TableRow key={item.userId}>
                <TableCell className="font-medium">{item.userName}</TableCell>
                <TableCell>{item.userPhone}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      item.status === "created" ? "default" : "destructive"
                    }
                    className={
                      item.status === "created" ? "bg-green-600" : "bg-red-600"
                    }
                  >
                    {item.status === "created" ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Created
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 mr-1" />
                        Missing
                      </>
                    )}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {item.scheduledItems.length} items
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{item.actualItems.length} items</div>
                </TableCell>
                <TableCell className="text-right">
                  {item.scheduledTotal.toFixed(2)} Kč
                </TableCell>
                <TableCell className="text-right">
                  {item.actualTotal.toFixed(2)} Kč
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={cn(
                      "font-medium",
                      item.actualTotal > item.scheduledTotal
                        ? "text-green-600"
                        : item.actualTotal < item.scheduledTotal
                          ? "text-red-600"
                          : "text-gray-600"
                    )}
                  >
                    {item.status === "created"
                      ? `${(item.actualTotal - item.scheduledTotal).toFixed(2)} Kč`
                      : "-"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function FavoriteOrdersTable({
  selectedProductId: initialProductId,
}: FavoriteOrdersTableProps) {
  const { toast } = useToast();

  const { data: orders, error, isLoading } = useFavoriteOrders();
  const { data: products } = fetchActiveProducts();

  const user = useAuthStore((state) => state.user);
  const [date, setDate] = useState<Date>();
  const [selectedProductId, setSelectedProductId] = useState(
    initialProductId || ""
  );
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const [userNameFilter, setUserNameFilter] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<Set<number>>(new Set());
  const [roleFilter, setRoleFilter] = useState<string>("store_admin");
  const [driverFilter, setDriverFilter] = useState<string>("all");
  const [isCreating, setIsCreating] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const { mutateAsync: insertOrder } = useInsertOrder();
  const { mutateAsync: insertOrderItems } = useInsertOrderItems();

  // Use the comparison hook
  const { data: comparisonData, isLoading: isLoadingComparison } =
    useOrdersComparison(date, selectedDay);

  if (isLoading) return <div>Loading orders...</div>;
  if (error) return <div>Error loading orders: {error.message}</div>;
  if (!orders) return <div>No orders found</div>;

  const filteredOrders = orders.filter((order) => {
    // First filter by selected day
    if (selectedDay !== "all" && !order.days?.includes(selectedDay))
      return false;

    // Then filter by role
    if (roleFilter !== "all" && roleFilter !== "store_admin") {
      if (order.user?.role !== roleFilter) return false;
    } else if (roleFilter === "store_admin") {
      if (order.user?.role !== "store" && order.user?.role !== "admin")
        return false;
    }

    // Then filter by selected product
    if (selectedProductId && selectedProductId !== "all") {
      if (
        !order.favorite_items?.some(
          (item: FavoriteItem) =>
            item.product_id.toString() === selectedProductId
        )
      )
        return false;
    }

    // Finally filter by user name
    if (userNameFilter) {
      const userName = order.user?.full_name?.toLowerCase() || "";
      const userPhone = order.user?.phone?.toLowerCase() || "";
      if (
        !userName.includes(userNameFilter.toLowerCase()) &&
        !userPhone.includes(userNameFilter.toLowerCase())
      ) {
        return false;
      }
    }

    // Add driver filter
    if (driverFilter !== "all") {
      if (driverFilter === "none") {
        if (order.driver_id) return false;
      } else if (order.driver?.id !== driverFilter) {
        return false;
      }
    }

    return true;
  });

  const createOrdersFromFavorites = async () => {
    setIsCreating(true);
    try {
      if (!date) {
        toast({
          title: "Error",
          description: "Please select a date for the orders",
          variant: "destructive",
        });
        return;
      }

      const ordersToCreate = filteredOrders.filter((order) =>
        selectedOrders.has(order.id)
      );

      if (ordersToCreate.length === 0) {
        toast({
          title: "Warning",
          description: "No orders selected",
          variant: "destructive",
        });
        return;
      }

      for (const favoriteOrder of ordersToCreate) {
        if (!favoriteOrder.favorite_items?.length) {
          console.log(
            `Skipping order for user ${favoriteOrder.user_id} - no items`
          );
          continue;
        }

        const userRole = favoriteOrder.user?.role;
        const userId = favoriteOrder.user_id;
        const paidBy = favoriteOrder.user?.paid_by;

        const total = favoriteOrder.favorite_items.reduce(
          (sum: number, item: FavoriteItem) => {
            if (item.price && item.price > 0) {
              return sum + item.quantity * item.price;
            }
            const price =
              userRole === "mobil"
                ? item.product.priceMobil
                : userRole === "store" ||
                    userRole === "buyer" ||
                    userRole === "admin"
                  ? item.product.priceBuyer
                  : item.product.price;
            return sum + item.quantity * price;
          },
          0
        );

        const newOrder = await insertOrder({
          user_id: userId,
          date: new Date(format(date, "yyyy-MM-dd")),
          status: "Pre-order",
          total: total,
          note: favoriteOrder.note || "",
          paid_by: paidBy || userId,
          driver_id: favoriteOrder.driver_id,
        });

        const orderItems = favoriteOrder.favorite_items.map(
          (item: FavoriteItem) => ({
            order_id: newOrder.id,
            product_id: item.product_id,
            quantity: item.quantity,
            price:
              item.price && item.price > 0
                ? item.price
                : userRole === "mobil"
                  ? item.product.priceMobil
                  : userRole === "store" ||
                      userRole === "buyer" ||
                      userRole === "admin"
                    ? item.product.priceBuyer
                    : item.product.price,
          })
        );

        if (orderItems.length > 0) {
          await insertOrderItems(orderItems);
        }
      }

      toast({
        title: "Success",
        description: `Created ${ordersToCreate.length} orders for ${format(date, "PP")}`,
        duration: 3000,
        style: { zIndex: 9999 },
      });
    } catch (error) {
      console.error("Error creating orders:", error);
      toast({
        title: "Error",
        description: "Failed to create orders",
        variant: "destructive",
        duration: 3000,
        style: { zIndex: 9999 },
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Card className="my-0 p-4 print:border-none print:shadow-none print:absolute print:top-0 print:left-0 print:right-0 print:m-0 print:h-auto print:overflow-visible print:transform-none">
        <div className="space-y-4 overflow-x-auto print:!m-0">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {user?.role === "admin" && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CirclePlus className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">
                        Nová stálá objednávka
                      </span>
                      <span className="sm:hidden">Nová</span>
                    </Button>
                  </DialogTrigger>
                  <AddFavoriteOrderDialog />
                </Dialog>
              )}
              <Badge variant="secondary">
                {date
                  ? `${filteredOrders.length} orders`
                  : `${filteredOrders.length} total orders`}
              </Badge>

              {calculateZeroPriceFavoriteOrders(filteredOrders) > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <Badge variant="outline" className="text-red-600">
                          <TriangleAlert size={14} className="mr-1" />
                          {calculateZeroPriceFavoriteOrders(
                            filteredOrders
                          )}{" "}
                          objednávek s nulovou cenou
                        </Badge>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-red-500 text-white border-red-500 max-w-md">
                      <p className="font-semibold mb-2">
                        Oblíbené objednávky s nulovou cenou:
                      </p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {filteredOrders
                          .filter((order) =>
                            order.favorite_items?.some(
                              (item: FavoriteItem) => item.price === 0
                            )
                          )
                          .map((order) => (
                            <div key={order.id} className="text-xs">
                              • {order.user?.full_name} (ID: {order.id}) -{" "}
                              {new Date().toLocaleDateString("cs-CZ")}
                            </div>
                          ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Comparison Toggle Button */}
              {roleFilter === "mobil" && (
                <Button
                  variant={showComparison ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowComparison(!showComparison)}
                  className={
                    showComparison ? "bg-orange-600 hover:bg-orange-700" : ""
                  }
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  {showComparison ? "Hide" : "Show"} Comparison
                </Button>
              )}
            </div>

            <Tabs defaultValue="all" onValueChange={setSelectedDay}>
              <TabsList className="grid grid-cols-9">
                <TabsTrigger value="all">All</TabsTrigger>
                {DAYS.map((day) => (
                  <TabsTrigger key={day} value={day}>
                    {day}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex flex-wrap gap-2 flex-1 min-w-0">
                <div className="flex gap-1">
                  <Button
                    variant={roleFilter === "mobil" ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setRoleFilter(roleFilter === "mobil" ? "all" : "mobil")
                    }
                    className={
                      roleFilter === "mobil"
                        ? "bg-orange-600 text-white hover:bg-orange-700"
                        : ""
                    }
                  >
                    <span className="hidden sm:inline">Mobil</span>
                    <span className="sm:hidden">M</span>
                  </Button>
                  <Button
                    variant={
                      roleFilter === "store_admin" ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() =>
                      setRoleFilter(
                        roleFilter === "store_admin" ? "all" : "store_admin"
                      )
                    }
                    className={
                      roleFilter === "store_admin"
                        ? "bg-orange-600 text-white hover:bg-orange-700"
                        : ""
                    }
                  >
                    <span className="hidden sm:inline">Store/Admin</span>
                    <span className="sm:hidden">S/A</span>
                  </Button>
                  <Button
                    variant={roleFilter === "buyer" ? "default" : "outline"}
                    size="sm"
                    onClick={() =>
                      setRoleFilter(roleFilter === "buyer" ? "all" : "buyer")
                    }
                    className={
                      roleFilter === "buyer"
                        ? "bg-blue-500 text-white hover:bg-blue-600"
                        : "border-blue-300 text-blue-600 hover:bg-blue-50"
                    }
                  >
                    <span className="hidden sm:inline">Odběratel</span>
                    <span className="sm:hidden">O</span>
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 items-center w-full lg:w-auto">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full sm:w-[200px] lg:w-[240px] justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? (
                        <span className="hidden sm:inline">
                          {format(date, "PPP")}
                        </span>
                      ) : (
                        <span className="hidden sm:inline">
                          Datum objednávky
                        </span>
                      )}
                      {date ? (
                        <span className="sm:hidden">
                          {format(date, "dd.MM")}
                        </span>
                      ) : (
                        <span className="sm:hidden">Datum</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(date) => date && setDate(date)}
                      disabled={(date) => {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 4);

                        const twoMonthsFromNow = new Date();
                        twoMonthsFromNow.setMonth(
                          twoMonthsFromNow.getMonth() + 2
                        );

                        return date < yesterday || date > twoMonthsFromNow;
                      }}
                      initialFocus
                      className="rounded-md border"
                      classNames={{
                        day_selected:
                          "bg-orange-800 text-white hover:bg-orange-700 focus:bg-orange-700",
                      }}
                      locale={cs}
                    />
                  </PopoverContent>
                </Popover>

                <Input
                  placeholder="Filter by name or phone..."
                  value={userNameFilter}
                  onChange={(e) => setUserNameFilter(e.target.value)}
                  className="w-full sm:w-auto min-w-[200px]"
                />

                <Button
                  onClick={createOrdersFromFavorites}
                  disabled={!date || selectedOrders.size === 0 || isCreating}
                  className="gap-2 bg-orange-600 text-white w-full sm:w-auto"
                  variant="outline"
                >
                  <CirclePlus
                    className={`h-4 w-4 ${isCreating ? "animate-spin" : ""}`}
                  />
                  <span className="hidden sm:inline">
                    {isCreating
                      ? "Creating..."
                      : `Create Orders (${selectedOrders.size})`}
                  </span>
                  <span className="sm:hidden">
                    {isCreating ? "..." : `${selectedOrders.size}`}
                  </span>
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Select
                value={selectedProductId}
                onValueChange={setSelectedProductId}
              >
                <SelectTrigger className="w-full sm:w-[200px] lg:w-[300px]">
                  <SelectValue placeholder="Filter by product..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {products?.map((product) => (
                    <SelectItem key={product.id} value={product.id.toString()}>
                      <div className="flex justify-between items-center w-full">
                        <span className="mr-2 truncate">{product.name}</span>
                        <Badge variant="outline">
                          {
                            filteredOrders.filter((order) =>
                              order.favorite_items?.some(
                                (item: FavoriteItem) =>
                                  item.product_id.toString() ===
                                  product.id.toString()
                              )
                            ).length
                          }{" "}
                          orders
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role === "all"
                        ? "All roles"
                        : role.charAt(0).toUpperCase() + role.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={driverFilter} onValueChange={setDriverFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Filter by driver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All drivers</SelectItem>
                  <SelectItem value="none">No driver</SelectItem>
                  {Array.from(
                    new Set(
                      orders?.map((order) => order.driver?.id).filter(Boolean)
                    )
                  ).map((driverId) => {
                    const driver = orders?.find(
                      (o) => o.driver?.id === driverId
                    )?.driver;
                    return (
                      <SelectItem key={driverId} value={driverId}>
                        {driver?.full_name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Comparison Table */}
          {showComparison && roleFilter === "mobil" && (
            <Card className="p-4 border-orange-200 bg-orange-50">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-orange-600" />
                <h3 className="text-lg font-semibold text-orange-800">
                  Orders Comparison -{" "}
                  {date ? format(date, "PP", { locale: cs }) : "Select Date"}
                </h3>
              </div>
              {isLoadingComparison ? (
                <div className="text-center py-4">
                  Loading comparison data...
                </div>
              ) : (
                <OrdersComparisonTable comparisonData={comparisonData || []} />
              )}
            </Card>
          )}

          <FavoriteOrderTableContent
            data={filteredOrders}
            columns={columns}
            setSelectedOrderId={setSelectedOrderId}
            selectedOrders={selectedOrders}
            setSelectedOrders={setSelectedOrders}
          />
        </div>
      </Card>

      <FavoriteDetailsDialog
        favoriteOrderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
      />
    </>
  );
}
