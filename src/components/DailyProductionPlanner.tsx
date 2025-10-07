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

import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  Plus,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Bug,
} from "lucide-react";
import { format, addDays, subDays } from "date-fns";

import { useDailyProductionPlanner } from "@/hooks/useDailyProductionPlanner";
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

  const manualBakerSync = useManualBakerSync();

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

        {/* Date Tabs */}
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
                  recipeData.totalQuantity += item.totalOrdered;
                  recipeData.productCount += 1;

                  // Sum quantities for products with the same name
                  const currentQuantity =
                    recipeData.products.get(item.productName) || 0;
                  recipeData.products.set(
                    item.productName,
                    currentQuantity + item.totalOrdered
                  );

                  // Debug logging
                  console.log(
                    `Recipe card: ${recipeName} - Product: ${item.productName} - Ordered Quantity: ${item.totalOrdered}`
                  );
                });

                return Array.from(recipeMap.values())
                  .sort((a, b) => a.recipeName.localeCompare(b.recipeName))
                  .map((recipeData, index) => (
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
                  ));
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
