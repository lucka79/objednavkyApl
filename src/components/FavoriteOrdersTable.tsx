import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
} from "@tanstack/react-table";
// import { fetchAllOrders } from "@/hooks/useOrders";
import { FavoriteOrder, Order } from "../../types";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchAllProducts } from "@/hooks/useProducts";
import { useFavoriteOrders } from "@/hooks/useFavorites";

const DAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"] as const;

const columns: ColumnDef<FavoriteOrder>[] = [
  {
    accessorKey: "day",
    header: () => <div className="w-16 text-left">Den</div>,
    cell: ({ row }) => <div className="w-18 text-left">{row.original.day}</div>,
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
      return (
        <div className="text-right flex justify-end gap-2 items-center">
          <Badge variant="secondary">{itemCount} items</Badge>
          <Badge variant="outline">{row.original.status}</Badge>
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
  const { data: orders, error, isLoading } = useFavoriteOrders();
  const [date, setDate] = useState<Date>();
  const [selectedProductId, setSelectedProductId] = useState(
    initialProductId || ""
  );
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const { data: products } = fetchAllProducts();
  const [selectedDay, setSelectedDay] = useState<string>("all");

  if (isLoading) return <div>Loading orders...</div>;
  if (error) return <div>Error loading orders: {error.message}</div>;
  if (!orders) return <div>No orders found</div>;

  const filteredOrders = orders.filter((order) => {
    if (selectedDay === "all") return true;
    return order.day === selectedDay;
  });

  return (
    <Card className="my-0 p-4 print:border-none print:shadow-none print:absolute print:top-0 print:left-0 print:right-0 print:m-0 print:h-auto print:overflow-visible print:transform-none">
      <div className="space-y-4 overflow-x-auto print:!m-0">
        <div className="space-y-2">
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
                  <SelectItem key={product.id} value={product.id.toString()}>
                    <div className="flex justify-between items-center w-full">
                      <span className="mr-2">{product.name}</span>
                      <Badge variant="outline">
                        {
                          filteredOrders.filter((order) =>
                            order.favorite_items?.some(
                              (item) =>
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
            <Badge variant="secondary">
              {date
                ? `${filteredOrders.length} orders`
                : `${filteredOrders.length} total orders`}
            </Badge>
          </div>
        </div>

        <FavoriteOrderTableContent
          data={filteredOrders}
          columns={columns}
          setSelectedOrderId={setSelectedOrderId}
        />
      </div>
    </Card>
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
