import React, { useRef, useMemo } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

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
  Package,
  Download,
  Share,
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
import { ProductPartsModal } from "./ProductPartsModal";
import { removeDiacritics } from "@/utils/removeDiacritics";
import { useProductPartsCount } from "@/hooks/useProductParts";

import { detectAllergens } from "@/utils/allergenDetection";
import { supabase } from "@/lib/supabase";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sendEmail } from "@/lib/email";

// Horizontal Category Navigation Component
const HorizontalCategoryNav = ({
  onCategorySelect,
  selectedCategory,
}: {
  onCategorySelect: (categoryId: number | null) => void;
  selectedCategory: number | null;
}) => {
  const { data: categories } = fetchCategories();

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <Button
        variant="outline"
        size="sm"
        className={`cursor-pointer hover:bg-orange-500 hover:text-white transition-colors text-xs ${
          selectedCategory === null ? "bg-orange-500 text-white" : ""
        }`}
        onClick={() => onCategorySelect(null)}
      >
        Vše
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={`cursor-pointer hover:bg-red-500 hover:text-white transition-colors text-xs ${
          selectedCategory === -1 ? "bg-red-500 text-white" : ""
        }`}
        onClick={() => onCategorySelect(-1)}
      >
        Neaktivní
      </Button>
      {categories?.map((category) => (
        <Button
          key={category.id}
          variant="outline"
          size="sm"
          className={`cursor-pointer hover:bg-orange-500 hover:text-white transition-colors text-xs ${
            selectedCategory === category.id ? "bg-orange-500 text-white" : ""
          }`}
          onClick={() => onCategorySelect(category.id)}
        >
          {category.name}
        </Button>
      ))}
    </div>
  );
};

