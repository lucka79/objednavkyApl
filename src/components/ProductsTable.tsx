import React, { useRef } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  ArrowRight,
  Package,
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
import { VerticalNav } from "./VerticalNav";
import { ProductPartsModal } from "./ProductPartsModal";

const ProductRow = memo(
  ({
    product,
    onEdit,
    onOpenParts,
  }: {
    product: Product;
    onEdit: (id: number) => void;
    onOpenParts: (id: number, name: string) => void;
  }) => {
    const { data: categories } = fetchCategories();
    const { data: products } = fetchAllProducts();
    const user = useAuthStore((state) => state.user);
    const { mutateAsync: updateProduct } = useUpdateProduct();
    const categoryName =
      categories?.find((c) => c.id === product.category_id)?.name || "N/A";

    // Calculate count of products with same printId
    const printIdCount =
      !product.isChild && product.printId
        ? products?.filter((p) => p.printId === product.printId).length
        : null;

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
      <div
        className="grid grid-cols-[30px_40px_40px_40px_200px_100px_100px_100px_80px_50px_50px_50px_50px_50px_120px] gap-4 py-2 px-4 items-center border-b text-sm cursor-pointer hover:bg-gray-50"
        onClick={() => onEdit(product.id)}
      >
        <div className="flex justify-center">
          {product.isChild && <ArrowRight className="h-4 w-4 text-gray-400" />}
        </div>
        <div className="text-center">{product.id}</div>
        <div className="text-center">{product.printId}</div>
        <div>{product.code}</div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            {product.name}
            {printIdCount && printIdCount > 1 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                {printIdCount}
              </span>
            )}
          </div>
          {product.nameVi && (
            <p className="text-xs text-orange-500">{product.nameVi}</p>
          )}
        </div>
        <div className="text-right">{product.priceBuyer.toFixed(2)} Kč</div>
        <div className="text-right">{product.priceMobil.toFixed(2)} Kč</div>
        <div className="text-right">{product.price.toFixed(2)} Kč</div>
        <div>{categoryName}</div>
        <div className="text-right">{product.vat}%</div>
        <div className="flex justify-center">
          <Checkbox
            checked={product.active}
            onCheckedChange={(checked) => {
              event?.stopPropagation();
              handleCheckboxChange("active", checked as boolean);
            }}
            className="border-amber-500 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500 data-[state=checked]:text-white"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="flex justify-center">
          <Checkbox
            checked={product.buyer}
            onCheckedChange={(checked) => {
              event?.stopPropagation();
              handleCheckboxChange("buyer", checked as boolean);
            }}
            className="border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 data-[state=checked]:text-white"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="flex justify-center">
          <Checkbox
            checked={product.store}
            onCheckedChange={(checked) => {
              event?.stopPropagation();
              handleCheckboxChange("store", checked as boolean);
            }}
            className="border-blue-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 data-[state=checked]:text-white"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="flex justify-center">
          <Checkbox
            checked={product.isAdmin}
            onCheckedChange={(checked) => {
              event?.stopPropagation();
              handleCheckboxChange("isAdmin", checked as boolean);
            }}
            className="border-purple-500 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500 data-[state=checked]:text-white"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onOpenParts(product.id, product.name);
            }}
            title="Části produktu"
          >
            <Package className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation(); // Prevent row click event
              onEdit(product.id);
            }}
          >
            <FilePenLine className="h-4 w-4" />
          </Button>
          {user?.role === "admin" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:text-destructive"
                  onClick={(e) => e.stopPropagation()}
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
                  <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
                    Zrušit
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProduct(product.id);
                    }}
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

  // Product Parts Modal state
  const [showPartsDialog, setShowPartsDialog] = useState(false);
  const [partsProductId, setPartsProductId] = useState<number | undefined>(
    undefined
  );
  const [partsProductName, setPartsProductName] = useState<string>("");

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

  const handleCategorySelect = (categoryId: number | null) => {
    setSelectedCategory(categoryId);
    setCategoryFilter(categoryId ? categoryId.toString() : "all");
  };

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

  const handleOpenParts = (id: number, name: string) => {
    setPartsProductId(id);
    setPartsProductName(name);
    setShowPartsDialog(true);
  };

  const handleClosePartsDialog = () => {
    setShowPartsDialog(false);
    setPartsProductId(undefined);
    setPartsProductName("");
  };

  if (isLoading) return <div>Loading products...</div>;
  if (error) return <div>Error loading products</div>;

  return (
    <>
      <div className="flex gap-8 h-screen py-2">
        <div className="w-[200px]">
          <VerticalNav
            onCategorySelect={handleCategorySelect}
            selectedCategory={selectedCategory}
          />
        </div>

        <div className="flex-1 pl-[120px]">
          <Card className="h-full p-4">
            <div className="flex justify-start gap-2 items-center mb-2">
              <Input
                placeholder="Search product..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="max-w-sm"
              />
              <Button
                className="bg-orange-500 text-white"
                variant="outline"
                onClick={handleCreateProduct}
              >
                <CirclePlus className="h-4 w-4 mr-2" /> Nový výrobek
              </Button>
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
            <div
              ref={parentRef}
              className="border rounded-md h-[calc(100vh-140px)] overflow-auto"
            >
              <div className="sticky top-0 bg-white z-10 border-b">
                <div className="grid grid-cols-[30px_40px_40px_40px_200px_100px_100px_100px_80px_50px_50px_50px_50px_50px_120px] gap-4 py-2 px-4 font-base text-sm">
                  <div></div>
                  <div className="text-center">ID</div>
                  <div className="text-center">Print ID</div>
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
                  <div className="text-center">Admin</div>
                  <div className="text-right">Actions</div>
                </div>
              </div>

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
                      <ProductRow
                        product={product}
                        onEdit={handleEdit}
                        onOpenParts={handleOpenParts}
                      />
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

            <ProductPartsModal
              open={showPartsDialog}
              onClose={handleClosePartsDialog}
              productId={partsProductId || 0}
              productName={partsProductName}
            />
          </Card>
        </div>
      </div>
      <ProductDetailsDialog />
    </>
  );
}
