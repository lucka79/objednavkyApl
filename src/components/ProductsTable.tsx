import React, { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  getSortedRowModel,
  SortingState,
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

import { fetchAllProducts, useUpdateProduct } from "@/hooks/useProducts";
import { Product } from "../../types";
import { useProductStore } from "@/providers/productStore";
// import { useNavigate } from "@tanstack/react-router";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CreateProductForm } from "./CreateProductForm";

type Row = {
  original: Product;
};

const PriceCell = ({
  row,
  priceKey,
  // header,
}: {
  row: Row;
  priceKey: "price" | "priceMobil" | "priceBuyer";
  header: string;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [price, setPrice] = useState(row.original[priceKey]);
  const { mutateAsync: updateProduct } = useUpdateProduct();

  const handlePriceChange = async (newPrice: number) => {
    try {
      await updateProduct({
        id: row.original.id,
        [priceKey]: newPrice,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update price:", error);
      toast({
        title: "Error",
        description: "Failed to update price",
        variant: "destructive",
      });
    }
  };

  return isEditing ? (
    <Input
      type="number"
      step="0.01"
      value={price}
      onChange={(e) => setPrice(Number(e.target.value))}
      onBlur={() => handlePriceChange(price)}
      onKeyDown={(e) => {
        if (e.key === "Enter") handlePriceChange(price);
        if (e.key === "Escape") {
          setIsEditing(false);
          setPrice(row.original[priceKey]);
        }
      }}
      className="w-24 text-right"
      autoFocus
    />
  ) : (
    <div
      className="text-right cursor-pointer hover:bg-muted/50"
      onClick={() => setIsEditing(true)}
    >
      {row.original[priceKey].toFixed(2)} Kč
    </div>
  );
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

  const [sorting, setSorting] = useState<SortingState>([]);

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
          <PriceCell row={row} priceKey="priceBuyer" header="NákupBez" />
        ),
      },
      {
        accessorKey: "priceMobil",
        header: () => <div className="text-right">Mobil</div>,
        cell: ({ row }: { row: Row }) => (
          <PriceCell row={row} priceKey="priceMobil" header="Mobil" />
        ),
      },
      {
        accessorKey: "price",
        header: () => <div className="text-right">Prodej</div>,
        cell: ({ row }: { row: Row }) => (
          <PriceCell row={row} priceKey="price" header="Prodej" />
        ),
      },

      {
        accessorKey: "category_id",
        header: "Category",
        cell: ({ row }: { row: Row }) => (
          <Select
            value={(row.original.category_id ?? 0).toString()}
            onValueChange={(newValue: string) => {
              updateProduct({
                id: row.original.id,
                category_id: parseInt(newValue),
              }).catch(() => {
                toast({
                  title: "Error",
                  description: "Failed to update category",
                  variant: "destructive",
                });
              });
            }}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue>
                {categories?.find((c) => c.id === row.original.category_id)
                  ?.name || "N/A"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {categories?.map((category) => (
                <SelectItem key={category.id} value={category.id.toString()}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
        sortingFn: (rowA: Row, rowB: Row) => {
          const catA =
            categories?.find((c) => c.id === rowA.original.category_id)?.name ||
            "";
          const catB =
            categories?.find((c) => c.id === rowB.original.category_id)?.name ||
            "";
          return catA.localeCompare(catB);
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
    [categories]
  );

  const [globalFilter, setGlobalFilter] = useState("");
  const setSelectedProductId = useProductStore(
    (state) => state.setSelectedProductId
  );
  //   const category = categories?.find((c) => c.id === products.category_id);
  // const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priceFilter, setPriceFilter] = useState<string>("all");
  // const queryClient = useQueryClient();

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleCreateProduct = () => {
    setShowCreateDialog(true);
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
    getSortedRowModel: getSortedRowModel(),
    state: {
      globalFilter,
      sorting,
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
  });

  if (isLoading) return <div>Loading orders...</div>;
  if (error) return <div>Error loading orders</div>;

  return (
    <>
      <div className="flex justify-between items-center">
        <div>
          <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              {categories?.map((category) => (
                <TabsTrigger key={category.id} value={category.id.toString()}>
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>
      <div className="flex justify-between items-center">
        <Input
          placeholder="Search product..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />

        <div className="flex gap-4 items-center">
          <Select value={priceFilter} onValueChange={setPriceFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by price" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Prices</SelectItem>
              <SelectItem value="mobile">Mobile Price {">"} 0</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={handleCreateProduct}>
            Create Product
          </Button>
        </div>
      </div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  className={
                    header.column.getCanSort()
                      ? "cursor-pointer select-none"
                      : ""
                  }
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                  {{
                    asc: " 🔼",
                    desc: " 🔽",
                  }[header.column.getIsSorted() as string] ?? null}
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
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
              <TableCell colSpan={columns.length} className="h-24 text-center">
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

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="p-0 border-none">
          <CreateProductForm />
        </DialogContent>
      </Dialog>
    </>
  );
}
