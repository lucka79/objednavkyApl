import React, { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
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

import { Card } from "./ui/card";

import { fetchAllProducts, useUpdateProduct } from "@/hooks/useProducts";
import { Product } from "../../types";
import { useProductStore } from "@/providers/productStore";
import { useNavigate } from "@tanstack/react-router";
import { fetchCategories } from "@/hooks/useCategories";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";

type Row = {
  original: Product;
};

export function ProductsTable() {
  const { data: products, error, isLoading } = fetchAllProducts();
  const { data: categories } = fetchCategories();
  const { mutateAsync: updateProduct } = useUpdateProduct();

  const handleActiveChange = async (itemId: number, checked: boolean) => {
    console.log("Checkbox clicked:", { itemId, checked });
    try {
      await updateProduct({
        id: itemId,
        active: checked,
      });
      console.log("Product updated successfully");
    } catch (error) {
      console.error("Failed to update item check status:", error);
      toast({
        title: "Error",
        description: "Failed to update item status",
        variant: "destructive",
      });
    }
  };

  const handleStoreChange = async (itemId: number, checked: boolean) => {
    try {
      await updateProduct({
        id: itemId,
        store: checked,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update store status",
        variant: "destructive",
      });
    }
  };

  const columns = useMemo(
    () => [
      {
        accessorKey: "id",
        header: "ID",
      },
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        accessorKey: "priceBuyer",
        header: () => <div className="text-right">NákupBez</div>,
        cell: ({ row }: { row: Row }) => (
          <div className="text-right">
            {row.original.priceBuyer.toFixed(2)} Kč
          </div>
        ),
      },
      {
        accessorKey: "priceMobil",
        header: () => <div className="text-right">Mobil</div>,
        cell: ({ row }: { row: Row }) => (
          <div className="text-right">
            {row.original.priceMobil.toFixed(2)} Kč
          </div>
        ),
      },
      {
        accessorKey: "price",
        header: () => <div className="text-right">Prodej</div>,
        cell: ({ row }: { row: Row }) => (
          <div className="text-right">{row.original.price.toFixed(2)} Kč</div>
        ),
      },

      {
        accessorKey: "category_id",
        header: "Category",
        cell: ({ row }: { row: Row }) => {
          const category = categories?.find(
            (c) => c.id === row.original.category_id
          );
          return category?.name || "N/A";
        },
      },
      {
        accessorKey: "active",
        header: "Active",
        cell: ({ row }: { row: Row }) => {
          const isActive = row.original.active;
          return (
            <div className="flex items-center justify-center">
              <Checkbox
                checked={isActive}
                onCheckedChange={(checked) =>
                  handleActiveChange(row.original.id, checked as boolean)
                }
                className="mr-2 border-amber-500 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 data-[state=checked]:text-white"
              />
            </div>
          );
        },
      },
      {
        accessorKey: "store",
        header: "Store",
        cell: ({ row }: { row: Row }) => {
          const isInStore = row.original.store;
          return (
            <div className="flex items-center justify-center">
              <Checkbox
                checked={isInStore}
                onCheckedChange={(checked) =>
                  handleStoreChange(row.original.id, checked as boolean)
                }
                className="mr-2 border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 data-[state=checked]:text-white"
              />
            </div>
          );
        },
      },
    ],
    []
  );

  const [globalFilter, setGlobalFilter] = useState("");
  const setSelectedProductId = useProductStore(
    (state) => state.setSelectedProductId
  );
  //   const category = categories?.find((c) => c.id === products.category_id);
  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priceFilter, setPriceFilter] = useState<string>("all");
  // const queryClient = useQueryClient();

  const handleCreateProduct = () => {
    setSelectedProductId(null);
    navigate({ to: "/admin/create" });
  };

  //   const openOrderDetails = (orderId: number) => {
  //     window.open(`/admin/orders/${orderId}`, "_blank");
  //   };

  const filteredProducts = React.useMemo(() => {
    return (
      products?.filter(
        (product) =>
          (priceFilter === "all" ||
            (priceFilter === "mobile" && product.priceMobil > 0)) &&
          (categoryFilter === "all" ||
            product.category_id.toString() === categoryFilter) &&
          Object.values(product).some(
            (value) =>
              value &&
              value
                .toString()
                .toLowerCase()
                .includes(globalFilter.toLowerCase())
          )
      ) || []
    );
  }, [products, categoryFilter, globalFilter, priceFilter]);

  const table = useReactTable({
    data: filteredProducts,
    columns: columns,
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
    <>
      <Card className="my-0 p-4">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  {categories?.map((category) => (
                    <TabsTrigger
                      key={category.id}
                      value={category.id.toString()}
                    >
                      {category.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            <div>
              <Button variant="outline" onClick={handleCreateProduct}>
                Create Product
              </Button>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <Input
              placeholder="Search product..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="max-w-sm"
            />

            <Select value={priceFilter} onValueChange={setPriceFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by price" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Prices</SelectItem>
                <SelectItem value="mobile">Mobile Price {">"} 0</SelectItem>
              </SelectContent>
            </Select>
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
                      {/* <FileSearch2
                        className="cursor-pointer hover:bg-muted/50"
                        size={20}
                        onClick={() => setSelectedOrderId(row.original.id)}
                      /> */}
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
    </>
  );
}
