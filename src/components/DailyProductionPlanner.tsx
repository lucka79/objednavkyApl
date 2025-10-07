import { useState, useMemo } from "react";
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

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar as CalendarIcon,
  Package,
  Plus,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Factory,
  Bug,
} from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

import { useToast } from "@/hooks/use-toast";
import { useDailyProductionPlanner } from "@/hooks/useDailyProductionPlanner";
import { useCreateBakerProduction } from "@/hooks/useBakerProductions";
import { useAvailableProductionDates } from "@/hooks/useAvailableProductionDates";
import { useManualBakerSync } from "@/hooks/useBakerSync";

interface ProductionItem {
  productId: number;
  productName: string;
  totalOrdered: number;
  plannedQuantity: number;
  category: string;
  hasRecipe: boolean;
  recipeId?: number;
  recipeName?: string;
  bakerId?: number;
  bakerStatus?: string;
  bakerNotes?: string;
  actualQuantity?: number;
  completedQuantity?: number;
  isCompleted?: boolean;
}

export function DailyProductionPlanner() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingFromOrders, setIsCreatingFromOrders] = useState(false);
  const { toast } = useToast();
  const createBakerProduction = useCreateBakerProduction();
  const manualBakerSync = useManualBakerSync();

  // Fetch daily production planning data
  const {
    data: productionData,
    isLoading,
    error,
  } = useDailyProductionPlanner(selectedDate);

  // Fetch available production dates
  const { data: availableDates } = useAvailableProductionDates();

  // Check if a date has production data
  const hasProductionData = (date: Date) => {
    if (!availableDates) return false;
    const dateStr = date.toISOString().split("T")[0];
    return availableDates.includes(dateStr);
  };

  // Calculate production summary
  const productionSummary = useMemo(() => {
    if (!productionData) return null;

    const totalProducts = productionData.length;
    const totalQuantity = productionData.reduce(
      (sum, item) => sum + item.plannedQuantity,
      0
    );
    const productsWithRecipes = productionData.filter(
      (item) => item.hasRecipe
    ).length;
    const productsWithoutRecipes = productionData.filter(
      (item) => !item.hasRecipe
    ).length;

    return {
      totalProducts,
      totalQuantity,
      productsWithRecipes,
      productsWithoutRecipes,
    };
  }, [productionData]);

  const handleCreateProduction = async () => {
    if (!productionData) return;

    setIsCreating(true);
    try {
      // Group products by recipe for better organization
      const productsByRecipe = productionData.reduce(
        (acc, item) => {
          const recipeKey = item.recipeId
            ? `recipe_${item.recipeId}`
            : "no_recipe";
          if (!acc[recipeKey]) {
            acc[recipeKey] = {
              recipeId: item.recipeId,
              recipeName: item.recipeName || "Bez receptu",
              products: [],
            };
          }
          acc[recipeKey].products.push(item);
          return acc;
        },
        {} as Record<
          string,
          { recipeId?: number; recipeName: string; products: ProductionItem[] }
        >
      );

      // Create baker production for each recipe
      const productionPromises = Object.entries(productsByRecipe).map(
        async ([, recipeData]) => {
          if (!recipeData.recipeId) {
            console.warn(
              `No recipe found for products: ${recipeData.products.map((p) => p.productName).join(", ")}`
            );
            return null;
          }

          // Create baker production
          const bakerData = {
            date: selectedDate.toISOString().split("T")[0],
            recipe_id: recipeData.recipeId,
            status: "planned",
            notes: `Automaticky vytvořené pro recept: ${recipeData.recipeName}`,
          };

          const bakerResult =
            await createBakerProduction.mutateAsync(bakerData);

          if (!bakerResult) return null;

          // Create baker items for each product
          const bakerItems = recipeData.products.map((product) => ({
            production_id: bakerResult.id,
            product_id: product.productId,
            planned_quantity: product.plannedQuantity,
            recipe_quantity: product.plannedQuantity,
          }));

          return { baker: bakerResult, items: bakerItems };
        }
      );

      const results = await Promise.all(productionPromises);
      const successfulResults = results.filter(Boolean);

      toast({
        title: "Úspěch",
        description: `Vytvořeno ${successfulResults.length} produkčních plánů pro ${productionData.length} produktů`,
      });
    } catch (error) {
      toast({
        title: "Chyba",
        description: "Nepodařilo se vytvořit produkční plány",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateFromOrders = async () => {
    if (!productionData) return;

    setIsCreatingFromOrders(true);
    try {
      // Group products by recipe for better organization
      const productsByRecipe = productionData.reduce(
        (acc, item) => {
          const recipeKey = item.recipeId
            ? `recipe_${item.recipeId}`
            : "no_recipe";
          if (!acc[recipeKey]) {
            acc[recipeKey] = {
              recipeId: item.recipeId,
              recipeName: item.recipeName || "Bez receptu",
              products: [],
            };
          }
          acc[recipeKey].products.push(item);
          return acc;
        },
        {} as Record<
          string,
          { recipeId?: number; recipeName: string; products: ProductionItem[] }
        >
      );

      // Create baker production for each recipe
      const productionPromises = Object.entries(productsByRecipe).map(
        async ([, recipeData]) => {
          if (!recipeData.recipeId) {
            console.warn(
              `No recipe found for products: ${recipeData.products.map((p) => p.productName).join(", ")}`
            );
            return null;
          }

          // Create baker production
          const bakerData = {
            date: selectedDate.toISOString().split("T")[0],
            recipe_id: recipeData.recipeId,
            status: "planned",
            notes: `Vytvořeno z objednávek pro recept: ${recipeData.recipeName}`,
          };

          const bakerResult =
            await createBakerProduction.mutateAsync(bakerData);

          if (!bakerResult) return null;

          // Create baker items for each product
          const bakerItems = recipeData.products.map((product) => ({
            production_id: bakerResult.id,
            product_id: product.productId,
            planned_quantity: product.totalOrdered, // Use ordered quantity
            recipe_quantity: product.totalOrdered,
          }));

          return { baker: bakerResult, items: bakerItems };
        }
      );

      const results = await Promise.all(productionPromises);
      const successfulResults = results.filter(Boolean);

      toast({
        title: "Úspěch",
        description: `Vytvořeno ${successfulResults.length} produkčních plánů z objednávek pro ${productionData.length} produktů`,
      });
    } catch (error) {
      toast({
        title: "Chyba",
        description: "Nepodařilo se vytvořit produkční plány z objednávek",
        variant: "destructive",
      });
    } finally {
      setIsCreatingFromOrders(false);
    }
  };

  const handleManualSync = async () => {
    try {
      await manualBakerSync.mutateAsync({
        date: selectedDate,
      });
    } catch (error) {
      console.error("Manual sync failed:", error);
    }
  };

  const handleDebugProduct10 = async () => {
    console.log("=== DEBUGGING PRODUCT ID 10 ===");

    try {
      // Import supabase
      const { supabase } = await import("@/lib/supabase");
      const today = selectedDate.toISOString().split("T")[0];

      // 1. Check product details
      console.log("\n1. PRODUCT DETAILS:");
      const { data: product, error: productError } = await supabase
        .from("products")
        .select(
          `
          id,
          name,
          category_id,
          categories!inner(
            id,
            name
          )
        `
        )
        .eq("id", 10)
        .single();

      if (productError) {
        console.error("Error fetching product:", productError);
      } else {
        console.log("Product:", product);
      }

      // 2. Check product_parts
      console.log("\n2. PRODUCT_PARTS DATA:");
      const { data: productParts, error: partsError } = await supabase
        .from("product_parts")
        .select(
          `
          id,
          product_id,
          recipe_id,
          quantity,
          bakerOnly,
          recipes!inner(
            id,
            name,
            baker
          )
        `
        )
        .eq("product_id", 10);

      if (partsError) {
        console.error("Error fetching product_parts:", partsError);
      } else {
        console.log("Product parts:", productParts);
        if (productParts && productParts.length > 0) {
          const part = productParts[0];
          console.log(
            `Part quantity: ${part.quantity} (type: ${typeof part.quantity})`
          );
          console.log(
            `Recipe: ${part.recipes[0]?.name} (ID: ${part.recipes[0]?.id})`
          );
        }
      }

      // 3. Check today's orders
      console.log("\n3. TODAY'S ORDERS:");
      const { data: orders, error: ordersError } = await supabase
        .from("order_items")
        .select(
          `
          id,
          quantity,
          order_id,
          orders!inner(
            id,
            date,
            user_id,
            status
          )
        `
        )
        .eq("product_id", 10)
        .eq("orders.date", today);

      if (ordersError) {
        console.error("Error fetching orders:", ordersError);
      } else {
        console.log("Orders for today:", orders);
        const totalOrdered =
          orders?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        console.log(`Total ordered today: ${totalOrdered}`);
      }

      // 4. Calculate expected
      console.log("\n4. EXPECTED CALCULATION:");
      if (
        productParts &&
        productParts.length > 0 &&
        orders &&
        orders.length > 0
      ) {
        const part = productParts[0];
        const totalOrdered = orders.reduce(
          (sum, item) => sum + item.quantity,
          0
        );

        console.log(`Product: ${product?.name || "Unknown"}`);
        console.log(`Total ordered: ${totalOrdered} units`);
        console.log(`Part quantity per unit: ${part.quantity}`);
        console.log(`Recipe: ${part.recipes[0]?.name || "Unknown"}`);

        const totalIngredientNeeded = totalOrdered * parseFloat(part.quantity);
        const plannedQuantity = Math.max(1, Math.ceil(totalIngredientNeeded));

        console.log(`\nCalculation:`);
        console.log(
          `${totalOrdered} units × ${part.quantity} = ${totalIngredientNeeded} total ingredient needed`
        );
        console.log(`Planned quantity (ceiled): ${plannedQuantity}`);

        if (plannedQuantity >= 1) {
          console.log("✅ This should pass the constraint check");
        } else {
          console.log("❌ This would fail the constraint check");
        }
      } else {
        console.log("❌ Missing data for calculation");
      }

      console.log("\n=== DEBUG COMPLETE ===");
    } catch (error) {
      console.error("Debug failed:", error);
    }
  };

  const handleDebugRecipe92 = async () => {
    console.log("=== DEBUGGING RECIPE 92 (ALL PRODUCTS) ===");

    try {
      // Import supabase
      const { supabase } = await import("@/lib/supabase");
      const today = selectedDate.toISOString().split("T")[0];

      // 1. Get all products using recipe 92
      console.log("\n1. ALL PRODUCTS USING RECIPE 92:");
      const { data: allProductsForRecipe, error: productsError } =
        await supabase
          .from("product_parts")
          .select(
            `
            product_id,
            quantity,
            products!product_parts_product_id_fkey(
              id,
              name,
              category_id,
              categories!inner(
                id,
                name
              )
            )
          `
          )
          .eq("recipe_id", 92);

      if (productsError) {
        console.error("Error fetching products for recipe 92:", productsError);
      } else {
        console.log("All products using recipe 92:", allProductsForRecipe);
      }

      // 2. Get all orders for these products today
      console.log("\n2. ALL ORDERS FOR RECIPE 92 PRODUCTS TODAY:");
      const productIds = allProductsForRecipe?.map((p) => p.product_id) || [];

      if (productIds.length > 0) {
        const { data: allOrders, error: ordersError } = await supabase
          .from("order_items")
          .select(
            `
            id,
            product_id,
            quantity,
            orders!inner(
              id,
              date,
              user_id,
              status
            )
          `
          )
          .in("product_id", productIds)
          .eq("orders.date", today);

        if (ordersError) {
          console.error("Error fetching orders:", ordersError);
        } else {
          console.log("All orders for recipe 92 products today:", allOrders);

          // 3. Calculate totals by product
          console.log("\n3. CALCULATION BY PRODUCT:");
          const productTotals = new Map();

          for (const order of allOrders || []) {
            const productId = order.product_id;
            if (!productTotals.has(productId)) {
              productTotals.set(productId, {
                product_id: productId,
                total_ordered: 0,
                product_name:
                  allProductsForRecipe?.find((p) => p.product_id === productId)
                    ?.products?.[0]?.name || "Unknown",
              });
            }
            productTotals.get(productId).total_ordered += order.quantity;
          }

          console.log("Product totals:", Array.from(productTotals.values()));

          // 4. Show sum of all products using recipe 92
          console.log("\n4. SUM OF ALL PRODUCTS USING RECIPE 92:");
          const totalProductsOrdered = Array.from(
            productTotals.values()
          ).reduce((sum, product) => sum + product.total_ordered, 0);
          console.log(`Total products ordered: ${totalProductsOrdered} units`);
          console.log(`Number of different products: ${productTotals.size}`);

          // 5. Calculate total ingredient needed for recipe 92
          console.log("\n5. TOTAL INGREDIENT CALCULATION FOR RECIPE 92:");
          let totalIngredientNeeded = 0;

          for (const [productId, productData] of productTotals) {
            const productPart = allProductsForRecipe?.find(
              (p) => p.product_id === productId
            );
            if (productPart) {
              const ingredientForThisProduct =
                productData.total_ordered * parseFloat(productPart.quantity);
              totalIngredientNeeded += ingredientForThisProduct;

              console.log(
                `${productData.product_name}: ${productData.total_ordered} units × ${productPart.quantity} = ${ingredientForThisProduct} ingredient`
              );
            }
          }

          const plannedQuantity = Math.max(1, Math.ceil(totalIngredientNeeded));
          console.log(`\nTOTAL INGREDIENT NEEDED: ${totalIngredientNeeded}`);
          console.log(`PLANNED QUANTITY (ceiled): ${plannedQuantity}`);

          if (plannedQuantity >= 1) {
            console.log("✅ This should pass the constraint check");
          } else {
            console.log("❌ This would fail the constraint check");
          }
        }
      } else {
        console.log("❌ No products found for recipe 92");
      }

      console.log("\n=== RECIPE 92 DEBUG COMPLETE ===");
    } catch (error) {
      console.error("Recipe 92 debug failed:", error);
    }
  };

  const getStatusIcon = (item: ProductionItem) => {
    if (item.isCompleted) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (item.bakerStatus === "in_progress") {
      return <RefreshCw className="h-4 w-4 text-blue-500" />;
    } else if (item.hasRecipe) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else {
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    }
  };

  const getStatusBadge = (item: ProductionItem) => {
    if (item.isCompleted) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          Dokončeno
        </Badge>
      );
    } else if (item.bakerStatus === "in_progress") {
      return (
        <Badge variant="default" className="bg-blue-100 text-blue-800">
          V procesu
        </Badge>
      );
    } else if (item.bakerStatus === "planned") {
      return <Badge variant="secondary">Naplánováno</Badge>;
    } else if (item.hasRecipe) {
      return <Badge variant="secondary">Má recept</Badge>;
    } else {
      return (
        <Badge variant="outline" className="text-orange-600">
          Bez receptu
        </Badge>
      );
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center py-8 text-red-600">
          Chyba při načítání plánování: {error.message}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold">Plánovač denní produkce</h2>
            <p className="text-muted-foreground">
              Automatické vytvoření produkčních plánů na základě denních
              objednávek
            </p>
          </div>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-48 justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "dd.MM.yyyy", { locale: cs })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <div className="p-3">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    modifiers={{
                      hasProduction: (date) => hasProductionData(date),
                    }}
                    modifiersClassNames={{
                      hasProduction:
                        "bg-orange-100 text-orange-700 font-semibold",
                    }}
                  />
                  <div className="mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-100 rounded"></div>
                      <span>Dny s produkčními daty</span>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              onClick={handleCreateProduction}
              disabled={isCreating || isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCreating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Vytvářím...
                </>
              ) : (
                <>
                  <Factory className="h-4 w-4 mr-2" />
                  Vytvořit produkci
                </>
              )}
            </Button>
            <Button
              onClick={handleCreateFromOrders}
              disabled={isCreatingFromOrders || isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isCreatingFromOrders ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Vytvářím z objednávek...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 mr-2" />
                  Vytvořit z objednávek
                </>
              )}
            </Button>
            <Button
              onClick={handleManualSync}
              disabled={manualBakerSync.isPending || isLoading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {manualBakerSync.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Synchronizuji...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Synchronizovat DB
                </>
              )}
            </Button>
            <Button
              onClick={handleDebugProduct10}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Bug className="h-4 w-4 mr-2" />
              Debug Product 10
            </Button>
            <Button
              onClick={handleDebugRecipe92}
              className="bg-red-600 hover:bg-red-700"
            >
              <Bug className="h-4 w-4 mr-2" />
              Debug Recipe 92
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {productionSummary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Celkem produktů
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {productionSummary.totalProducts}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Celkové množství
                </CardTitle>
                <Plus className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {productionSummary.totalQuantity}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">S recepty</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {productionSummary.productsWithRecipes}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Bez receptů
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {productionSummary.productsWithoutRecipes}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recipe Summary Cards */}
        {productionData && productionData.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Recepty pro vybraný den</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(() => {
                // Group products by recipe
                const recipeMap = new Map<
                  string,
                  {
                    recipeId?: number;
                    recipeName: string;
                    totalQuantity: number;
                    productCount: number;
                    products: Map<string, number>;
                  }
                >();

                productionData.forEach((item) => {
                  const recipeKey = item.recipeId
                    ? `recipe_${item.recipeId}`
                    : "no_recipe";
                  const recipeName = item.recipeName || "Bez receptu";

                  if (!recipeMap.has(recipeKey)) {
                    recipeMap.set(recipeKey, {
                      recipeId: item.recipeId,
                      recipeName,
                      totalQuantity: 0,
                      productCount: 0,
                      products: new Map<string, number>(), // Use Map to sum quantities by product name
                    });
                  }

                  const recipeData = recipeMap.get(recipeKey)!;
                  recipeData.totalQuantity += item.plannedQuantity;
                  recipeData.productCount += 1;

                  // Sum quantities for products with the same name
                  const currentQuantity =
                    recipeData.products.get(item.productName) || 0;
                  recipeData.products.set(
                    item.productName,
                    currentQuantity + item.plannedQuantity
                  );

                  // Debug logging
                  console.log(
                    `Recipe card: ${recipeName} - Product: ${item.productName} - Planned Quantity: ${item.plannedQuantity}`
                  );
                });

                return Array.from(recipeMap.values()).map(
                  (recipeData, index) => (
                    <Card key={index}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">
                          {recipeData.recipeName}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {recipeData.products.size} produktů
                          </Badge>
                          <Badge variant="outline">
                            {recipeData.totalQuantity} ks celkem
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {Array.from(recipeData.products.entries())
                            .sort(([nameA], [nameB]) =>
                              nameA.localeCompare(nameB)
                            )
                            .map(([productName, quantity], productIndex) => (
                              <div
                                key={productIndex}
                                className="flex justify-between items-center text-sm"
                              >
                                <span className="truncate">{productName}</span>
                                <span className="text-muted-foreground font-mono">
                                  {quantity} ks
                                </span>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )
                );
              })()}
            </div>
          </div>
        )}

        {/* Production Table */}
        {productionData && productionData.length > 0 ? (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead className="text-right">Objednáno</TableHead>
                  <TableHead className="text-right">Plánované</TableHead>
                  <TableHead className="text-right">Skutečné</TableHead>
                  <TableHead className="text-right">Dokončené</TableHead>
                  <TableHead>Recept</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productionData.map((item, index) => (
                  <TableRow key={`${item.productId}-${item.bakerId || index}`}>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {item.productId}
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.productName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-mono">
                        {item.totalOrdered}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-mono">
                        {item.plannedQuantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-mono">
                        {item.actualQuantity || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-mono">
                        {item.completedQuantity || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {item.hasRecipe ? (
                          <span className="text-green-600">
                            {item.recipeName}
                          </span>
                        ) : (
                          <span className="text-orange-600">Bez receptu</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(item)}
                        {getStatusBadge(item)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <div className="mb-4">
              <strong>Debug Info:</strong>
            </div>
            <div className="text-sm space-y-2">
              <div>Datum: {selectedDate.toISOString().split("T")[0]}</div>
              <div>Načítání: {isLoading ? "Ano" : "Ne"}</div>
              <div>Chyba: {error ? (error as Error).message : "Žádná"}</div>
              <div>Počet dat: {productionData?.length || 0}</div>
              <div>Vytváření produkce: {isCreating ? "Ano" : "Ne"}</div>
              <div>
                Vytváření z objednávek: {isCreatingFromOrders ? "Ano" : "Ne"}
              </div>
              <div>
                Tlačítka povolena:{" "}
                {!isLoading && !isCreating && !isCreatingFromOrders
                  ? "Ano"
                  : "Ne"}
              </div>
            </div>
            <div className="mt-4">
              Žádné objednávky nebo produkční plány nebyly nalezeny pro vybraný
              den.
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
