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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  Plus,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Bug,
  Calendar as CalendarIcon,
} from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { cs } from "date-fns/locale";

import { useDailyProductionPlanner } from "@/hooks/useDailyProductionPlanner";
import { useManualBakerSync } from "@/hooks/useBakerSync";

export function DailyProductionPlanner() {
  const [selectedDate, setSelectedDate] = useState<Date>(
    addDays(new Date(), 1)
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date | undefined>(
    addDays(new Date(), 1)
  );

  const manualBakerSync = useManualBakerSync();

  const handleConfirmDate = () => {
    if (tempDate) {
      setSelectedDate(tempDate);
      setIsCalendarOpen(false);
    }
  };

  // Generate date options (today, yesterday, 2 days ago, 3 days ago, 4 days ago)
  const dateOptions = useMemo(() => {
    const today = new Date();
    return [
      { date: today, label: "Dnes" },
      { date: subDays(today, 1), label: "Včera" },
      { date: subDays(today, 2), label: format(subDays(today, 2), "dd.MM.") },
      { date: subDays(today, 3), label: format(subDays(today, 3), "dd.MM.") },
      { date: subDays(today, 4), label: format(subDays(today, 4), "dd.MM.") },
      { date: addDays(today, 1), label: "Zítra" },
      { date: addDays(today, 2), label: format(addDays(today, 2), "dd.MM.") },
    ];
  }, []);

  // Fetch daily production planning data
  const {
    data: productionData,
    isLoading,
    error,
  } = useDailyProductionPlanner(selectedDate);

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

  const handleDebugRecipe114 = async () => {
    console.log("=== DEBUGGING RECIPE 114 (ALL PRODUCTS) ===");

    try {
      const { supabase } = await import("@/lib/supabase");
      const today = selectedDate.toISOString().split("T")[0];

      console.log(`\nSelected Date: ${today}`);
      console.log("\n1. ALL PRODUCTS USING RECIPE 114:");
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
              categories!inner(id, name)
            )
          `
          )
          .eq("recipe_id", 114);

      if (productsError) {
        console.error("Error fetching products for recipe 114:", productsError);
        return;
      }

      console.log("All products using recipe 114:", allProductsForRecipe);
      console.log(
        "Number of products with recipe 114:",
        allProductsForRecipe?.length || 0
      );

      if (allProductsForRecipe && allProductsForRecipe.length > 0) {
        console.log("Product details:");
        allProductsForRecipe.forEach((p, i) => {
          console.log(
            `  ${i + 1}. Product ID: ${p.product_id}, Name: ${p.products?.[0]?.name}, Quantity: ${p.quantity}`
          );
        });
      }

      const productIds = allProductsForRecipe?.map((p) => p.product_id) || [];
      if (productIds.length === 0) {
        console.log("❌ No products found for recipe 114");
        return;
      }

      console.log("Product IDs to search:", productIds);

      console.log("\n2. ALL ORDERS FOR RECIPE 114 PRODUCTS TODAY:");
      const { data: allOrders, error: ordersError } = await supabase
        .from("order_items")
        .select(
          `
          id,
          product_id,
          quantity,
          orders!inner(id, date, user_id, status)
        `
        )
        .in("product_id", productIds)
        .eq("orders.date", today);

      if (ordersError) {
        console.error("Error fetching orders:", ordersError);
        return;
      }

      console.log("All orders for recipe 114 products today:", allOrders);
      console.log("Number of orders found:", allOrders?.length || 0);

      // Debug: Check if there are any orders for these products on ANY date
      const { data: allOrdersAnyDate } = await supabase
        .from("order_items")
        .select(
          `
          id,
          product_id,
          quantity,
          orders!inner(id, date)
        `
        )
        .in("product_id", productIds)
        .limit(10);

      console.log(
        "Orders for these products on ANY date (sample):",
        allOrdersAnyDate
      );
      if (allOrdersAnyDate && allOrdersAnyDate.length > 0) {
        const dates = [
          ...new Set(allOrdersAnyDate.map((o) => (o as any).orders?.date)),
        ];
        console.log("Dates with orders for these products:", dates);
      }

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

      console.log("\n4. SUM OF ALL PRODUCTS USING RECIPE 114:");
      const totalProductsOrdered = Array.from(productTotals.values()).reduce(
        (sum, product) => sum + product.total_ordered,
        0
      );
      console.log(`Total products ordered: ${totalProductsOrdered} units`);
      console.log(`Number of different products: ${productTotals.size}`);

      console.log("\n5. TOTAL INGREDIENT CALCULATION FOR RECIPE 114:");
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

      console.log("\n=== RECIPE 114 DEBUG COMPLETE ===");
    } catch (error) {
      console.error("Recipe 114 debug failed:", error);
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
            <Button
              onClick={handleDebugRecipe114}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              <Bug className="h-4 w-4 mr-2" />
              Debug Recipe 114
            </Button>
          </div>
        </div>

        {/* Date Tabs and Calendar */}
        <div className="flex items-center gap-4">
          <Tabs
            value={selectedDate.toISOString().split("T")[0]}
            onValueChange={(value) => {
              const option = dateOptions.find(
                (opt) => opt.date.toISOString().split("T")[0] === value
              );
              if (option) {
                setSelectedDate(new Date(option.date));
              }
            }}
            className="flex-1"
          >
            <TabsList className="w-full justify-start">
              {dateOptions.map((option) => (
                <TabsTrigger
                  key={option.date.toISOString()}
                  value={option.date.toISOString().split("T")[0]}
                >
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Calendar Dialog */}
          <Dialog open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                onClick={() => {
                  setTempDate(selectedDate);
                  setIsCalendarOpen(true);
                }}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                {format(selectedDate, "dd.MM.yyyy", { locale: cs })}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Vybrat datum</DialogTitle>
                <DialogDescription>
                  Vyberte datum pro zobrazení produkčních plánů
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-center py-4">
                <Calendar
                  mode="single"
                  selected={tempDate}
                  onSelect={setTempDate}
                  initialFocus
                  locale={cs}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCalendarOpen(false)}
                >
                  Zrušit
                </Button>
                <Button onClick={handleConfirmDate}>Potvrdit</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
                    totalRecipeWeight: number; // Saved weight from baker_items
                    totalCalculatedWeight: number; // Calculated from current orders
                    totalPlannedQuantity: number;
                    productCount: number;
                    products: Map<
                      string,
                      {
                        quantity: number;
                        savedWeight: number;
                        calculatedWeight: number;
                      }
                    >;
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
                      totalRecipeWeight: 0, // From saved baker_items
                      totalCalculatedWeight: 0, // Calculated from current orders
                      totalPlannedQuantity: 0,
                      productCount: 0,
                      products: new Map<
                        string,
                        {
                          quantity: number;
                          savedWeight: number;
                          calculatedWeight: number;
                        }
                      >(), // Store detailed product info
                    });
                  }

                  const recipeData = recipeMap.get(recipeKey)!;
                  recipeData.totalQuantity += item.totalOrdered;
                  recipeData.productCount += 1;

                  // Sum planned quantity (calculated from current orders)
                  recipeData.totalPlannedQuantity += item.plannedQuantity;

                  // Sum recipe weight (total dough weight from saved baker_items)
                  if (item.recipeQuantity) {
                    recipeData.totalRecipeWeight += item.recipeQuantity;
                  }

                  // Sum calculated recipe weight (from current orders)
                  if (item.calculatedRecipeWeight) {
                    recipeData.totalCalculatedWeight +=
                      item.calculatedRecipeWeight;
                  }

                  // Store detailed product info (aggregate by product name)
                  const currentProduct = recipeData.products.get(
                    item.productName
                  );
                  if (currentProduct) {
                    currentProduct.quantity += item.totalOrdered;
                    currentProduct.savedWeight += item.recipeQuantity || 0;
                    currentProduct.calculatedWeight +=
                      item.calculatedRecipeWeight || 0;
                  } else {
                    recipeData.products.set(item.productName, {
                      quantity: item.totalOrdered,
                      savedWeight: item.recipeQuantity || 0,
                      calculatedWeight: item.calculatedRecipeWeight || 0,
                    });
                  }
                });

                return Array.from(recipeMap.values())
                  .sort((a, b) => a.recipeName.localeCompare(b.recipeName))
                  .map((recipeData, index) => {
                    return (
                      <Card key={index}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">
                            {recipeData.recipeId && (
                              <span className="text-sm font-mono text-muted-foreground mr-2">
                                #{recipeData.recipeId}
                              </span>
                            )}
                            {recipeData.recipeName}
                          </CardTitle>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary">
                              {recipeData.products.size} produktů
                            </Badge>
                            <Badge variant="outline">
                              {recipeData.totalQuantity} ks celkem
                            </Badge>
                            {recipeData.totalRecipeWeight > 0 ? (
                              // Check if saved weight differs from calculated weight
                              // Allow small tolerance (0.1 kg) to account for rounding differences
                              (() => {
                                const diff = Math.abs(
                                  recipeData.totalRecipeWeight -
                                    recipeData.totalCalculatedWeight
                                );
                                const needsSync = diff > 0.1; // Tolerance: 100g difference

                                return needsSync ? (
                                  <Badge
                                    variant="destructive"
                                    className="bg-yellow-600"
                                  >
                                    Čeká na synchronizaci
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="default"
                                    className="bg-orange-600"
                                  >
                                    {recipeData.totalRecipeWeight.toFixed(2)} kg
                                    těsta
                                  </Badge>
                                );
                              })()
                            ) : // Show calculated weight if no saved weight yet
                            recipeData.totalCalculatedWeight > 0 ? (
                              <Badge
                                variant="outline"
                                className="border-orange-600 text-orange-600"
                              >
                                {recipeData.totalCalculatedWeight.toFixed(2)} kg
                                (nesynchronizováno)
                              </Badge>
                            ) : null}
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {Array.from(recipeData.products.entries())
                              .sort(([nameA], [nameB]) =>
                                nameA.localeCompare(nameB)
                              )
                              .map(
                                ([productName, productData], productIndex) => {
                                  const diff = Math.abs(
                                    productData.savedWeight -
                                      productData.calculatedWeight
                                  );
                                  const needsSync = diff > 0.01; // 10g tolerance for individual products

                                  return (
                                    <div
                                      key={productIndex}
                                      className="flex justify-between items-center text-sm gap-2"
                                    >
                                      <span className="truncate flex-1">
                                        {productName}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        {needsSync &&
                                          productData.savedWeight > 0 && (
                                            <Badge
                                              variant="outline"
                                              className="text-xs border-yellow-600 text-yellow-600"
                                            >
                                              ⚠️
                                            </Badge>
                                          )}
                                        <span className="text-muted-foreground font-mono">
                                          {productData.quantity} ks
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }
                              )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  });
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
                  <TableHead>Recept</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...productionData]
                  .sort((a, b) => {
                    // First sort by category
                    const categoryCompare = a.category.localeCompare(
                      b.category
                    );
                    if (categoryCompare !== 0) return categoryCompare;
                    // Then sort by product name
                    return a.productName.localeCompare(b.productName);
                  })
                  .map((item, index) => (
                    <TableRow
                      key={`${item.productId}-${item.bakerId || index}`}
                    >
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
