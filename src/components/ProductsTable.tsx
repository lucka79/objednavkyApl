import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  flexRender,
} from "@tanstack/react-table";
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
import { useState } from "react";
import { FileSearch2 } from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { fetchAllProducts } from "@/hooks/useProducts";
import { Product } from "../../types";
import { useProductStore } from "@/providers/productStore";
import { useNavigate } from "@tanstack/react-router";
import { fetchCategories } from "@/hooks/useCategories";

const columns: ColumnDef<Product>[] = [
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
  },
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "price",
    header: "Price",
    // cell: ({ row }) => `$${row.original.price.toFixed(2)}`,
  },
  {
    accessorKey: "priceMobil",
    header: "Price Mobile",
  },
  {
    accessorKey: "category_id",
    header: "Category",
    cell: ({ row }) => {
      const category = categories?.find(
        (c) => c.id === row.original.category_id
      );
      return category?.name || "N/A";
    },
  },
];

export function ProductsTable() {
  const { data: products, error, isLoading } = fetchAllProducts();
  const { data: categories } = fetchCategories();

  const [globalFilter, setGlobalFilter] = useState("");
  const setSelectedProductId = useProductStore(
    (state) => state.setSelectedProductId
  );
  //   const category = categories?.find((c) => c.id === products.category_id);
  const navigate = useNavigate();

  const handleCreateProduct = () => {
    setSelectedProductId(null);
    navigate({ to: "/admin/create" });
  };

  //   const openOrderDetails = (orderId: number) => {
  //     window.open(`/admin/orders/${orderId}`, "_blank");
  //   };

  const table = useReactTable({
    data: products || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  });

  if (isLoading) return <div>Loading orders...</div>;
  if (error) return <div>Error loading orders</div>;

  return (
    <Card className="my-0 p-4">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Input
            placeholder="Search product..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-sm"
          />
          <Button variant="outline" onClick={handleCreateProduct}>
            Create Product
          </Button>
        </div>
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
                  onClick={() => setSelectedProductId(row.original.id)}
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
                  <div className="flex mt-2 self-center gap-2">
                    {/* <Badge variant="outline">{row.original.status}</Badge> */}
                    <FileSearch2
                      className="cursor-pointer hover:bg-muted/50"
                      size={20}
                      // onClick={() => setSelectedOrderId(row.original.id)}
                      //   onClick={() => openOrderDetails(row.original.id)}
                    />
                  </div>
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
      </div>
    </Card>
  );
}
