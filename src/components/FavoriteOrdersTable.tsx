import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  flexRender,
} from "@tanstack/react-table";
// import { fetchAllOrders } from "@/hooks/useOrders";
import { FavoriteOrder } from "../../types";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";

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

import { CirclePlus, Trash2, Lock } from "lucide-react";
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
import { useAuthStore } from "@/lib/supabase";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { useDeleteFavoriteOrder } from "@/hooks/useFavorites";
import { useUpdateStoredItems } from "@/hooks/useFavorites";
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
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";

const DAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"] as const;

interface FavoriteItem {
  product_id: number;
  quantity: number;
  price?: number;
  product: {
    id: number;
    price: number;
    priceMobil: number;
    priceBuyer: number;
  };
}

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
    accessorKey: "status",
    header: () => <div className="text-right">Status</div>,
    cell: ({ row }) => {
      const itemCount = row.original.favorite_items?.length || 0;
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
          <Badge variant="outline">{row.original.status}</Badge>
          <Badge variant="secondary">{itemCount} items</Badge>
        </div>
      );
    },
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

  const { mutateAsync: insertOrder } = useInsertOrder();
  const { mutateAsync: insertOrderItems } = useInsertOrderItems();
  const { mutateAsync: updateStoredItems } = useUpdateStoredItems();

  if (isLoading) return <div>Loading orders...</div>;
  if (error) return <div>Error loading orders: {error.message}</div>;
  if (!orders) return <div>No orders found</div>;

  const filteredOrders = orders.filter((order) => {
    // First filter by selected day
    if (selectedDay !== "all" && !order.days?.includes(selectedDay))
      return false;

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
      if (!userName.includes(userNameFilter.toLowerCase())) return false;
    }

    return true;
  });

  const createOrdersFromFavorites = async () => {
    if (!date) {
      toast({
        title: "Error",
        description: "Please select a date for the orders",
        variant: "destructive",
      });
      return;
    }

    try {
      for (const favoriteOrder of filteredOrders) {
        // Check for existing order
        const { data: existingOrder, error: checkError } = await supabase
          .from("orders")
          .select(
            `
            *,
            user:profiles(full_name)
          `
          )
          .eq("user_id", favoriteOrder.user_id)
          .eq("date", format(date, "yyyy-MM-dd"))
          .maybeSingle();

        if (checkError) throw checkError;

        if (existingOrder) {
          toast({
            title: "Warning",
            description: `Order already exists for ${existingOrder.user?.full_name} on ${format(date, "PP")}`,
            variant: "destructive",
            duration: 3000,
            style: { zIndex: 9999 },
          });
          continue; // Skip this order and continue with the next one
        }

        if (!favoriteOrder.favorite_items?.length) {
          console.log(
            `Skipping order for user ${favoriteOrder.user_id} - no items`
          );
          continue;
        }

        const userRole = favoriteOrder.user?.role;
        const userId = favoriteOrder.user_id;
        const paidBy = favoriteOrder.user?.paid_by;

        // Calculate total using manual prices when available
        const total = favoriteOrder.favorite_items.reduce(
          (sum: number, item: FavoriteItem) => {
            // First check for manual price
            if (item.price && item.price > 0) {
              return sum + item.quantity * item.price;
            }
            // Otherwise use role-based pricing
            const price =
              userRole === "mobil"
                ? item.product.priceMobil
                : userRole === "store"
                  ? item.product.priceBuyer
                  : item.product.price;
            return sum + item.quantity * price;
          },
          0
        );

        console.log("Creating order with paid_by:", {
          userId,
          userRole,
          paidBy,
          userProfile: favoriteOrder.user,
        });

        // Create new order
        const newOrder = await insertOrder({
          user_id: userId,
          date: format(date, "yyyy-MM-dd"),
          status: "Pre-order",
          total: total,
          paid_by: paidBy,
        });

        // Map items using manual prices when available
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
                  : userRole === "store"
                    ? item.product.priceBuyer
                    : item.product.price,
          })
        );

        if (orderItems.length > 0) {
          await insertOrderItems(orderItems);

          // Update stored items for this user
          await updateStoredItems({
            userId,
            items: favoriteOrder.favorite_items.map((item: FavoriteItem) => ({
              product_id: item.product_id,
              quantity: item.quantity,
              increment: true, // Add this flag to indicate we want to increment
            })),
          });
        }
      }

      toast({
        title: "Success",
        description: `Created ${filteredOrders.length} orders for ${format(date, "PP")}`,
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
    }
  };

  return (
    <>
      <Card className="my-0 p-4 print:border-none print:shadow-none print:absolute print:top-0 print:left-0 print:right-0 print:m-0 print:h-auto print:overflow-visible print:transform-none">
        <div className="space-y-4 overflow-x-auto print:!m-0">
          <div className="space-y-2">
            <div>
              {user?.role === "admin" && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CirclePlus className="h-4 w-4 mr-2" />
                      Nová stálá objednávka
                    </Button>
                  </DialogTrigger>
                  <AddFavoriteOrderDialog />
                </Dialog>
              )}
            </div>
            <Tabs defaultValue="all" onValueChange={setSelectedDay}>
              <TabsList className="grid grid-cols-8">
                <TabsTrigger value="all">All</TabsTrigger>
                {DAYS.map((day) => (
                  <TabsTrigger key={day} value={day}>
                    {day}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex justify-between items-center gap-2">
              <div className="flex gap-2 flex-1">
                <Select
                  value={selectedProductId}
                  onValueChange={setSelectedProductId}
                >
                  <SelectTrigger className="w-full max-w-sm">
                    <SelectValue placeholder="Filter by product..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    {products?.map((product) => (
                      <SelectItem
                        key={product.id}
                        value={product.id.toString()}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="mr-2">{product.name}</span>
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
                <Input
                  placeholder="Filter by user name..."
                  value={userNameFilter}
                  onChange={(e) => setUserNameFilter(e.target.value)}
                  className="max-w-xs"
                />
              </div>
              <div className="flex gap-2 items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[240px] justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? (
                        format(date, "PPP")
                      ) : (
                        <span>Datum objednávky</span>
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
                        yesterday.setDate(yesterday.getDate() - 1);

                        const nextMonth = new Date();
                        nextMonth.setMonth(nextMonth.getMonth() + 1, 0);

                        return date < yesterday || date > nextMonth;
                      }}
                      initialFocus
                      className="rounded-md border"
                      classNames={{
                        day_selected:
                          "bg-orange-800 text-white hover:bg-orange-700 focus:bg-orange-700",
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  onClick={createOrdersFromFavorites}
                  disabled={!date || filteredOrders.length === 0}
                  className="gap-2 bg-orange-600 text-white"
                  variant="outline"
                >
                  <CirclePlus className="h-4 w-4" />
                  Create Orders ({filteredOrders.length})
                </Button>
                <Badge variant="secondary">
                  {date
                    ? `${filteredOrders.length} orders`
                    : `${filteredOrders.length} total orders`}
                </Badge>
              </div>
            </div>
          </div>

          <FavoriteOrderTableContent
            data={filteredOrders}
            columns={columns}
            setSelectedOrderId={setSelectedOrderId}
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

// Updated OrderTableContent component
function FavoriteOrderTableContent({
  data,
  columns,
  setSelectedOrderId,
}: {
  data: FavoriteOrder[];
  columns: ColumnDef<FavoriteOrder>[];
  setSelectedOrderId: (id: number) => void;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
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
  );
}
