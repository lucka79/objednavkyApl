import React, { useRef } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader } from "@/components/ui/table";
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
import { useVirtualizer } from "@tanstack/react-virtual";
import { memo } from "react";
import { useAuthStore } from "@/lib/supabase";

const ProductRow = memo(
  ({ product, onEdit }: { product: Product; onEdit: (id: number) => void }) => {
    const { data: categories } = fetchCategories();
    const user = useAuthStore((state) => state.user);
    const { mutateAsync: updateProduct } = useUpdateProduct();
    const categoryName =
      categories?.find((c) => c.id === product.category_id)?.name || "N/A";

    const handleCheckboxChange = async (field: string, checked: boolean) => {
      try {
        await updateProduct({
          id: product.id,
          [field]: checked,
        });
      } catch (error) {
        toast({
          title: "Error",
          description: `Failed to update ${field}`,
          variant: "destructive",
        });
      }
    };

    return (
      <div className="grid grid-cols-[100px_200px_100px_100px_100px_130px_80px_80px_80px_80px_100px] gap-4 py-2 px-4 items-center border-b">
        <div>{product.code}</div>
        <div>{product.name}</div>
        <div className="text-right">{product.priceBuyer.toFixed(2)} Kč</div>
        <div className="text-right">{product.priceMobil.toFixed(2)} Kč</div>
        <div className="text-right">{product.price.toFixed(2)} Kč</div>
        <div>{categoryName}</div>
        <div className="text-right">{product.vat}%</div>
        <div className="flex justify-center">
          <Checkbox
            checked={product.active}
            onCheckedChange={(checked) =>
              handleCheckboxChange("active", checked as boolean)
            }
            className="border-amber-500 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 data-[state=checked]:text-white"
          />
        </div>
        <div className="flex justify-center">
          <Checkbox
            checked={product.buyer}
            onCheckedChange={(checked) =>
              handleCheckboxChange("buyer", checked as boolean)
            }
            className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 data-[state=checked]:text-white"
          />
        </div>
        <div className="flex justify-center">
          <Checkbox
            checked={product.store}
            onCheckedChange={(checked) =>
              handleCheckboxChange("store", checked as boolean)
            }
            className="border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 data-[state=checked]:text-white"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onEdit(product.id)}>
            <FilePenLine className="h-4 w-4" />
          </Button>
          {user?.role === "admin" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:text-destructive"
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
                    onClick={() => deleteProduct(product.id)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Smazat
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    );
  }
);

export function ProductsTable() {
  const { data: products, error, isLoading } = fetchAllProducts();
  const { data: categories } = fetchCategories();
  // const { mutateAsync: updateProduct } = useUpdateProduct();

  // const [sorting, setSorting] = useState<SortingState>([]);

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

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const onSelectCategory = (categoryId: number | null) => {
    setSelectedCategory(categoryId);
    setCategoryFilter(categoryId ? categoryId.toString() : "all");
  };

  // Add state for categories visibility
  const [showAllCategories, setShowAllCategories] = useState(false);

  // 4. Add virtualization
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredProducts?.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 5,
  });

  const handleEdit = (id: number) => {
    setEditProductId(id);
    setShowEditDialog(true);
  };

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
        <div
          ref={parentRef}
          className="border rounded-md h-[calc(100vh-200px)] overflow-auto"
        >
          <Table>
            <TableHeader>
              <div className="grid grid-cols-[100px_200px_100px_100px_100px_130px_80px_80px_80px_80px_100px] gap-4 py-2 px-4 font-medium">
                <div>Kód</div>
                <div>Name</div>
                <div className="text-right">NákupBez</div>
                <div className="text-right">Mobil</div>
                <div className="text-right">Prodej</div>
                <div>Category</div>
                <div className="text-right">DPH</div>
                <div className="text-center">Active</div>
                <div className="text-center">Odběr</div>
                <div className="text-center">Store</div>
                <div className="text-right">Actions</div>
              </div>
            </TableHeader>
          </Table>

          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const product = filteredProducts[virtualRow.index];
              return (
                <div
                  key={product.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <ProductRow product={product} onEdit={handleEdit} />
                </div>
              );
            })}
          </div>
        </div>

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
