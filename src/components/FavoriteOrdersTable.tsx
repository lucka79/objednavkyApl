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
// import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cs } from "date-fns/locale";

const DAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne", "X"] as const;
const ROLES = [
  "all",
  "user",
  "buyer",
  "driver",
  "store",
  "mobil",
  "expedition",
] as const;

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
    accessorKey: "user.note",
    header: "Poznámka",
    cell: ({ row }) => (
      <div className="text-left">{row.original.user?.note || "—"}</div>
    ),
  },
  {
    accessorKey: "user.role",
    header: "Typ",
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
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [driverFilter, setDriverFilter] = useState<string>("all");
  const [isCreating, setIsCreating] = useState(false);

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

    // Then filter by role
    if (roleFilter !== "all" && order.user?.role !== roleFilter) return false;

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
                : userRole === "store" || userRole === "buyer"
                  ? item.product.priceBuyer
                  : item.product.price;
            return sum + item.quantity * price;
          },
          0
        );

        // Create new order directly without checking for duplicates
        const newOrder = await insertOrder({
          user_id: userId,
          date: new Date(format(date, "yyyy-MM-dd")),
          status: "Pre-order",
          total: total,
          note: favoriteOrder.note || "",
          paid_by: paidBy || userId,
          driver_id: favoriteOrder.driver_id,
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
                  : userRole === "store" || userRole === "buyer"
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
              <TabsList className="grid grid-cols-9">
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
                  placeholder="Filter by name or phone..."
                  value={userNameFilter}
                  onChange={(e) => setUserNameFilter(e.target.value)}
                  className="max-w-xs"
                />
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[150px]">
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
                  <SelectTrigger className="w-[150px]">
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
                <Button
                  onClick={createOrdersFromFavorites}
                  disabled={!date || selectedOrders.size === 0 || isCreating}
                  className="gap-2 bg-orange-600 text-white"
                  variant="outline"
                >
                  <CirclePlus
                    className={`h-4 w-4 ${isCreating ? "animate-spin" : ""}`}
                  />
                  {isCreating
                    ? "Creating..."
                    : `Create Orders (${selectedOrders.size})`}
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