const ProductRow = memo(
  ({
    product,
    onEdit,
    onOpenParts,
    hasProductParts,
    onDebugError,
    ingredientCost,
  }: {
    product: Product;
    onEdit: (id: number) => void;
    onOpenParts: (id: number, name: string) => void;
    hasProductParts: boolean;
    onDebugError: (title: string, error: any) => void;
    ingredientCost?: number;
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
      <>
        {/* Desktop Layout (xl and up) - Reduced columns for better fit */}
        <div
          className="hidden xl:grid xl:grid-cols-[60px_80px_1.5fr_100px_100px_100px_90px_80px_60px_60px_60px_60px_120px] gap-2 py-2 px-2 items-center border-b text-sm cursor-pointer hover:bg-gray-50 w-full"
          onClick={() => onEdit(product.id)}
        >
          <div className="text-center">{product.id}</div>
          <div className="text-center">{product.printId}</div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="truncate font-medium">{product.name}</span>
              {printIdCount && printIdCount > 1 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 rounded-full whitespace-nowrap">
                  {printIdCount}
                </span>
              )}
            </div>
            {product.nameVi && (
              <p className="text-xs text-orange-500 truncate">
                {product.nameVi}
              </p>
            )}
            <div className="text-xs text-gray-500 truncate">{categoryName}</div>
          </div>
          <div className="text-right">{product.priceBuyer.toFixed(2)}</div>
          <div className="text-right">{product.priceMobil.toFixed(2)}</div>
          <div className="text-right font-medium">
            {product.price.toFixed(2)}
          </div>
          <div className="text-right">
            {ingredientCost !== undefined && ingredientCost > 0 ? (
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-purple-600 font-medium text-xs">
                  {ingredientCost.toFixed(2)} Kč
                </span>
                <div className="flex gap-1 text-[10px]">
                  {/* Buyer margin */}
                  {(() => {
                    const margin = product.priceBuyer - ingredientCost;
                    const marginPercent = (margin / ingredientCost) * 100;
                    const isLoss = margin < 0;
                    return (
                      <span
                        className={`font-medium ${
                          isLoss
                            ? "text-red-600"
                            : marginPercent < 20
                              ? "text-orange-600"
                              : "text-green-600"
                        }`}
                        title={`Marže k ceně nákup: ${margin.toFixed(2)} Kč`}
                      >
                        N:{marginPercent >= 0 ? "+" : ""}
                        {marginPercent.toFixed(0)}%
                      </span>
                    );
                  })()}
                  {/* Mobile margin */}
                  {product.priceMobil > 0 &&
                    (() => {
                      const margin = product.priceMobil - ingredientCost;
                      const marginPercent = (margin / ingredientCost) * 100;
                      const isLoss = margin < 0;
                      return (
                        <span
                          className={`font-medium ${
                            isLoss
                              ? "text-red-600"
                              : marginPercent < 20
                                ? "text-orange-600"
                                : "text-green-600"
                          }`}
                          title={`Marže k ceně mobil: ${margin.toFixed(2)} Kč`}
                        >
                          M:{marginPercent >= 0 ? "+" : ""}
                          {marginPercent.toFixed(0)}%
                        </span>
                      );
                    })()}
                </div>
              </div>
            ) : (
              <span className="text-gray-400 text-xs">—</span>
            )}
          </div>
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
              {hasProductParts ? (
                <Package className="h-4 w-4 text-orange-500" />
              ) : (
                <Package className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
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
                      Tata akce je nevratná. Výrobek bude trvale odstraněn.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
                      Zrušit
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await deleteProduct(product.id);
                          toast({
                            title: "Úspěch",
                            description: `Produkt "${product.name}" byl úspěšně smazán`,
                          });
                          // Refresh the products list
                          window.location.reload();
                        } catch (error) {
                          console.error("Error deleting product:", error);
                          onDebugError(
                            `Error deleting product "${product.name}" (ID: ${product.id})`,
                            error
                          );
                          toast({
                            title: "Chyba",
                            description:
                              error instanceof Error
                                ? error.message
                                : "Nepodařilo se smazat produkt",
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
            )}
          </div>
        </div>

        {/* Large Tablet Layout (lg to xl) - Further reduced columns */}
        <div
          className="hidden lg:grid xl:hidden lg:grid-cols-[60px_1.5fr_90px_90px_90px_80px_80px_100px] gap-2 py-2 px-3 items-center border-b text-sm cursor-pointer hover:bg-gray-50 w-full"
          onClick={() => onEdit(product.id)}
        >
          <div className="text-center">{product.id}</div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-medium truncate">{product.name}</span>
              {printIdCount && printIdCount > 1 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                  {printIdCount}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 truncate">{categoryName}</div>
          </div>
          <div className="text-right text-sm">
            {product.priceBuyer.toFixed(2)}
          </div>
          <div className="text-right text-sm">
            {product.priceMobil.toFixed(2)}
          </div>
          <div className="text-right text-sm font-medium">
            {product.price.toFixed(2)}
          </div>
          <div className="flex justify-center gap-1">
            <Checkbox
              checked={product.active}
              onCheckedChange={(checked) => {
                event?.stopPropagation();
                handleCheckboxChange("active", checked as boolean);
              }}
              className="h-4 w-4 border-amber-500 data-[state=checked]:bg-green-500"
              onClick={(e) => e.stopPropagation()}
            />
            <Checkbox
              checked={product.buyer}
              onCheckedChange={(checked) => {
                event?.stopPropagation();
                handleCheckboxChange("buyer", checked as boolean);
              }}
              className="h-4 w-4 border-orange-500 data-[state=checked]:bg-orange-500"
              onClick={(e) => e.stopPropagation()}
            />
            <Checkbox
              checked={product.store}
              onCheckedChange={(checked) => {
                event?.stopPropagation();
                handleCheckboxChange("store", checked as boolean);
              }}
              className="h-4 w-4 border-blue-500 data-[state=checked]:bg-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
            <Checkbox
              checked={product.isAdmin}
              onCheckedChange={(checked) => {
                event?.stopPropagation();
                handleCheckboxChange("isAdmin", checked as boolean);
              }}
              className="h-4 w-4 border-purple-500 data-[state=checked]:bg-purple-500"
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
              className="h-7 w-7 p-0"
            >
              {hasProductParts ? (
                <Package className="h-3 w-3 text-orange-500" />
              ) : (
                <Package className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(product.id);
              }}
              className="h-7 w-7 p-0"
            >
              <FilePenLine className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Tablet Layout (md to lg) */}
        <div
          className="hidden md:grid lg:hidden md:grid-cols-[50px_1.5fr_80px_80px_80px_100px] gap-2 py-2 px-3 items-center border-b text-sm cursor-pointer hover:bg-gray-50 w-full"
          onClick={() => onEdit(product.id)}
        >
          <div className="text-center">{product.id}</div>
          <div className="flex flex-col min-w-0">
            <div className="font-medium truncate">{product.name}</div>
            <div className="text-xs text-gray-500 truncate">{categoryName}</div>
          </div>
          <div className="text-right text-xs">
            {product.priceBuyer.toFixed(2)}
          </div>
          <div className="text-right text-xs">
            {product.priceMobil.toFixed(2)}
          </div>
          <div className="text-right text-xs font-medium">
            {product.price.toFixed(2)}
          </div>
          <div className="flex justify-end gap-1">
            <Checkbox
              checked={product.active}
              onCheckedChange={(checked) => {
                event?.stopPropagation();
                handleCheckboxChange("active", checked as boolean);
              }}
              className="h-3 w-3 border-amber-500 data-[state=checked]:bg-green-500"
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onOpenParts(product.id, product.name);
              }}
              className="h-6 w-6 p-0"
            >
              {hasProductParts ? (
                <Package className="h-3 w-3 text-orange-500" />
              ) : (
                <Package className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(product.id);
              }}
              className="h-6 w-6 p-0"
            >
              <FilePenLine className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Mobile Layout (sm and below) */}
        <div
          className="block md:hidden p-3 border-b cursor-pointer hover:bg-gray-50 w-full"
          onClick={() => onEdit(product.id)}
        >
          <div className="flex justify-between items-start mb-2 w-full">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{product.name}</div>
              <div className="text-xs text-gray-500 truncate">
                {categoryName}
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <div className="text-sm font-medium">
                {product.price.toFixed(2)} Kč
              </div>
              <div className="text-xs text-gray-500">ID: {product.id}</div>
            </div>
          </div>
          <div className="flex justify-between items-center w-full">
            <div className="flex gap-2 flex-wrap">
              <span
                className={`text-xs px-2 py-1 rounded ${product.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}
              >
                {product.active ? "Aktivní" : "Neaktivní"}
              </span>
              {product.buyer && (
                <span className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-800">
                  Odběr
                </span>
              )}
              {product.store && (
                <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                  Store
                </span>
              )}
              {product.isAdmin && (
                <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800">
                  Admin
                </span>
              )}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenParts(product.id, product.name);
                }}
                className="h-8 w-8 p-0"
              >
                {hasProductParts ? (
                  <Package className="h-4 w-4 text-orange-500" />
                ) : (
                  <Package className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(product.id);
                }}
                className="h-8 w-8 p-0"
              >
                <FilePenLine className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }
);

export function ProductsTable() {
  const { data: products, error, isLoading } = fetchAllProducts();
  const { data: productPartsCount } = useProductPartsCount();

  const { data: categories } = fetchCategories();

  // Fetch product costs based on ingredients and recipes
  const { data: productCosts } = useQuery({
    queryKey: ["productCosts"],
    queryFn: async () => {
      // Fetch all product_parts with their ingredients and recipes
      const { data: productParts, error: partsError } = await supabase.from(
        "product_parts"
      ).select(`
          product_id,
          recipe_id,
          ingredient_id,
          quantity,
          productOnly,
          bakerOnly,
          recipes (
            id,
            quantity,
            price,
            recipe_ingredients (
              ingredient_id,
              quantity,
              ingredients (id, price, kiloPerUnit, unit)
            )
          ),
          ingredients (id, price, kiloPerUnit, unit)
        `);

      if (partsError) {
        console.error("Error fetching product parts:", partsError);
        throw partsError;
      }

      // Calculate cost for each product
      const costMap = new Map<number, number>();

      productParts?.forEach((part: any) => {
        const productId = part.product_id;
        let partCost = 0;

        // Skip productOnly parts (excluded from cost calculation)
        if (part.productOnly) return;

        // Calculate cost for direct ingredients
        if (part.ingredient_id && part.ingredients) {
          const ingredient = part.ingredients;
          const quantityInKg = part.quantity * (ingredient.kiloPerUnit || 1);
          partCost = quantityInKg * (ingredient.price || 0);
        }

        // Calculate cost for recipe-based ingredients
        if (part.recipe_id && part.recipes && part.recipes.recipe_ingredients) {
          const recipe = part.recipes;

          // Calculate total weight and price from recipe ingredients
          let totalRecipeWeight = 0;
          let totalRecipePrice = 0;

          recipe.recipe_ingredients.forEach((recipeIng: any) => {
            if (recipeIng.ingredients && recipeIng.quantity > 0) {
              const ingredient = recipeIng.ingredients;
              const weightInKg =
                recipeIng.quantity * (ingredient.kiloPerUnit || 1);
              totalRecipeWeight += weightInKg;

              if (ingredient.price) {
                totalRecipePrice += weightInKg * ingredient.price;
              }
            }
          });

          // Calculate price per kg and multiply by part quantity
          if (totalRecipeWeight > 0) {
            const recipePricePerKg = totalRecipePrice / totalRecipeWeight;
            partCost = recipePricePerKg * part.quantity;
          } else if (recipe.price) {
            // Fallback to stored recipe price
            partCost = recipe.price * part.quantity;
          }
        }

        // Note: pastry_id (product parts) are intentionally excluded from cost calculation
        // Cost only includes ingredient_id and recipe_id parts

        // Add to product total cost
        const existingCost = costMap.get(productId) || 0;
        costMap.set(productId, existingCost + partCost);
      });

      return Object.fromEntries(costMap);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // CSV Export Function
  const exportToCSV = async () => {
    if (!products || !categories) return;

    // Use the same filtering logic as the table
    const filteredProductsForExport = products.filter((product: Product) => {
      // Price filter - always apply
      const priceMatch =
        priceFilter === "all" ||
        (priceFilter === "mobile" && product.priceMobil > 0);

      // Status filter - filter by store, buyer, and admin status
      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "store" && product.store) ||
        (statusFilter === "buyer" && product.buyer) ||
        (statusFilter === "admin" && product.isAdmin) ||
        (statusFilter === "both" && product.store && product.buyer) ||
        (statusFilter === "storeOnly" && product.store && !product.buyer) ||
        (statusFilter === "buyerOnly" && product.buyer && !product.store) ||
        (statusFilter === "adminOnly" &&
          product.isAdmin &&
          !product.store &&
          !product.buyer) ||
        (statusFilter === "none" &&
          !product.store &&
          !product.buyer &&
          !product.isAdmin);

      // Search filter - search through specific fields
      const searchLower = removeDiacritics(globalFilter.toLowerCase().trim());
      const searchMatch =
        globalFilter.trim() === "" ||
        // Search through specific product fields
        removeDiacritics(product.name?.toLowerCase() || "").includes(
          searchLower
        ) ||
        removeDiacritics(product.nameVi?.toLowerCase() || "").includes(
          searchLower
        ) ||
        removeDiacritics(product.description?.toLowerCase() || "").includes(
          searchLower
        ) ||
        (product.id?.toString() || "").includes(searchLower) ||
        (product.printId?.toString() || "").includes(searchLower) ||
        (product.price?.toString() || "").includes(searchLower) ||
        (product.priceBuyer?.toString() || "").includes(searchLower) ||
        (product.priceMobil?.toString() || "").includes(searchLower) ||
        (product.vat?.toString() || "").includes(searchLower) ||
        // Search in category name if available
        (() => {
          const category = categories?.find(
            (c) => c.id === product.category_id
          );
          return category
            ? removeDiacritics(category.name.toLowerCase()).includes(
                searchLower
              )
            : false;
        })();

      // Category filter - only apply if there's no search term
      const categoryMatch =
        globalFilter.trim() !== "" ||
        (selectedCategory === null && product.active) ||
        (selectedCategory === -1 && !product.active) ||
        ((product.category_id ?? 0) === selectedCategory && product.active);

      return priceMatch && statusMatch && searchMatch && categoryMatch;
    });

    // Sort filtered products by category name
    const sortedProducts = [...filteredProductsForExport].sort((a, b) => {
      const categoryA =
        categories.find((c) => c.id === a.category_id)?.name || "";
      const categoryB =
        categories.find((c) => c.id === b.category_id)?.name || "";
      return categoryA.localeCompare(categoryB);
    });

    // Calculate nutritional data for each product
    const csvData = await Promise.all(
      sortedProducts.map(async (product) => {
        const category = categories.find((c) => c.id === product.category_id);
        let elements = "";
        let allergens = "";
        let energyKcal = 0;
        let energyKJ = 0;
        let fat = 0;
        let saturates = 0;
        let carbohydrates = 0;
        let sugars = 0;
        let protein = 0;
        let fibre = 0;
        let salt = 0;
        let totalWeight = 0;

        try {
          // Fetch actual product parts data
          const { data: productParts, error } = await supabase
            .from("product_parts")
            .select(
              `
              *,
              recipes(name, recipe_ingredients(quantity, ingredient:ingredients(*))),
              ingredients(name, unit, element, kJ, kcal, fat, saturates, carbohydrate, sugars, protein, fibre, salt, kiloPerUnit, price),
              pastry:products!product_parts_pastry_id_fkey(name, price)
            `
            )
            .eq("product_id", product.id)
            .order("created_at", { ascending: true });

          if (error) throw error;

          if (productParts && productParts.length > 0) {
            // Calculate elements - collect all ingredients with elements from all parts (excluding productOnly parts)
            const ingredientsWithElements: Array<{
              ingredient: any;
              quantity: number;
            }> = [];

            productParts.forEach((part: any) => {
              // Skip parts marked as productOnly
              if (part.productOnly) return;

              // Handle direct ingredients
              if (part.ingredient_id && part.ingredients) {
                const ingredient = part.ingredients;
                if (
                  ingredient &&
                  ingredient.element &&
                  ingredient.element.trim() !== ""
                ) {
                  ingredientsWithElements.push({
                    ingredient,
                    quantity: part.quantity,
                  });
                }
              }

              // Handle ingredients from recipes
              if (
                part.recipe_id &&
                part.recipes &&
                part.recipes.recipe_ingredients
              ) {
                part.recipes.recipe_ingredients.forEach((recipeIng: any) => {
                  if (
                    recipeIng.ingredient &&
                    recipeIng.ingredient.element &&
                    recipeIng.ingredient.element.trim() !== ""
                  ) {
                    const usedQuantity = recipeIng.quantity * part.quantity;
                    ingredientsWithElements.push({
                      ingredient: recipeIng.ingredient,
                      quantity: usedQuantity,
                    });
                  }
                });
              }
            });

            // Sort by quantity (descending) and merge elements
            const sortedIngredients = ingredientsWithElements.sort(
              (a, b) => b.quantity - a.quantity
            );

            if (sortedIngredients.length > 0) {
              // Merge all elements into a single text
              elements = sortedIngredients
                .map(({ ingredient }) => ingredient.element.trim())
                .join(", ");
            }

            // Calculate nutritional values from all parts (excluding productOnly)
            productParts.forEach((part: any) => {
              if (part.productOnly) return; // Skip productOnly parts

              // Handle recipe parts
              if (
                part.recipe_id &&
                part.recipes &&
                part.recipes.recipe_ingredients
              ) {
                // Calculate total weight and nutritional values for the full recipe
                let recipeWeightKg = 0;
                let recipeKJ = 0;
                let recipeKcal = 0;
                let recipeFat = 0;
                let recipeSaturates = 0;
                let recipeCarbohydrate = 0;
                let recipeSugars = 0;
                let recipeProtein = 0;
                let recipeFibre = 0;
                let recipeSalt = 0;

                part.recipes.recipe_ingredients.forEach((recipeIng: any) => {
                  if (recipeIng.ingredient) {
                    const ingredient = recipeIng.ingredient;
                    // Properly convert ingredient quantity to kg using kiloPerUnit
                    const weightInKg =
                      recipeIng.quantity * ingredient.kiloPerUnit;
                    recipeWeightKg += weightInKg;

                    // Calculate nutritional values per 100g basis
                    const factor = weightInKg * 10; // Convert kg to 100g units
                    recipeKJ += ingredient.kJ * factor;
                    recipeKcal += ingredient.kcal * factor;
                    recipeFat += ingredient.fat * factor;
                    recipeSaturates += ingredient.saturates * factor;
                    recipeCarbohydrate += ingredient.carbohydrate * factor;
                    recipeSugars += ingredient.sugars * factor;
                    recipeProtein += ingredient.protein * factor;
                    recipeFibre += ingredient.fibre * factor;
                    recipeSalt += ingredient.salt * factor;
                  }
                });

                // For recipe parts, part.quantity represents the actual weight in kg being used
                if (recipeWeightKg > 0) {
                  const proportion = part.quantity / recipeWeightKg;

                  totalWeight += part.quantity; // Use actual weight
                  energyKJ += recipeKJ * proportion;
                  energyKcal += recipeKcal * proportion;
                  fat += recipeFat * proportion;
                  saturates += recipeSaturates * proportion;
                  carbohydrates += recipeCarbohydrate * proportion;
                  sugars += recipeSugars * proportion;
                  protein += recipeProtein * proportion;
                  fibre += recipeFibre * proportion;
                  salt += recipeSalt * proportion;
                }
              }

              // Handle ingredient parts
              if (part.ingredient_id && part.ingredients) {
                const ingredient = part.ingredients;
                const weightInKg = part.quantity * ingredient.kiloPerUnit;
                totalWeight += weightInKg;

                // Calculate nutritional values per 100g basis
                const factor = weightInKg * 10; // Convert kg to 100g units
                energyKJ += ingredient.kJ * factor;
                energyKcal += ingredient.kcal * factor;
                fat += ingredient.fat * factor;
                saturates += ingredient.saturates * factor;
                carbohydrates += ingredient.carbohydrate * factor;
                sugars += ingredient.sugars * factor;
                protein += ingredient.protein * factor;
                fibre += ingredient.fibre * factor;
                salt += ingredient.salt * factor;
              }

              // Handle pastry/product parts (weight only, no nutritional data typically)
              if (part.pastry_id) {
                totalWeight += part.quantity;
              }
            });
          }
        } catch (error) {
          console.error(
            `Error fetching product parts for product ${product.id}:`,
            error
          );
        }

        // Calculate per 100g values
        const energyPer100gKcal =
          totalWeight > 0 ? (energyKcal / totalWeight) * 0.1 : 0;
        const energyPer100gKJ =
          totalWeight > 0 ? (energyKJ / totalWeight) * 0.1 : 0;
        const fatPer100g = totalWeight > 0 ? (fat / totalWeight) * 0.1 : 0;
        const saturatesPer100g =
          totalWeight > 0 ? (saturates / totalWeight) * 0.1 : 0;
        const carbohydratesPer100g =
          totalWeight > 0 ? (carbohydrates / totalWeight) * 0.1 : 0;
        const sugarsPer100g =
          totalWeight > 0 ? (sugars / totalWeight) * 0.1 : 0;
        const proteinPer100g =
          totalWeight > 0 ? (protein / totalWeight) * 0.1 : 0;
        const fibrePer100g = totalWeight > 0 ? (fibre / totalWeight) * 0.1 : 0;
        const saltPer100g = totalWeight > 0 ? (salt / totalWeight) * 0.1 : 0;

        // Detect allergens from elements
        if (elements) {
          const detectedAllergens = detectAllergens(elements);
          allergens = detectedAllergens.map((a) => a.name).join(", ");
        }

        const ingredientCost = productCosts?.[product.id] || 0;

        // Calculate margins
        const buyerMargin = product.priceBuyer - ingredientCost;
        const buyerMarginPercent =
          ingredientCost > 0 ? (buyerMargin / ingredientCost) * 100 : 0;
        const mobilMargin = product.priceMobil - ingredientCost;
        const mobilMarginPercent =
          ingredientCost > 0 ? (mobilMargin / ingredientCost) * 100 : 0;

        return {
          "Název produktu": product.name,
          Kategorie: category?.name || "",
          "Celková hmotnost (kg)": totalWeight.toFixed(3),
          "Cena nákup": product.priceBuyer.toFixed(2),
          "Cena mobil": product.priceMobil.toFixed(2),
          "Cena prodej": product.price.toFixed(2),
          "Náklady na suroviny": ingredientCost.toFixed(2),
          "Marže nákup (Kč)": buyerMargin.toFixed(2),
          "Marže nákup (%)": buyerMarginPercent.toFixed(1),
          "Marže mobil (Kč)": mobilMargin.toFixed(2),
          "Marže mobil (%)": mobilMarginPercent.toFixed(1),
          Alergeny: allergens,
          Složení: elements,

          "Energie (kcal/100g)": energyPer100gKcal.toFixed(0),
          "Energie (kJ/100g)": energyPer100gKJ.toFixed(0),
          "Tuky (g/100g)": fatPer100g.toFixed(1),
          "Nasycené mastné kyseliny (g/100g)": saturatesPer100g.toFixed(1),
          "Sacharidy (g/100g)": carbohydratesPer100g.toFixed(1),
          "Cukry (g/100g)": sugarsPer100g.toFixed(1),
          "Bílkoviny (g/100g)": proteinPer100g.toFixed(1),
          "Vláknina (g/100g)": fibrePer100g.toFixed(1),
          "Sůl (g/100g)": saltPer100g.toFixed(1),
        };
      })
    );

    // Convert to CSV format
    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(","),
      ...csvData.map((row) =>
        headers
          .map((header) => {
            const value = row[header as keyof typeof row];
            // Escape commas and quotes in CSV values
            return `"${String(value).replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);

    // Get category name for filename
    let categoryName = "all";
    if (selectedCategory === null) {
      categoryName = "vse";
    } else if (selectedCategory === -1) {
      categoryName = "neaktivni";
    } else if (selectedCategory) {
      const category = categories.find((c) => c.id === selectedCategory);
      categoryName = category ? category.name : "unknown";
    }

    link.setAttribute(
      "download",
      `produkty_${categoryName}_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    link.style.position = "absolute";
    link.style.left = "-9999px";

    try {
      document.body.appendChild(link);
      link.click();
    } finally {
      // Safely remove the link element
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
      // Clean up the object URL
      URL.revokeObjectURL(url);
    }
  };

  // Share CSV Export Function - Product Parts
  const exportProductPartsToCSV = async () => {
    if (!products || !categories) return;

    // Use the same filtering logic as the table
    const filteredProductsForExport = products.filter((product: Product) => {
      // Price filter - always apply
      const priceMatch =
        priceFilter === "all" ||
        (priceFilter === "mobile" && product.priceMobil > 0);

      // Status filter - filter by store, buyer, and admin status
      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "store" && product.store) ||
        (statusFilter === "buyer" && product.buyer) ||
        (statusFilter === "admin" && product.isAdmin) ||
        (statusFilter === "both" && product.store && product.buyer) ||
        (statusFilter === "storeOnly" && product.store && !product.buyer) ||
        (statusFilter === "buyerOnly" && product.buyer && !product.store) ||
        (statusFilter === "adminOnly" &&
          product.isAdmin &&
          !product.store &&
          !product.buyer) ||
        (statusFilter === "none" &&
          !product.store &&
          !product.buyer &&
          !product.isAdmin);

      // Search filter - search through specific fields
      const searchLower = removeDiacritics(globalFilter.toLowerCase().trim());
      const searchMatch =
        globalFilter.trim() === "" ||
        // Search through specific product fields
        removeDiacritics(product.name?.toLowerCase() || "").includes(
          searchLower
        ) ||
        removeDiacritics(product.nameVi?.toLowerCase() || "").includes(
          searchLower
        ) ||
        removeDiacritics(product.description?.toLowerCase() || "").includes(
          searchLower
        ) ||
        (product.id?.toString() || "").includes(searchLower) ||
        (product.printId?.toString() || "").includes(searchLower) ||
        (product.price?.toString() || "").includes(searchLower) ||
        (product.priceBuyer?.toString() || "").includes(searchLower) ||
        (product.priceMobil?.toString() || "").includes(searchLower) ||
        (product.vat?.toString() || "").includes(searchLower) ||
        // Search in category name if available
        (() => {
          const category = categories?.find(
            (c) => c.id === product.category_id
          );
          return category
            ? removeDiacritics(category.name.toLowerCase()).includes(
                searchLower
              )
            : false;
        })();

      // Category filter - only apply if there's no search term
      const categoryMatch =
        globalFilter.trim() !== "" ||
        (selectedCategory === null && product.active) ||
        (selectedCategory === -1 && !product.active) ||
        ((product.category_id ?? 0) === selectedCategory && product.active);

      return priceMatch && statusMatch && searchMatch && categoryMatch;
    });

    // Sort filtered products by category name
    const sortedProducts = [...filteredProductsForExport].sort((a, b) => {
      const categoryA =
        categories.find((c) => c.id === a.category_id)?.name || "";
      const categoryB =
        categories.find((c) => c.id === b.category_id)?.name || "";
      return categoryA.localeCompare(categoryB);
    });

    // Fetch product parts data for all products
    const csvData = await Promise.all(
      sortedProducts.map(async (product) => {
        const category = categories.find((c) => c.id === product.category_id);

        try {
          // Fetch product parts data
          const { data: productParts, error } = await supabase
            .from("product_parts")
            .select(
              `
              *,
              recipes(name),
              ingredients(name, unit),
              pastry:products!product_parts_pastry_id_fkey(name)
            `
            )
            .eq("product_id", product.id)
            .order("created_at", { ascending: true });

          if (error) throw error;

          if (productParts && productParts.length > 0) {
            // Create a row for each product part
            return productParts.map((part: any) => {
              let partName = "";
              let partType = "";
              let unit = "";

              if (part.recipe_id && part.recipes) {
                partName = part.recipes.name;
                partType = "Recept";
                unit = "kg";
              } else if (part.pastry_id && part.pastry) {
                partName = part.pastry.name;
                partType = "Produkt";
                unit = "ks";
              } else if (part.ingredient_id && part.ingredients) {
                partName = part.ingredients.name;
                partType = "Surovina";
                unit = part.ingredients.unit || "kg";
              }

              return {
                "Název produktu": product.name,
                "Kategorie produktu": category?.name || "",
                "ID produktu": product.id,
                "Název části": partName,
                "Typ části": partType,
                Množství: part.quantity,
                Jednotka: unit,
                "Produkt prodejny": part.productOnly ? "Ano" : "Ne",
              };
            });
          } else {
            // Product has no parts
            return [
              {
                "Název produktu": product.name,
                "Kategorie produktu": category?.name || "",
                "ID produktu": product.id,
                "Název části": "",
                "Typ části": "",
                Množství: "",
                Jednotka: "",
                "Produkt prodejny": "",
              },
            ];
          }
        } catch (error) {
          console.error(
            `Error fetching product parts for product ${product.id}:`,
            error
          );
          return [
            {
              "Název produktu": product.name,
              "Kategorie produktu": category?.name || "",
              "ID produktu": product.id,
              "Název části": "Chyba načítání",
              "Typ části": "",
              Množství: "",
              Jednotka: "",
              "Produkt prodejny": "",
            },
          ];
        }
      })
    );

    // Flatten the array of arrays
    const flattenedData = csvData.flat();

    if (flattenedData.length === 0) {
      toast({
        title: "Chyba",
        description: "Žádná data k exportu",
        variant: "destructive",
      });
      return;
    }

    // Convert to CSV format
    const headers = Object.keys(flattenedData[0]);
    const csvContent = [
      headers.join(","),
      ...flattenedData.map((row) =>
        headers
          .map((header) => {
            const value = row[header as keyof typeof row];
            // Escape commas and quotes in CSV values
            return `"${String(value).replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `produkty_casti_export_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    link.style.position = "absolute";
    link.style.left = "-9999px";

    try {
      document.body.appendChild(link);
      link.click();
    } finally {
      // Safely remove the link element
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
      // Clean up the object URL
      URL.revokeObjectURL(url);
    }

    toast({
      title: "Úspěch",
      description: `Exportován ${flattenedData.length} řádek s částmi produktů`,
    });
  };

  // const { mutateAsync: updateProduct } = useUpdateProduct();

  // const [sorting, setSorting] = useState<SortingState>([]);

  const [globalFilter, setGlobalFilter] = useState("");
  const setSelectedProductId = useProductStore(
    (state) => state.setSelectedProductId
  );
  //   const category = categories?.find((c) => c.id === products.category_id);
  // const navigate = useNavigate();
  const [priceFilter, setPriceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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

  // Debug error state
  const [debugError, setDebugError] = useState<{
    title: string;
    error: any;
  } | null>(null);
  const [showDebugDialog, setShowDebugDialog] = useState(false);

  // Create a lookup map for products with parts
  const productPartsMap = useMemo(() => {
    const map = new Map<number, boolean>();
    productPartsCount?.forEach((pc) => {
      map.set(pc.product_id, true);
    });
    return map;
  }, [productPartsCount]);

  const handleCreateProduct = () => {
    setShowCreateDialog(true);
  };

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  //   const openOrderDetails = (orderId: number) => {
  //     window.open(`/admin/orders/${orderId}`, "_blank");
  //   };

  const filteredProducts = React.useMemo(() => {
    return (
      products?.filter((product: Product) => {
        // Price filter - always apply
        const priceMatch =
          priceFilter === "all" ||
          (priceFilter === "mobile" && product.priceMobil > 0);

        // Status filter - filter by store, buyer, and admin status
        const statusMatch =
          statusFilter === "all" ||
          (statusFilter === "store" && product.store) ||
          (statusFilter === "buyer" && product.buyer) ||
          (statusFilter === "admin" && product.isAdmin) ||
          (statusFilter === "both" && product.store && product.buyer) ||
          (statusFilter === "storeOnly" && product.store && !product.buyer) ||
          (statusFilter === "buyerOnly" && product.buyer && !product.store) ||
          (statusFilter === "adminOnly" &&
            product.isAdmin &&
            !product.store &&
            !product.buyer) ||
          (statusFilter === "none" &&
            !product.store &&
            !product.buyer &&
            !product.isAdmin);

        // Search filter - search through specific fields
        const searchLower = removeDiacritics(globalFilter.toLowerCase().trim());
        const searchMatch =
          globalFilter.trim() === "" ||
          // Search through specific product fields
          removeDiacritics(product.name?.toLowerCase() || "").includes(
            searchLower
          ) ||
          removeDiacritics(product.nameVi?.toLowerCase() || "").includes(
            searchLower
          ) ||
          removeDiacritics(product.description?.toLowerCase() || "").includes(
            searchLower
          ) ||
          (product.id?.toString() || "").includes(searchLower) ||
          (product.printId?.toString() || "").includes(searchLower) ||
          (product.price?.toString() || "").includes(searchLower) ||
          (product.priceBuyer?.toString() || "").includes(searchLower) ||
          (product.priceMobil?.toString() || "").includes(searchLower) ||
          (product.vat?.toString() || "").includes(searchLower) ||
          // Search in category name if available
          (() => {
            const category = categories?.find(
              (c) => c.id === product.category_id
            );
            return category
              ? removeDiacritics(category.name.toLowerCase()).includes(
                  searchLower
                )
              : false;
          })();

        // Category filter - only apply if there's no search term
        const categoryMatch =
          globalFilter.trim() !== "" ||
          (selectedCategory === null && product.active) ||
          (selectedCategory === -1 && !product.active) ||
          ((product.category_id ?? 0) === selectedCategory && product.active);

        return priceMatch && statusMatch && searchMatch && categoryMatch;
      }) || []
    );
  }, [
    products,
    selectedCategory,
    globalFilter,
    priceFilter,
    statusFilter,
    categories,
  ]);

  const handleCategorySelect = (categoryId: number | null) => {
    setSelectedCategory(categoryId);
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

  const handleDebugError = (title: string, error: any) => {
    setDebugError({ title, error });
    setShowDebugDialog(true);
  };

  if (isLoading) return <div>Loading products...</div>;
  if (error) return <div>Error loading products</div>;

  return (
    <>
      <div className="min-h-screen w-full py-1 px-1 sm:px-2 lg:px-3">
        <Card className="w-full h-full">
          <div className="p-2 sm:p-3 lg:p-4 space-y-4 w-full">
            {/* Header with all controls - responsive */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 w-full">
              <div>
                <h1 className="text-xl lg:text-2xl xl:text-3xl font-bold">
                  Produkty
                </h1>
                <p className="text-muted-foreground">
                  {(() => {
                    const totalProducts = products?.length || 0;
                    const activeProducts =
                      products?.filter((p) => p.active).length || 0;
                    const filteredCount = filteredProducts?.length || 0;

                    if (selectedCategory === null) {
                      return `${activeProducts} aktivních z ${totalProducts} celkem`;
                    } else if (selectedCategory === -1) {
                      return `${filteredCount} neaktivních produktů`;
                    } else {
                      const categoryName =
                        categories?.find((c) => c.id === selectedCategory)
                          ?.name || "Neznámá kategorie";
                      return `${filteredCount} produktů v kategorii "${categoryName}"`;
                    }
                  })()}
                </p>
              </div>

              {/* Controls row - responsive */}
              <div className="flex flex-col sm:flex-row gap-2 w-full lg:flex-1 lg:justify-end">
                <Input
                  placeholder="Hledat produkt..."
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="flex-1 sm:flex-initial sm:w-full lg:w-auto lg:min-w-[200px] xl:min-w-[250px]"
                />
                <Select value={priceFilter} onValueChange={setPriceFilter}>
                  <SelectTrigger className="w-full sm:w-auto lg:min-w-[180px]">
                    <SelectValue placeholder="Filter ceny" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všechny ceny</SelectItem>
                    <SelectItem value="mobile">Mobilní cena {">"} 0</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-auto lg:min-w-[180px]">
                    <SelectValue placeholder="Filter statusu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všechny produkty</SelectItem>
                    <SelectItem value="store">Prodejna</SelectItem>
                    <SelectItem value="buyer">Odběratelé</SelectItem>
                    <SelectItem value="admin">pouze Admin</SelectItem>
                    <SelectItem value="both">Prodej a Odběr</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={exportToCSV}
                  className="w-full sm:w-auto whitespace-nowrap"
                  title="Export do CSV"
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden lg:inline">CSV Export</span>
                  <span className="lg:hidden">Export</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={exportProductPartsToCSV}
                  className="w-full sm:w-auto whitespace-nowrap"
                  title="Export částí produktů do CSV"
                >
                  <Share className="h-4 w-4 mr-2" />
                  <span className="hidden lg:inline">Share CSV</span>
                  <span className="lg:hidden">Share</span>
                </Button>
                <Button
                  className="bg-orange-500 text-white w-full sm:w-auto whitespace-nowrap"
                  variant="outline"
                  onClick={handleCreateProduct}
                >
                  <CirclePlus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Nový výrobek</span>
                  <span className="sm:hidden">Nový</span>
                </Button>
              </div>
            </div>

            {/* Horizontal Category Navigation */}
            <HorizontalCategoryNav
              onCategorySelect={handleCategorySelect}
              selectedCategory={selectedCategory}
            />

            {/* Table Container - responsive with horizontal scroll fallback */}
            <div
              ref={parentRef}
              className="border rounded-md overflow-auto w-full"
              style={{
                height: "calc(100vh - max(200px, 25vh))",
                minHeight: "400px",
                maxHeight: "80vh",
                overflowX: "auto",
              }}
            >
              <div className="w-full">
                {/* Desktop Header (xl and up) */}
                <div className="hidden xl:block sticky top-0 bg-white z-10 border-b w-full">
                  <div className="grid grid-cols-[60px_80px_2fr_100px_100px_100px_90px_80px_60px_60px_60px_60px_120px] gap-2 py-2 px-2 font-medium text-sm w-full">
                    <div className="text-center">ID</div>
                    <div className="text-center">Print</div>
                    <div>Název / Kategorie</div>
                    <div className="text-right">Nákup</div>
                    <div className="text-right">Mobil</div>
                    <div className="text-right">Prodej</div>
                    <div
                      className="text-right text-purple-600 cursor-help"
                      title="Náklady na suroviny + marže k cenám nákup (N) a mobil (M)"
                    >
                      Náklady
                    </div>
                    <div className="text-right">DPH</div>
                    <div className="text-center">Act</div>
                    <div className="text-center">Odběr</div>
                    <div className="text-center">Store</div>
                    <div className="text-center">Admin</div>
                    {/* <div className="text-right">Složení</div> */}
                    <div className="text-right">Akce</div>
                  </div>
                </div>

                {/* Large Tablet Header (lg to xl) */}
                <div className="hidden lg:block xl:hidden sticky top-0 bg-white z-10 border-b w-full">
                  <div className="grid grid-cols-[60px_2fr_90px_90px_90px_80px_80px_100px] gap-2 py-2 px-3 font-medium text-sm w-full">
                    <div className="text-center">ID</div>
                    <div>Název</div>
                    <div className="text-right">Nákup</div>
                    <div className="text-right">Mobil</div>
                    <div className="text-right">Prodej</div>
                    <div className="text-center">Act</div>
                    <div className="text-center">Odběr</div>
                    <div className="text-center">Store</div>
                    <div className="text-center">Admin</div>
                    <div className="text-right">Akce</div>
                  </div>
                </div>

                {/* Tablet Header (md to lg) */}
                <div className="hidden md:block lg:hidden sticky top-0 bg-white z-10 border-b w-full">
                  <div className="grid grid-cols-[50px_2fr_80px_80px_80px_100px] gap-2 py-2 px-3 font-medium text-sm w-full">
                    <div className="text-center">ID</div>
                    <div>Název</div>
                    <div className="text-right">Nákup</div>
                    <div className="text-right">Mobil</div>
                    <div className="text-right">Prodej</div>
                    <div className="text-right">Akce</div>
                  </div>
                </div>

                {/* Mobile Header */}
                <div className="block md:hidden sticky top-0 bg-white z-10 border-b py-2 px-3 w-full">
                  <div className="text-sm font-medium text-gray-600">
                    {filteredProducts.length} produktů
                  </div>
                </div>

                {/* Virtualized Product Rows */}
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const product = filteredProducts[virtualRow.index];
                    const hasProductParts =
                      productPartsMap.get(product.id) || false;
                    const ingredientCost = productCosts?.[product.id];

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
                          hasProductParts={hasProductParts}
                          onDebugError={handleDebugError}
                          ingredientCost={ingredientCost}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Dialogs */}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogContent className="p-0 border-none max-w-4xl">
              <CreateProductForm />
            </DialogContent>
          </Dialog>

          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="p-0 max-w-4xl">
              {editProductId && (
                <ProductForm
                  productId={editProductId}
                  onClose={() => {
                    setShowEditDialog(false);
                    setSelectedProductId(null);
                    setEditProductId(undefined);
                  }}
                />
              )}
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
      {/* Debug Error Dialog */}
      <Dialog open={showDebugDialog} onOpenChange={setShowDebugDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-red-600">
              Debug Error Information
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">
                {debugError?.title}
              </h3>
            </div>
            <div className="bg-gray-100 p-4 rounded-md">
              <h4 className="font-medium mb-2">Error Details:</h4>
              <pre className="text-sm overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(debugError?.error, null, 2)}
              </pre>
            </div>
            <div className="bg-blue-50 p-4 rounded-md">
              <h4 className="font-medium mb-2">Error Stack:</h4>
              <pre className="text-sm overflow-x-auto whitespace-pre-wrap">
                {debugError?.error?.stack || "No stack trace available"}
              </pre>
            </div>
            <div className="bg-yellow-50 p-4 rounded-md">
              <h4 className="font-medium mb-2">Error Message:</h4>
              <pre className="text-sm overflow-x-auto whitespace-pre-wrap">
                {debugError?.error?.message || "No message available"}
              </pre>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowDebugDialog(false)}>
              Close
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  console.log("Sending test email...");
                  // Include error details in the test email
                  const emailText = `

Error Details (if available):
Title: ${debugError?.title || "No error"}
Message: ${debugError?.error?.message || "No error message"}
Timestamp: ${new Date().toLocaleString()}`;

                  const response = await sendEmail({
                    to: "l.batelkova@gmail.com",
                    subject: "Chybové hlášení výrobků",
                    text: emailText,
                    attachments: [],
                  });
                  console.log("Test email response:", response);
                  toast({
                    title: "Test email sent",
                    description: "Email sent successfully",
                  });
                } catch (error) {
                  console.error("Email failed:", error);
                  toast({
                    title: "Email failed",
                    description: "Failed to send email",
                    variant: "destructive",
                  });
                }
              }}
            >
              Odeslat email
            </Button>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(
                  JSON.stringify(debugError, null, 2)
                );
                toast({
                  title: "Copied",
                  description: "Error details copied to clipboard",
                });
              }}
            >
              Copy Error Details
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ProductDetailsDialog />
    </>
  );
}
