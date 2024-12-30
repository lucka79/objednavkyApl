import React, { useEffect, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
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

import {
  deleteProduct,
  fetchAllProducts,
  useUpdateProduct,
} from "@/hooks/useProducts";
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

import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CreateProductForm } from "./CreateProductForm";

import { Card } from "./ui/card";
import {
  CirclePlus,
  Trash2,
  Search,
  FilePenLine,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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
import { ProductDetailsDialog } from "./ProductDetailsDialog";
import { ProductForm } from "./ProductForm";

type Row = {
  original: Product;
};

const PriceCell = ({
  row,
  priceKey,
}: {
  row: Row;
  priceKey: "price" | "priceMobil" | "priceBuyer";
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [price, setPrice] = useState<number>(row.original[priceKey]);
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

  // Reset price when row data changes
  useEffect(() => {
    setPrice(row.original[priceKey]);
  }, [row.original[priceKey]]);

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

  const handleBuyerChange = async (itemId: number, checked: boolean) => {
    try {
      await updateProduct({
        id: itemId,
        buyer: checked,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update store status",
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
        accessorKey: "code",
        header: "Kód",
      },
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        accessorKey: "priceBuyer",
        header: () => <div className="text-right">NákupBez</div>,
        cell: ({ row }: { row: Row }) => (
          <PriceCell row={row} priceKey="priceBuyer" />
        ),
      },
      {
        accessorKey: "priceMobil",
        header: () => <div className="text-right">Mobil</div>,
        cell: ({ row }: { row: Row }) => (
          <PriceCell row={row} priceKey="priceMobil" />
        ),
      },
      {
        accessorKey: "price",
        header: () => <div className="text-right">Prodej</div>,
        cell: ({ row }: { row: Row }) => (
          <PriceCell row={row} priceKey="price" />
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
                {categories?.find(
                  (c: { id: number; name: string }) =>
                    c.id === row.original.category_id
                )?.name || "N/A"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {categories?.map((category: { id: number; name: string }) => (
                <SelectItem key={category.id} value={category.id.toString()}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
        sortingFn: (rowA: Row, rowB: Row) => {
          const catA =
            categories?.find(
              (c: { id: number; name: string }) =>
                c.id === rowA.original.category_id
            )?.name || "";
          const catB =
            categories?.find(
              (c: { id: number; name: string }) =>
                c.id === rowB.original.category_id
            )?.name || "";
          return catA.localeCompare(catB);
        },
      },
      {
        accessorKey: "vat",
        header: () => <div className="text-right">DPH</div>,
        cell: ({ row }: { row: Row }) => (
          <div className="text-right">{row.original.vat}%</div>
        ),
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
        accessorKey: "buyer",
        header: "Odběr",
        cell: ({ row }: { row: Row }) => {
          const isBuyer = row.original.buyer;
          return (
            <div className="flex items-center justify-center">
              <Checkbox
                checked={isBuyer}
                onCheckedChange={(checked) =>
                  handleBuyerChange(row.original.id, checked as boolean)
                }
                className="mr-2 border-amber-500 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 data-[state=checked]:text-white"
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
      {
        id: "actions",
        cell: ({ row }: { row: Row }) => {
          const product = row.original;

          return (
            <div
              className="flex justify-end gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-500"
                onClick={() => setSelectedProductId(product.id)}
              >
                <Search className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-orange-500"
                onClick={() => {
                  setEditProductId(product.id);
                  setShowEditDialog(true);
                }}
              >
                <FilePenLine className="h-4 w-4" />
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
                      Opravdu smazat tento výrobek?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Tato akce je nevratná. Výrobek bude trvale odstraněn.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Zrušit</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        try {
                          await deleteProduct(product.id);
                          toast({
                            title: "Success",
                            description: "Product deleted successfully",
                          });
                        } catch (error) {
                          console.error("Failed to delete product:", error);
                          toast({
                            title: "Error",
                            description: "Failed to delete product",
                            variant: "destructive",
                          });
                        }
                      }}
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
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editProductId, setEditProductId] = useState<number | undefined>(
    undefined
  );

  const handleCreateProduct = () => {
    setShowCreateDialog(true);
  };

  //   const openOrderDetails = (orderId: number) => {
  //     window.open(`/admin/orders/${orderId}`, "_blank");
  //   };

  const filteredProducts = React.useMemo(() => {
    return (
      products?.filter(
        (product: Product) =>
          (priceFilter === "all" ||
            (priceFilter === "mobile" && product.priceMobil > 0)) &&
          (categoryFilter === "all" ||
            (product.category_id ?? 0).toString() === categoryFilter) &&
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
    getSortedRowModel: getSortedRowModel(),
    state: {
      globalFilter,
      sorting,
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
  });

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const onSelectCategory = (categoryId: number | null) => {
    setSelectedCategory(categoryId);
    setCategoryFilter(categoryId ? categoryId.toString() : "all");
  };

  // Add state for categories visibility
  const [showAllCategories, setShowAllCategories] = useState(false);

  if (isLoading) return <div>Loading orders...</div>;
  if (error) return <div>Error loading orders</div>;

  return (
    <>
      <Card className="p-4">
        <div className="mx-auto p-2">
          <div className="w-full rounded-md border p-2">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className={`w-32 hover:border-orange-500 ${
                    selectedCategory === null ? "bg-orange-500 text-white" : ""
                  }`}
                  onClick={() => onSelectCategory(null)}
                >
                  Vše
                </Button>
                {(categories ?? [])
                  .slice(
                    0,
                    showAllCategories
                      ? undefined
                      : Math.ceil((categories?.length ?? 0) / 2) * 2
                  )
                  .map((category) => (
                    <Button
                      key={category.id}
                      variant="outline"
                      className={`w-32 hover:border-orange-500 ${
                        selectedCategory === category.id
                          ? "bg-orange-500 text-white"
                          : ""
                      }`}
                      onClick={() => onSelectCategory(category.id)}
                    >
                      {category.name}
                    </Button>
                  ))}
              </div>

              {(categories?.length ?? 0) >
                Math.ceil((categories?.length ?? 0) / 2) * 2 && (
                <Button
                  variant="ghost"
                  className="w-full h-6"
                  onClick={() => setShowAllCategories(!showAllCategories)}
                >
                  {showAllCategories ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
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

            <Button
              className="bg-orange-500 text-white"
              variant="outline"
              onClick={handleCreateProduct}
            >
              <CirclePlus className="h-4 w-4 mr-2" /> Nový výrobek
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
                <TableRow key={row.id} className="hover:bg-muted/50">
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

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="p-0 border-none">
            <CreateProductForm />
          </DialogContent>
        </Dialog>

        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="p-0">
            <ProductForm
              productId={editProductId}
              onClose={() => {
                setShowEditDialog(false);
                setSelectedProductId(null);
                setEditProductId(undefined);
              }}
            />
          </DialogContent>
        </Dialog>
      </Card>
      <ProductDetailsDialog />
    </>
  );
}
