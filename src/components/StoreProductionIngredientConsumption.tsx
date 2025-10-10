import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Calendar,
  Download,
  Package,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { removeDiacritics } from "@/utils/removeDiacritics";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface IngredientConsumption {
  id: number;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  totalCost: number;
  categoryName: string;
  type: "ingredient" | "product";
}

interface IngredientBreakdown {
  recipes: {
    id: number;
    name: string;
    quantity: number;
    unit: string;
    totalCost: number;
    type: string;
  }[];
  products: {
    id: number;
    name: string;
    quantity: number;
    unit: string;
    totalCost: number;
    type: string;
  }[];
}

interface StoreProductionIngredientConsumptionProps {
  selectedUserId?: string;
}

export function StoreProductionIngredientConsumption({
  selectedUserId: propSelectedUserId,
}: StoreProductionIngredientConsumptionProps) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    propSelectedUserId || null
  );
  const [selectedIngredient, setSelectedIngredient] =
    useState<IngredientConsumption | null>(null);
  const [showBreakdownDialog, setShowBreakdownDialog] = useState(false);
  const { toast } = useToast();

  // Update selectedUserId when prop changes
  useEffect(() => {
    if (propSelectedUserId) {
      setSelectedUserId(propSelectedUserId);
    }
  }, [propSelectedUserId]);

  // Set default date range to current month
  const currentDate = new Date();
  const [startDate] = useState<Date>(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return new Date(year, month, 1);
  });
  const [endDate] = useState<Date>(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return new Date(year, month + 1, 0); // Last day of current month
  });

  // Fetch store users (excluding APLICA - Pekárna výrobna)
  const { data: storeUsers } = useQuery({
    queryKey: ["store-users-without-aplica"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "store")
        .neq("full_name", "APLICA - Pekárna výrobna")
        .order("full_name");

      if (error) throw error;
      return data || [];
    },
  });

  // Format dates for query
  const formatDateForQuery = (date: Date) => {
    return format(date, "yyyy-MM-dd");
  };

  const startDateStr = formatDateForQuery(startDate);
  const endDateStr = formatDateForQuery(endDate);

  // Fetch productions for selected user or all store users
  const {
    data: productions,
    isLoading: isLoadingProductions,
    error: productionsError,
    refetch,
  } = useQuery({
    queryKey: ["store-productions", selectedUserId, startDateStr, endDateStr],
    queryFn: async () => {
      let query = supabase
        .from("productions")
        .select(
          `
          *,
          profiles!productions_user_id_fkey(id, full_name),
          production_items(
            *,
            products(*)
          )
        `
        )
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .order("date", { ascending: false });

      if (selectedUserId) {
        query = query.eq("user_id", selectedUserId);
      } else if (storeUsers && storeUsers.length > 0) {
        // Only fetch productions for store users (excluding APLICA)
        const storeUserIds = storeUsers.map((u) => u.id);
        query = query.in("user_id", storeUserIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!storeUsers,
  });

  // Get product IDs from productions
  const productIds = useMemo(() => {
    if (!productions) return [];
    const ids = new Set<number>();
    productions.forEach((production: any) => {
      production.production_items?.forEach((item: any) => {
        if (item.products?.id) {
          ids.add(item.products.id);
        }
      });
    });
    return Array.from(ids);
  }, [productions]);

  // Fetch product parts for all products
  const { data: productParts } = useQuery({
    queryKey: ["product-parts-store", productIds],
    queryFn: async () => {
      if (productIds.length === 0) return [];

      const { data, error } = await supabase
        .from("product_parts")
        .select(
          `
          product_id, 
          recipe_id, 
          pastry_id, 
          ingredient_id, 
          quantity,
          productOnly,
          bakerOnly,
          recipes (id, name, quantity),
          products:pastry_id (id, name, priceBuyer),
          ingredients (id, name, unit, price, kiloPerUnit, ingredient_categories (name))
        `
        )
        .in("product_id", productIds);

      if (error) throw error;
      return data || [];
    },
    enabled: productIds.length > 0,
  });

  // Get recipe IDs
  const recipeIds = useMemo(() => {
    if (!productParts) return [];
    const ids = new Set<number>();
    productParts.forEach((part: any) => {
      if (part.recipe_id) {
        ids.add(part.recipe_id);
      }
    });
    return Array.from(ids);
  }, [productParts]);

  // Fetch recipe ingredients
  const { data: recipeIngredients } = useQuery({
    queryKey: ["recipe-ingredients-store", recipeIds],
    queryFn: async () => {
      if (recipeIds.length === 0) return [];

      const { data, error } = await supabase
        .from("recipe_ingredients")
        .select(
          `
          recipe_id,
          ingredient_id,
          quantity,
          ingredients (
            id,
            name,
            unit,
            price,
            kiloPerUnit,
            ingredient_categories (name)
          ),
          recipes (
            id,
            quantity,
            name
          )
        `
        )
        .in("recipe_id", recipeIds);

      if (error) throw error;
      return data || [];
    },
    enabled: recipeIds.length > 0,
  });

  // Calculate ingredient consumption
  const ingredientConsumption = useMemo<{
    ingredients: IngredientConsumption[];
    totalCost: number;
  }>(() => {
    if (!productions || productions.length === 0) {
      return { ingredients: [], totalCost: 0 };
    }

    if (!productParts || !recipeIngredients) {
      return { ingredients: [], totalCost: 0 };
    }

    const consumptionMap = new Map<string, IngredientConsumption>();

    // Create mappings
    const productToRecipeMap: Record<
      number,
      Array<{ recipe_id: number; quantity: number }>
    > = {};
    const productToIngredientsMap: Record<
      number,
      Array<{ ingredient_id: number; quantity: number; ingredient: any }>
    > = {};
    const productToPastryMap: Record<
      number,
      Array<{
        pastry_id: number;
        quantity: number;
        pastry: any;
        bakerOnly: boolean;
      }>
    > = {};

    productParts.forEach((part: any) => {
      if (part.recipe_id && !part.productOnly && !part.bakerOnly) {
        if (!productToRecipeMap[part.product_id]) {
          productToRecipeMap[part.product_id] = [];
        }
        productToRecipeMap[part.product_id].push({
          recipe_id: part.recipe_id,
          quantity: part.quantity,
        });
      }

      if (part.ingredient_id && part.ingredients && !part.bakerOnly) {
        if (!productToIngredientsMap[part.product_id]) {
          productToIngredientsMap[part.product_id] = [];
        }
        productToIngredientsMap[part.product_id].push({
          ingredient_id: part.ingredient_id,
          quantity: part.quantity,
          ingredient: part.ingredients,
        });
      }

      if (part.pastry_id && part.products) {
        if (!productToPastryMap[part.product_id]) {
          productToPastryMap[part.product_id] = [];
        }
        productToPastryMap[part.product_id].push({
          pastry_id: part.pastry_id,
          quantity: part.quantity,
          pastry: part.products,
          bakerOnly: part.bakerOnly || false,
        });
      }
    });

    // Process each production
    productions.forEach((production: any) => {
      production.production_items?.forEach((item: any) => {
        if (item.products?.id && item.quantity) {
          const productId = item.products.id;
          const productQuantity = item.quantity;

          // Process recipe-based ingredients
          const recipes = productToRecipeMap[productId] || [];
          recipes.forEach((recipeMapping: any) => {
            const totalDoughWeight = recipeMapping.quantity * productQuantity;

            const ingredientsForRecipe = recipeIngredients.filter(
              (ri: any) => ri.recipe_id === recipeMapping.recipe_id
            );

            ingredientsForRecipe.forEach((ri: any) => {
              if (ri.ingredients && ri.recipes) {
                const ingredient = ri.ingredients;
                const baseQty = ri.quantity || 0;
                const baseRecipeWeight = ri.recipes.quantity || 1;
                const proportion = baseQty / baseRecipeWeight;
                let ingredientQuantity = proportion * totalDoughWeight;

                let displayUnit = ingredient.unit || "kg";
                if (
                  ingredient.unit &&
                  ingredient.unit !== "kg" &&
                  ingredient.kiloPerUnit
                ) {
                  ingredientQuantity =
                    ingredientQuantity * ingredient.kiloPerUnit;
                  displayUnit = "kg";
                }

                const key = `ingredient_${ingredient.id}`;
                if (!consumptionMap.has(key)) {
                  consumptionMap.set(key, {
                    id: ingredient.id,
                    name: ingredient.name,
                    unit: displayUnit,
                    quantity: 0,
                    price: ingredient.price || 0,
                    totalCost: 0,
                    categoryName:
                      ingredient.ingredient_categories?.name || "Nezařazené",
                    type: "ingredient",
                  });
                }

                const consumption = consumptionMap.get(key)!;
                consumption.quantity += ingredientQuantity;
                consumption.totalCost =
                  consumption.quantity * consumption.price;
              }
            });
          });

          // Process direct ingredients
          const directIngredients = productToIngredientsMap[productId] || [];
          directIngredients.forEach((directIngredient: any) => {
            const ingredient = directIngredient.ingredient;
            let ingredientQuantity =
              directIngredient.quantity * productQuantity;

            let displayUnit = ingredient.unit || "kg";
            if (
              ingredient.unit &&
              ingredient.unit !== "kg" &&
              ingredient.kiloPerUnit
            ) {
              ingredientQuantity = ingredientQuantity * ingredient.kiloPerUnit;
              displayUnit = "kg";
            }

            const key = `ingredient_${ingredient.id}`;
            if (!consumptionMap.has(key)) {
              consumptionMap.set(key, {
                id: ingredient.id,
                name: ingredient.name,
                unit: displayUnit,
                quantity: 0,
                price: ingredient.price || 0,
                totalCost: 0,
                categoryName:
                  ingredient.ingredient_categories?.name || "Nezařazené",
                type: "ingredient",
              });
            }

            const consumption = consumptionMap.get(key)!;
            consumption.quantity += ingredientQuantity;
            consumption.totalCost = consumption.quantity * consumption.price;
          });

          // Process pastry products
          const pastryProducts = productToPastryMap[productId] || [];
          pastryProducts.forEach((pastryProduct: any) => {
            if (pastryProduct.bakerOnly) {
              return;
            }

            const product = pastryProduct.pastry;
            const pastryQuantity = pastryProduct.quantity * productQuantity;

            const key = `product_${product.id}`;
            if (!consumptionMap.has(key)) {
              consumptionMap.set(key, {
                id: product.id,
                name: product.name,
                unit: "ks",
                quantity: 0,
                price: product.priceBuyer || 0,
                totalCost: 0,
                categoryName: "Produkty",
                type: "product",
              });
            }

            const consumption = consumptionMap.get(key)!;
            consumption.quantity += pastryQuantity;
            consumption.totalCost = consumption.quantity * consumption.price;
          });
        }
      });
    });

    const ingredients = Array.from(consumptionMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "cs")
    );

    const totalCost = ingredients.reduce(
      (sum, ingredient) => sum + ingredient.totalCost,
      0
    );

    return { ingredients, totalCost };
  }, [productions, productParts, recipeIngredients]);

  // Calculate ingredient breakdown for selected ingredient
  const calculateIngredientBreakdown = (
    selectedIngredientId: number
  ): IngredientBreakdown => {
    if (!productions || !productParts || !recipeIngredients) {
      return { recipes: [], products: [] };
    }

    const contributingRecipes = new Map();
    const contributingProducts = new Map();

    // Create mappings (same as above)
    const productToRecipeMap: Record<
      number,
      Array<{ recipe_id: number; quantity: number }>
    > = {};
    const productToIngredientsMap: Record<
      number,
      Array<{ ingredient_id: number; quantity: number; ingredient: any }>
    > = {};
    const productToPastryMap: Record<
      number,
      Array<{
        pastry_id: number;
        quantity: number;
        pastry: any;
        bakerOnly: boolean;
      }>
    > = {};

    productParts.forEach((part: any) => {
      if (part.recipe_id && !part.productOnly && !part.bakerOnly) {
        if (!productToRecipeMap[part.product_id]) {
          productToRecipeMap[part.product_id] = [];
        }
        productToRecipeMap[part.product_id].push({
          recipe_id: part.recipe_id,
          quantity: part.quantity,
        });
      }

      if (part.ingredient_id && part.ingredients && !part.bakerOnly) {
        if (!productToIngredientsMap[part.product_id]) {
          productToIngredientsMap[part.product_id] = [];
        }
        productToIngredientsMap[part.product_id].push({
          ingredient_id: part.ingredient_id,
          quantity: part.quantity,
          ingredient: part.ingredients,
        });
      }

      if (part.pastry_id && part.products) {
        if (!productToPastryMap[part.product_id]) {
          productToPastryMap[part.product_id] = [];
        }
        productToPastryMap[part.product_id].push({
          pastry_id: part.pastry_id,
          quantity: part.quantity,
          pastry: part.products,
          bakerOnly: part.bakerOnly || false,
        });
      }
    });

    // Process productions
    productions.forEach((production: any) => {
      production.production_items?.forEach((item: any) => {
        if (item.products?.id && item.quantity) {
          const productId = item.products.id;
          const productQuantity = item.quantity;

          // Process recipe-based ingredients
          const recipes = productToRecipeMap[productId] || [];
          recipes.forEach((recipeMapping: any) => {
            const ingredientsForRecipe = recipeIngredients.filter(
              (ri: any) => ri.recipe_id === recipeMapping.recipe_id
            );

            const hasSelectedIngredient = ingredientsForRecipe.some(
              (ri: any) => ri.ingredients?.id === selectedIngredientId
            );

            if (hasSelectedIngredient) {
              ingredientsForRecipe.forEach((ri: any) => {
                if (
                  ri.ingredients &&
                  ri.recipes &&
                  ri.ingredients.id === selectedIngredientId
                ) {
                  const ingredient = ri.ingredients;
                  const totalDoughWeight =
                    recipeMapping.quantity * productQuantity;
                  const baseQty = ri.quantity || 0;
                  const baseRecipeWeight = ri.recipes.quantity || 1;
                  const proportion = baseQty / baseRecipeWeight;
                  let ingredientQuantity = proportion * totalDoughWeight;

                  let displayUnit = ingredient.unit || "kg";
                  if (
                    ingredient.unit &&
                    ingredient.unit !== "kg" &&
                    ingredient.kiloPerUnit
                  ) {
                    ingredientQuantity =
                      ingredientQuantity * ingredient.kiloPerUnit;
                    displayUnit = "kg";
                  }

                  const recipeKey = `${ri.recipe_id}`;
                  if (!contributingRecipes.has(recipeKey)) {
                    contributingRecipes.set(recipeKey, {
                      id: ri.recipe_id,
                      name: ri.recipes.name || `Recept #${ri.recipe_id}`,
                      quantity: 0,
                      unit: displayUnit,
                      totalCost: 0,
                      type: "recipe",
                    });
                  }
                  const recipeContrib = contributingRecipes.get(recipeKey);
                  recipeContrib.quantity += ingredientQuantity;
                  recipeContrib.totalCost =
                    recipeContrib.quantity * (ingredient.price || 0);

                  const productKey = `${productId}`;
                  if (!contributingProducts.has(productKey)) {
                    contributingProducts.set(productKey, {
                      id: productId,
                      name: item.products.name,
                      quantity: productQuantity,
                      unit: "ks",
                      totalCost: 0,
                      type: "product",
                    });
                  } else {
                    const existingProduct =
                      contributingProducts.get(productKey);
                    existingProduct.quantity += productQuantity;
                  }
                }
              });
            }
          });

          // Process direct ingredients
          const directIngredients = productToIngredientsMap[productId] || [];
          directIngredients.forEach((directIngredient: any) => {
            if (directIngredient.ingredient.id === selectedIngredientId) {
              const productKey = `${productId}`;
              if (!contributingProducts.has(productKey)) {
                contributingProducts.set(productKey, {
                  id: productId,
                  name: item.products.name,
                  quantity: productQuantity,
                  unit: "ks",
                  totalCost: 0,
                  type: "product",
                });
              } else {
                const existingProduct = contributingProducts.get(productKey);
                existingProduct.quantity += productQuantity;
              }
            }
          });

          // Process pastry products
          const pastryProducts = productToPastryMap[productId] || [];
          pastryProducts.forEach((pastryProduct: any) => {
            if (pastryProduct.bakerOnly) {
              return;
            }

            if (pastryProduct.pastry.id === selectedIngredientId) {
              const productKey = `${productId}`;
              if (!contributingProducts.has(productKey)) {
                contributingProducts.set(productKey, {
                  id: productId,
                  name: item.products.name,
                  quantity: productQuantity,
                  unit: "ks",
                  totalCost: 0,
                  type: "product",
                });
              } else {
                const existingProduct = contributingProducts.get(productKey);
                existingProduct.quantity += productQuantity;
              }
            }
          });
        }
      });
    });

    return {
      recipes: Array.from(contributingRecipes.values()).sort(
        (a, b) => b.quantity - a.quantity
      ),
      products: Array.from(contributingProducts.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    };
  };

  // Filter ingredients
  const filteredIngredients = useMemo(() => {
    if (!globalFilter) return ingredientConsumption.ingredients;

    const lowerFilter = removeDiacritics(globalFilter.toLowerCase());
    return ingredientConsumption.ingredients.filter((ingredient) =>
      removeDiacritics(ingredient.name.toLowerCase()).includes(lowerFilter)
    );
  }, [ingredientConsumption.ingredients, globalFilter]);

  // Group by category
  const groupedByCategory = useMemo(() => {
    const grouped = new Map<string, IngredientConsumption[]>();
    filteredIngredients.forEach((ingredient) => {
      const category = ingredient.categoryName;
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(ingredient);
    });
    return Array.from(grouped.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], "cs")
    );
  }, [filteredIngredients]);

  // Export to CSV
  const exportToCSV = () => {
    const csvHeader =
      "Název suroviny,Typ,Množství,Jednotka,Cena za jednotku (Kč),Celkové náklady (Kč),Kategorie\n";
    const csvData = ingredientConsumption.ingredients
      .map(
        (ingredient) =>
          `"${ingredient.name}","${
            ingredient.type === "product" ? "Produkt" : "Surovina"
          }",${ingredient.quantity.toFixed(2)},"${
            ingredient.unit
          }",${ingredient.price.toFixed(2)},${ingredient.totalCost.toFixed(
            2
          )},"${ingredient.categoryName}"`
      )
      .join("\n");

    const csvContent =
      csvHeader +
      csvData +
      `\n\nCelkové náklady:,,,,,${ingredientConsumption.totalCost.toFixed(2)},`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);

    const storeName = selectedUserId
      ? storeUsers?.find((u) => u.id === selectedUserId)?.full_name || ""
      : "vsechny";
    const fileName = `spotreba_surovin_${storeName.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd_HH-mm")}.csv`;

    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "CSV exportováno",
      description: "Soubor byl úspěšně stažen",
    });
  };

  if (productionsError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Chyba při načítání dat</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Nepodařilo se načíst data o výrobách</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="h-6 w-6" />
              Spotřeba surovin - Prodejny
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoadingProductions}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoadingProductions ? "animate-spin" : ""}`}
                />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                disabled={isLoadingProductions}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportovat CSV
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Hledat surovinu..."
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {format(startDate, "d. MMM", { locale: cs })} -{" "}
                  {format(endDate, "d. MMM yyyy", { locale: cs })}
                </span>
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-2">
              {selectedUserId && (
                <div className="text-sm text-muted-foreground">
                  Prodejna:{" "}
                  <span className="font-semibold">
                    {storeUsers?.find((u) => u.id === selectedUserId)
                      ?.full_name || "Všechny prodejny"}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Celkové náklady na suroviny
                  </p>
                  <p className="text-2xl font-bold text-orange-600">
                    {ingredientConsumption.totalCost.toFixed(2)} Kč
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Počet položek</p>
                  <p className="text-2xl font-bold">
                    {filteredIngredients.length}
                  </p>
                </div>
              </div>
            </div>

            {/* Loading state */}
            {isLoadingProductions && (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            )}

            {/* Ingredients table grouped by category */}
            {!isLoadingProductions && groupedByCategory.length > 0 && (
              <div className="space-y-4">
                {groupedByCategory.map(([category, ingredients]) => (
                  <Collapsible key={category} defaultOpen>
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-90" />
                        <span className="font-semibold">{category}</span>
                        <Badge variant="secondary">{ingredients.length}</Badge>
                      </div>
                      <span className="text-sm font-semibold text-orange-600">
                        {ingredients
                          .reduce((sum, ing) => sum + ing.totalCost, 0)
                          .toFixed(2)}{" "}
                        Kč
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Název</TableHead>
                            <TableHead>Typ</TableHead>
                            <TableHead className="text-right">
                              Množství
                            </TableHead>
                            <TableHead className="text-right">
                              Jednotka
                            </TableHead>
                            <TableHead className="text-right">
                              Cena/jednotka
                            </TableHead>
                            <TableHead className="text-right">Celkem</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ingredients.map((ingredient) => (
                            <TableRow
                              key={`${ingredient.type}_${ingredient.id}`}
                              className="cursor-pointer hover:bg-gray-50"
                              onClick={() => {
                                setSelectedIngredient(ingredient);
                                setShowBreakdownDialog(true);
                              }}
                            >
                              <TableCell className="font-medium">
                                {ingredient.name}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    ingredient.type === "product"
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {ingredient.type === "product"
                                    ? "Produkt"
                                    : "Surovina"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {ingredient.quantity.toFixed(3)}
                              </TableCell>
                              <TableCell className="text-right">
                                {ingredient.unit}
                              </TableCell>
                              <TableCell className="text-right">
                                {ingredient.price.toFixed(2)} Kč
                              </TableCell>
                              <TableCell className="text-right font-semibold text-orange-600">
                                {ingredient.totalCost.toFixed(2)} Kč
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!isLoadingProductions && filteredIngredients.length === 0 && (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Žádné suroviny nenalezeny
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ingredient Breakdown Dialog */}
      <Dialog open={showBreakdownDialog} onOpenChange={setShowBreakdownDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rozklad: {selectedIngredient?.name || ""}</DialogTitle>
          </DialogHeader>
          {selectedIngredient && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Celkové množství
                  </p>
                  <p className="text-lg font-semibold">
                    {selectedIngredient.quantity.toFixed(3)}{" "}
                    {selectedIngredient.unit}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Celkové náklady
                  </p>
                  <p className="text-lg font-semibold text-orange-600">
                    {selectedIngredient.totalCost.toFixed(2)} Kč
                  </p>
                </div>
              </div>

              {(() => {
                const breakdown = calculateIngredientBreakdown(
                  selectedIngredient.id
                );

                return (
                  <div className="space-y-4">
                    {/* Recipes section */}
                    {breakdown.recipes.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">
                          Recepty (suroviny)
                        </h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Název</TableHead>
                              <TableHead className="text-right">
                                Množství
                              </TableHead>
                              <TableHead className="text-right">
                                Náklady
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {breakdown.recipes.map((recipe) => (
                              <TableRow key={`recipe-${recipe.id}`}>
                                <TableCell>{recipe.name}</TableCell>
                                <TableCell className="text-right">
                                  {recipe.quantity.toFixed(3)} {recipe.unit}
                                </TableCell>
                                <TableCell className="text-right">
                                  {recipe.totalCost.toFixed(2)} Kč
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Products section */}
                    {breakdown.products.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">Produkty</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Název</TableHead>
                              <TableHead className="text-right">
                                Množství
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {breakdown.products.map((product) => (
                              <TableRow key={`product-${product.id}`}>
                                <TableCell>{product.name}</TableCell>
                                <TableCell className="text-right">
                                  {product.quantity} {product.unit}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {breakdown.recipes.length === 0 &&
                      breakdown.products.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">
                          Žádný rozklad nenalezen
                        </p>
                      )}
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
