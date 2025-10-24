import { useMemo, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIngredientStore } from "@/stores/ingredientStore";
import {
  Plus,
  Search,
  Package,
  Tag,
  Scale,
  Edit,
  Trash2,
  FileText,
  ZapIcon,
  ArrowRightLeft,
  Download,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { IngredientForm } from "./IngredientForm";
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
import { useToast } from "@/hooks/use-toast";
import { removeDiacritics } from "@/utils/removeDiacritics";
import { useAuthStore } from "@/lib/supabase";
import { useSupplierUsers } from "@/hooks/useProfiles";

export function IngredientsTable() {
  const {
    ingredients,
    categories,
    isLoading,
    error,
    fetchIngredients,
    fetchCategories,
    openCreateForm,
    openEditForm,
    deleteIngredient,
  } = useIngredientStore();

  const { toast } = useToast();
  const { user: authUser } = useAuthStore();
  const [globalFilter, setGlobalFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("categories");
  const { data: supplierUsers } = useSupplierUsers();
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [ingredientUsage, setIngredientUsage] = useState<
    Record<number, number>
  >({});

  // Check if user can delete ingredients
  const canDelete =
    authUser?.role === "admin" || authUser?.email === "l.batelkova@gmail.com";

  // Load data on mount
  useEffect(() => {
    fetchIngredients();
    fetchCategories();
  }, [fetchIngredients, fetchCategories]);

  // Load ingredient usage data
  useEffect(() => {
    const loadIngredientUsage = async () => {
      if (!ingredients || ingredients.length === 0) return;

      try {
        const { supabase } = await import("@/lib/supabase");

        // Get all recipe_ingredients
        const { data: recipeIngredients, error: recipeError } = await supabase
          .from("recipe_ingredients")
          .select("ingredient_id");

        if (recipeError) {
          console.error("Error loading recipe ingredient usage:", recipeError);
          return;
        }

        // Get all product_parts that use ingredients directly
        const { data: productParts, error: productPartsError } = await supabase
          .from("product_parts")
          .select("ingredient_id")
          .not("ingredient_id", "is", null);

        if (productPartsError) {
          console.error(
            "Error loading product parts ingredient usage:",
            productPartsError
          );
          return;
        }

        // Count occurrences of each ingredient ID from both recipes and product parts
        const usageCountMap: Record<number, number> = {};

        // Initialize all ingredients with 0 count
        ingredients.forEach((ingredient) => {
          usageCountMap[ingredient.id] = 0;
        });

        // Count from recipe_ingredients
        recipeIngredients?.forEach((ri) => {
          if (ri.ingredient_id) {
            usageCountMap[ri.ingredient_id] =
              (usageCountMap[ri.ingredient_id] || 0) + 1;
          }
        });

        // Count from product_parts
        productParts?.forEach((pp) => {
          if (pp.ingredient_id) {
            usageCountMap[pp.ingredient_id] =
              (usageCountMap[pp.ingredient_id] || 0) + 1;
          }
        });

        setIngredientUsage(usageCountMap);
      } catch (error) {
        console.error("Error loading ingredient usage:", error);
      }
    };

    loadIngredientUsage();
  }, [ingredients]);

  // Helper function to get display name for sorting (used in multiple places)
  const getDisplayName = useCallback((ing: any) => {
    const activeSupplier = ing?.ingredient_supplier_codes?.find(
      (code: any) => code.is_active
    );
    return activeSupplier?.supplier_ingredient_name || ing?.name || "";
  }, []);

  // Group ingredients by category
  const groupedIngredients = useMemo(() => {
    if (!ingredients) return [];

    const grouped = ingredients.reduce(
      (acc, ingredient) => {
        const categoryName =
          ingredient.ingredient_categories?.name || "Bez kategorie";
        if (!acc[categoryName]) {
          acc[categoryName] = [];
        }
        acc[categoryName].push(ingredient);
        return acc;
      },
      {} as Record<string, typeof ingredients>
    );

    // Sort categories and ingredients within each category
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([categoryName, ingredients]) => ({
        categoryName,
        ingredients: ingredients
          .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
          .filter((ing) => {
            if (supplierFilter === "all") return true;

            // Check main supplier_id
            if (ing.supplier_id === supplierFilter) return true;

            // Check if supplier exists in ingredient_supplier_codes
            const hasSupplierInCodes = ing.ingredient_supplier_codes?.some(
              (code: any) => code.supplier_id === supplierFilter
            );

            return hasSupplierInCodes;
          }),
      }));
  }, [ingredients, supplierFilter]);

  // Filter ingredients based on search and category
  const filteredGroupedIngredients = useMemo(() => {
    return groupedIngredients
      .filter(
        ({ categoryName }) =>
          // If there's a search term, show all categories to allow global search
          // Otherwise, respect the category filter
          globalFilter.trim() !== "" ||
          categoryFilter === "all" ||
          categoryName === categoryFilter
      )
      .map(({ categoryName, ingredients }) => ({
        categoryName,
        ingredients: ingredients.filter((ingredient) => {
          const searchLower = removeDiacritics(globalFilter.toLowerCase());
          const nameMatch = removeDiacritics(
            ingredient.name.toLowerCase()
          ).includes(searchLower);
          const eanMatch = ingredient.ean?.includes(globalFilter);
          const categoryMatch = ingredient.ingredient_categories?.name
            ? removeDiacritics(
                ingredient.ingredient_categories.name.toLowerCase()
              ).includes(searchLower)
            : false;
          const supplierName = (supplierUsers || [])
            .find((u: any) => u.id === ingredient.supplier_id)
            ?.full_name?.toLowerCase();
          const supplierMatch = supplierName
            ? removeDiacritics(supplierName).includes(searchLower)
            : false;

          // If there's a search term, search globally
          if (globalFilter.trim() !== "") {
            return nameMatch || eanMatch || categoryMatch || supplierMatch;
          }

          // If no search term, apply category filter
          const categoryFilterMatch =
            categoryFilter === "all" ||
            (ingredient.ingredient_categories?.name || "Bez kategorie") ===
              categoryFilter;

          return categoryFilterMatch;
        }),
      }))
      .filter(({ ingredients }) => ingredients.length > 0);
  }, [groupedIngredients, globalFilter, categoryFilter, supplierUsers]);

  // Filter all ingredients for the "all" tab
  const filteredAllIngredients = useMemo(() => {
    if (!ingredients) return [];

    return ingredients
      .filter((ingredient) => {
        const searchLower = removeDiacritics(globalFilter.toLowerCase());
        const nameMatch = removeDiacritics(
          ingredient.name.toLowerCase()
        ).includes(searchLower);
        const eanMatch = ingredient.ean?.includes(globalFilter);
        const categoryMatch = ingredient.ingredient_categories?.name
          ? removeDiacritics(
              ingredient.ingredient_categories.name.toLowerCase()
            ).includes(searchLower)
          : false;
        const supplierName = (supplierUsers || [])
          .find((u: any) => u.id === ingredient.supplier_id)
          ?.full_name?.toLowerCase();
        const supplierMatch = supplierName
          ? removeDiacritics(supplierName).includes(searchLower)
          : false;

        // If there's a search term, search globally
        if (globalFilter.trim() !== "") {
          return nameMatch || eanMatch || categoryMatch || supplierMatch;
        }

        // If no search term, apply category filter
        if (categoryFilter === "all") return true;
        const categoryName =
          ingredient.ingredient_categories?.name || "Bez kategorie";
        return categoryName === categoryFilter;
      })
      .filter((ing) => {
        if (supplierFilter === "all") return true;

        // Check main supplier_id
        if (ing.supplier_id === supplierFilter) return true;

        // Check if supplier exists in ingredient_supplier_codes
        const hasSupplierInCodes = ing.ingredient_supplier_codes?.some(
          (code: any) => code.supplier_id === supplierFilter
        );

        return hasSupplierInCodes;
      })
      .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));
  }, [
    ingredients,
    globalFilter,
    categoryFilter,
    supplierFilter,
    supplierUsers,
    getDisplayName,
  ]);

  const handleDelete = async (ingredient: (typeof ingredients)[0]) => {
    try {
      // Check if ingredient is used in any recipes or products
      const { supabase } = await import("@/lib/supabase");

      // Check recipe usage
      const { data: recipeIngredients, error: recipeCheckError } =
        await supabase
          .from("recipe_ingredients")
          .select("id, recipes(name)")
          .eq("ingredient_id", ingredient.id)
          .limit(5); // Get up to 5 recipes for error message

      if (recipeCheckError) {
        console.error("Error checking recipe usage:", recipeCheckError);
        toast({
          title: "Chyba",
          description:
            "Nepodařilo se zkontrolovat použití ingredience v receptech",
          variant: "destructive",
        });
        return;
      }

      // Check product parts usage
      const { data: productParts, error: productCheckError } = await supabase
        .from("product_parts")
        .select("id, products!product_parts_product_id_fkey(name)")
        .eq("ingredient_id", ingredient.id)
        .limit(5); // Get up to 5 products for error message

      if (productCheckError) {
        console.error("Error checking product usage:", productCheckError);
        toast({
          title: "Chyba",
          description:
            "Nepodařilo se zkontrolovat použití ingredience v produktech",
          variant: "destructive",
        });
        return;
      }

      // Build error message if ingredient is used
      const usageMessages = [];

      if (recipeIngredients && recipeIngredients.length > 0) {
        const recipeNames = recipeIngredients
          .map((ri: any) => ri.recipes?.name)
          .filter(Boolean)
          .slice(0, 3)
          .join(", ");

        const moreRecipes =
          recipeIngredients.length > 3
            ? ` a ${recipeIngredients.length - 3} dalších`
            : "";

        usageMessages.push(`Recepty: ${recipeNames}${moreRecipes}`);
      }

      if (productParts && productParts.length > 0) {
        const productNames = productParts
          .map((pp: any) => pp.products?.name)
          .filter(Boolean)
          .slice(0, 3)
          .join(", ");

        const moreProducts =
          productParts.length > 3
            ? ` a ${productParts.length - 3} dalších`
            : "";

        usageMessages.push(`Produkty: ${productNames}${moreProducts}`);
      }

      if (usageMessages.length > 0) {
        toast({
          title: "Nelze smazat",
          description: `Ingredience "${ingredient.name}" je použita v:\n${usageMessages.join("\n")}.\n\nNejprve ji odstraňte z receptů a produktů.`,
          variant: "destructive",
        });
        return;
      }

      // If not used anywhere, proceed with deletion
      await deleteIngredient(ingredient.id);
      toast({
        title: "Úspěch",
        description: "Ingredience byla úspěšně smazána",
      });
    } catch (error) {
      console.error("Error deleting ingredient:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se smazat ingredienci",
        variant: "destructive",
      });
    }
  };

  const handleExportCSV = () => {
    try {
      // Create CSV header
      const headers = [
        "Kategorie",
        "Název",
        "Název u dodavatele",
        "Dodavatel",
        "Kód dodavatele",
        "Cena",
        "Balení",
        "Jednotka",
        "kg/Jednotka",
        "DPH",
        "EAN",
        "Aktivní",
        "Pouze prodejna",
      ];

      // Get all ingredients sorted by category and name
      const sortedIngredients = filteredGroupedIngredients.flatMap(
        ({ categoryName, ingredients }) =>
          ingredients.map((ingredient) => {
            // Get the active supplier or first supplier for price/package
            const activeSupplier = ingredient.ingredient_supplier_codes?.find(
              (code: any) => code.is_active
            );
            const supplierToUse =
              activeSupplier || ingredient.ingredient_supplier_codes?.[0];

            // Get supplier info
            const supplierId =
              supplierToUse?.supplier_id || ingredient.supplier_id;
            const supplierName =
              (supplierUsers || []).find((u: any) => u.id === supplierId)
                ?.full_name || "";
            const supplierCode = supplierToUse?.product_code || "";

            // Get active supplier's ingredient name, fallback to internal name
            const supplierIngredientName =
              (activeSupplier as any)?.supplier_ingredient_name || "";

            const price = supplierToUse?.price || ingredient.price || 0;
            const packageValue =
              (supplierToUse?.package ?? ingredient.package) || "";

            return {
              category: categoryName,
              name: ingredient.name,
              supplierIngredientName: supplierIngredientName,
              supplier: supplierName,
              supplierCode: supplierCode,
              price: price.toFixed(2),
              package: packageValue,
              unit: ingredient.unit,
              kiloPerUnit: ingredient.kiloPerUnit.toFixed(3),
              vat: ingredient.vat || "",
              ean: ingredient.ean || "",
              active: ingredient.active ? "Ano" : "Ne",
              storeOnly: ingredient.storeOnly ? "Ano" : "Ne",
            };
          })
      );

      // Create CSV content
      const csvRows = [
        headers.join(";"),
        ...sortedIngredients.map((row) =>
          [
            row.category,
            row.name,
            row.supplierIngredientName,
            row.supplier,
            row.supplierCode,
            row.price,
            row.package,
            row.unit,
            row.kiloPerUnit,
            row.vat,
            row.ean,
            row.active,
            row.storeOnly,
          ]
            .map((cell) => `"${cell}"`)
            .join(";")
        ),
      ];

      const csvContent = csvRows.join("\n");

      // Add BOM for proper UTF-8 encoding in Excel
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvContent], {
        type: "text/csv;charset=utf-8;",
      });

      // Create download link
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `suroviny_${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Úspěch",
        description: `Export byl úspěšně vytvořen (${sortedIngredients.length} surovin)`,
      });
    } catch (error) {
      toast({
        title: "Chyba",
        description: "Nepodařilo se exportovat data",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">Načítání surovin...</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center py-8 text-red-600">
          Chyba při načítání surovin: {error}
        </div>
      </Card>
    );
  }

  const totalIngredients = ingredients.length || 0;
  const activeIngredients = ingredients.filter((i) => i.active).length || 0;

  // Helper function to check if ingredient was created within the last month
  const isRecentlyCreated = (ingredient: any) => {
    if (!ingredient.created_at) return false;
    const createdAt = new Date(ingredient.created_at);
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    return createdAt >= oneMonthAgo;
  };

  const renderIngredientRow = (ingredient: any) => (
    <TableRow
      key={ingredient.id}
      onClick={() => openEditForm(ingredient)}
      className="cursor-pointer hover:bg-orange-50 transition-colors"
      style={{ userSelect: "none" }}
    >
      <TableCell className="font-medium w-[200px]">
        <div className="flex flex-col gap-0.5">
          {(() => {
            // Get active supplier's ingredient name
            const activeSupplier = ingredient.ingredient_supplier_codes?.find(
              (code: any) => code.is_active
            );
            const activeSupplierIngredientName =
              activeSupplier?.supplier_ingredient_name;

            // Get all other suppliers' ingredient names (non-active)
            const otherSupplierNames =
              ingredient.ingredient_supplier_codes
                ?.filter(
                  (code: any) =>
                    !code.is_active && code.supplier_ingredient_name
                )
                .map((code: any) => code.supplier_ingredient_name)
                .filter(
                  (name: string, index: number, arr: string[]) =>
                    // Remove duplicates
                    arr.indexOf(name) === index
                )
                // Filter out names that match the active supplier name
                // Only filter out internal name if it matches the active supplier name (to avoid showing same name twice)
                .filter((name: string) => {
                  // Always filter out if it matches active supplier
                  if (name === activeSupplierIngredientName) return false;

                  // Only filter out internal name if active supplier name is same as internal name
                  if (
                    name === ingredient.name &&
                    activeSupplierIngredientName === ingredient.name
                  ) {
                    return false;
                  }

                  return true;
                }) || [];

            // Show active supplier name (or internal name as fallback)
            const displayName = activeSupplierIngredientName || ingredient.name;

            return (
              <>
                <div className="flex items-center gap-2">
                  {isRecentlyCreated(ingredient) && (
                    <Sparkles className="h-4 w-4 text-yellow-500" />
                  )}
                  <span>{displayName}</span>
                </div>
                {otherSupplierNames.length > 0 && (
                  <span className="text-xs text-blue-500 italic">
                    {otherSupplierNames.join(", ")}
                  </span>
                )}
              </>
            );
          })()}
        </div>
      </TableCell>
      <TableCell className="w-[150px]">
        <div className="flex items-center gap-1">
          {(() => {
            // Debug logging
            if (ingredient.name === "Rostlinná šlehačka") {
              console.log("Debug - Full ingredient object:", ingredient);
              console.log(
                "Debug - Supplier codes:",
                ingredient.ingredient_supplier_codes
              );
              console.log(
                "Debug - Supplier codes length:",
                ingredient.ingredient_supplier_codes?.length
              );
              console.log(
                "Debug - Has multiple suppliers check:",
                ingredient.ingredient_supplier_codes &&
                  ingredient.ingredient_supplier_codes.length > 1
              );
            }

            // Group codes by supplier to check for multiple suppliers
            const supplierGroups =
              ingredient.ingredient_supplier_codes?.reduce(
                (acc: any, code: any) => {
                  if (!acc[code.supplier_id]) {
                    acc[code.supplier_id] = [];
                  }
                  acc[code.supplier_id].push(code);
                  return acc;
                },
                {} as Record<string, any[]>
              ) || {};

            const hasMultipleSupplierGroups =
              Object.keys(supplierGroups).length > 1;
            const hasMultipleCodes =
              ingredient.ingredient_supplier_codes &&
              ingredient.ingredient_supplier_codes.length > 1;

            // Get the active supplier's name, or fall back to the first supplier if none are active
            const activeSupplier = ingredient.ingredient_supplier_codes?.find(
              (code: any) => code.is_active
            );

            // If no active supplier, use the first supplier or main supplier
            const supplierId =
              activeSupplier?.supplier_id ||
              ingredient.ingredient_supplier_codes?.[0]?.supplier_id ||
              ingredient.supplier_id;

            const supplierName =
              (supplierUsers || []).find((u: any) => u.id === supplierId)
                ?.full_name || "—";

            // Truncate supplier name to 15 characters
            const truncatedSupplierName =
              supplierName.length > 15
                ? supplierName.substring(0, 12) + "..."
                : supplierName;

            return (
              <>
                {(hasMultipleSupplierGroups || hasMultipleCodes) && (
                  <ArrowRightLeft className="h-3 w-3 text-blue-600" />
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm cursor-help">
                        {truncatedSupplierName}
                      </span>
                    </TooltipTrigger>
                    {supplierName.length > 15 && (
                      <TooltipContent>
                        <p>{supplierName}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
                {hasMultipleCodes && (
                  <Badge
                    variant="outline"
                    className="text-xs bg-neutral-50 text-orange-600 border-orange-300 ml-1"
                  >
                    {ingredient.ingredient_supplier_codes.length}
                  </Badge>
                )}
              </>
            );
          })()}
        </div>
      </TableCell>
      <TableCell className="w-[120px]">
        <div className="flex items-center gap-1">
          <span className="text-sm font-mono">
            {(() => {
              // Get the active supplier's product code, or fall back to first supplier
              const activeSupplier = ingredient.ingredient_supplier_codes?.find(
                (code: any) => code.is_active
              );

              // If no active supplier, use the first supplier
              const supplierToUse =
                activeSupplier || ingredient.ingredient_supplier_codes?.[0];

              // Debug logging
              if (ingredient.name === "Rostlinná šlehačka") {
                console.log("Debug - Active supplier:", activeSupplier);
                console.log("Debug - Supplier to use:", supplierToUse);
                console.log(
                  "Debug - Product code from supplier:",
                  supplierToUse?.product_code
                );
                console.log(
                  "Debug - Main product code:",
                  ingredient.product_code
                );
              }

              const productCode = supplierToUse?.product_code || "Bez kódu";

              // If there are multiple codes, show indicator
              if (
                ingredient.ingredient_supplier_codes &&
                ingredient.ingredient_supplier_codes.length > 1
              ) {
                return (
                  <span className="flex items-center gap-1">
                    <span>{productCode}</span>
                    <span className="text-xs text-blue-600">
                      +{ingredient.ingredient_supplier_codes.length - 1}
                    </span>
                  </span>
                );
              }

              return productCode;
            })()}
          </span>
        </div>
      </TableCell>
      <TableCell className="w-[80px]">
        <div className="flex items-center gap-1">
          <Scale className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">{ingredient.unit}</span>
        </div>
      </TableCell>
      <TableCell className="text-right w-[100px]">
        <span className="text-sm">{ingredient.kiloPerUnit.toFixed(3)}</span>
      </TableCell>
      <TableCell className="text-right w-[120px]">
        <div className="flex items-center gap-1 justify-end">
          <span className="text-sm">
            {(() => {
              // Get the active supplier's price, or fall back to first supplier
              const activeSupplier = ingredient.ingredient_supplier_codes?.find(
                (code: any) => code.is_active
              );

              // If no active supplier, use the first supplier
              const supplierToUse =
                activeSupplier || ingredient.ingredient_supplier_codes?.[0];
              const price = supplierToUse?.price || ingredient.price;

              // Debug logging
              if (ingredient.name === "Rostlinná šlehačka") {
                console.log("Debug - Active supplier:", activeSupplier);
                console.log("Debug - Supplier to use:", supplierToUse);
                console.log(
                  "Debug - Price from supplier:",
                  supplierToUse?.price
                );
                console.log("Debug - Main price:", ingredient.price);
                console.log("Debug - Final price:", price);
              }

              const priceText = price ? `${price.toFixed(2)} Kč` : "—";

              // If there are multiple codes, show price range
              if (
                ingredient.ingredient_supplier_codes &&
                ingredient.ingredient_supplier_codes.length > 1
              ) {
                const prices = ingredient.ingredient_supplier_codes
                  .map((code: any) => code.price)
                  .filter((price: any) => price > 0)
                  .sort((a: any, b: any) => a - b);

                if (prices.length > 1) {
                  const minPrice = prices[0];
                  const maxPrice = prices[prices.length - 1];
                  return (
                    <span className="flex items-center gap-1">
                      <span>{priceText}</span>
                      <span className="text-xs text-blue-600">
                        ({minPrice.toFixed(2)}-{maxPrice.toFixed(2)})
                      </span>
                    </span>
                  );
                }
              }

              return priceText;
            })()}
          </span>
        </div>
      </TableCell>
      <TableCell className="w-[80px]">
        <div className="flex items-center gap-1">
          <Package className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">
            {(() => {
              // Get the active supplier's package, or fall back to ingredient package
              const activeSupplier = ingredient.ingredient_supplier_codes?.find(
                (code: any) => code.is_active
              );

              // If no active supplier, use the first supplier
              const supplierToUse =
                activeSupplier || ingredient.ingredient_supplier_codes?.[0];

              const packageValue = supplierToUse?.package ?? ingredient.package;
              return packageValue ? `${packageValue}` : "—";
            })()}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right w-[70px]">
        <span className="text-sm">
          {ingredient.vat ? `${ingredient.vat}%` : "—"}
        </span>
      </TableCell>
      <TableCell className="text-center w-[80px]">
        {ingredient.element && ingredient.element.trim() !== "" ? (
          <FileText className="h-4 w-4 text-blue-600 inline-block" />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-center w-[80px]">
        {ingredient.kJ || ingredient.kcal ? (
          <ZapIcon className="h-4 w-4 text-orange-500 inline-block" />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-center w-[90px]">
        {ingredientUsage[ingredient.id] !== undefined ? (
          ingredientUsage[ingredient.id] === 0 ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertCircle className="h-4 w-4 text-amber-500 inline-block cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Nepoužívá se v žádném receptu ani produktu</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 border-green-300 cursor-help"
                  >
                    {ingredientUsage[ingredient.id]}×
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Použito v {ingredientUsage[ingredient.id]}{" "}
                    receptech/produktech
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="w-[90px]">
        <Badge
          variant={ingredient.active ? "default" : "secondary"}
          className={
            ingredient.active
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-600"
          }
        >
          {ingredient.active ? "Aktivní" : "Neaktivní"}
        </Badge>
      </TableCell>
      <TableCell className="w-[120px]">
        <Badge
          variant="outline"
          className={
            ingredient.storeOnly
              ? "border-orange-500 text-orange-700"
              : "border-gray-300 text-gray-600"
          }
        >
          {ingredient.storeOnly ? "Ano" : "Ne"}
        </Badge>
      </TableCell>
      <TableCell className="text-right w-[100px]">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openEditForm(ingredient);
            }}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Smazat ingredienci</AlertDialogTitle>
                  <AlertDialogDescription>
                    Opravdu chcete smazat ingredienci "{ingredient.name}"? Tato
                    akce je nevratná.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Zrušit</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDelete(ingredient)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Smazat
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <>
      <Card className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold">Suroviny</h2>
              <p className="text-muted-foreground">
                {activeIngredients} aktivních z {totalIngredients} celkem
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleExportCSV}
                className="border-orange-600 text-orange-600 hover:bg-orange-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                className="bg-orange-600 hover:bg-orange-700"
                onClick={openCreateForm}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nová surovina
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Hledat podle názvu, EAN, dodavatele nebo kategorie..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtr kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny kategorie</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
                <SelectItem value="Bez kategorie">Bez kategorie</SelectItem>
              </SelectContent>
            </Select>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtr dodavatele" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všichni dodavatelé</SelectItem>
                {(supplierUsers || []).map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="categories">Podle kategorií</TabsTrigger>
              <TabsTrigger value="all">Všechny suroviny</TabsTrigger>
            </TabsList>

            {/* Categories Tab */}
            <TabsContent value="categories" className="space-y-6 mt-6">
              {filteredGroupedIngredients.map(
                ({ categoryName, ingredients }) => (
                  <div key={categoryName} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-orange-600" />
                      <h3 className="text-lg font-semibold text-orange-800">
                        {categoryName}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {ingredients.length} ingrediencí
                      </Badge>
                    </div>

                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[200px]">Název</TableHead>
                            <TableHead className="w-[150px]">
                              Dodavatel
                            </TableHead>
                            <TableHead className="w-[120px]">Kód</TableHead>
                            <TableHead className="w-[80px]">MJ</TableHead>
                            <TableHead className="text-right w-[100px]">
                              kg/MJ
                            </TableHead>
                            <TableHead className="text-right w-[120px]">
                              Cena
                            </TableHead>
                            <TableHead className="w-[80px]">Balení</TableHead>
                            <TableHead className="text-right w-[70px]">
                              DPH
                            </TableHead>
                            <TableHead className="w-[80px]">Složení</TableHead>
                            <TableHead className="w-[80px]">Výživa</TableHead>
                            <TableHead className="w-[90px]">Použití</TableHead>
                            <TableHead className="w-[90px]">Status</TableHead>
                            <TableHead className="w-[120px]">
                              Pouze prodejna
                            </TableHead>
                            <TableHead className="text-right w-[100px]">
                              Akce
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ingredients.map(renderIngredientRow)}
                          {/* Add fake empty row to help with border display */}
                          <TableRow className="h-0">
                            <TableCell
                              colSpan={14}
                              className="p-0 border-0"
                            ></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )
              )}

              {filteredGroupedIngredients.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nebyly nalezeny žádné ingredience odpovídající filtru.
                </div>
              )}
            </TabsContent>

            {/* All Ingredients Tab */}
            <TabsContent value="all" className="space-y-6 mt-6">
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Název</TableHead>
                      <TableHead className="w-[150px]">Dodavatel</TableHead>
                      <TableHead className="w-[120px]">Kód</TableHead>
                      <TableHead className="w-[80px]">Jednotka</TableHead>
                      <TableHead className="text-right w-[100px]">
                        kg/Jednotka
                      </TableHead>
                      <TableHead className="text-right w-[120px]">
                        Cena
                      </TableHead>
                      <TableHead className="w-[80px]">Balení</TableHead>
                      <TableHead className="text-right w-[70px]">DPH</TableHead>
                      <TableHead className="w-[80px]">Složení</TableHead>
                      <TableHead className="w-[80px]">Výživa</TableHead>
                      <TableHead className="w-[90px]">Použití</TableHead>
                      <TableHead className="w-[90px]">Status</TableHead>
                      <TableHead className="w-[120px]">
                        Pouze prodejna
                      </TableHead>
                      <TableHead className="text-right w-[100px]">
                        Akce
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAllIngredients.map(renderIngredientRow)}
                    {/* Add fake empty row to help with border display */}
                    <TableRow className="h-0">
                      <TableCell
                        colSpan={14}
                        className="p-0 border-0"
                      ></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {filteredAllIngredients.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nebyly nalezeny žádné ingredience odpovídající filtru.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </Card>

      {/* Ingredient Form Dialog */}
      <IngredientForm />
    </>
  );
}
