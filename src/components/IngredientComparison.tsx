import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAllSupplierCodes } from "@/hooks/useIngredientSupplierCodes";
import { useIngredients } from "@/hooks/useIngredients";
// import { useSupplierUsers } from "@/hooks/useProfiles";
import {
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
} from "lucide-react";

export function IngredientComparison() {
  const { data: allSupplierCodes, isLoading } = useAllSupplierCodes();
  const { data: allIngredients } = useIngredients();
  //   const { data: supplierUsers } = useSupplierUsers();

  // State for selected suppliers
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(
    new Set()
  );

  // State for including ingredients without suppliers
  const [
    includeIngredientsWithoutSuppliers,
    setIncludeIngredientsWithoutSuppliers,
  ] = useState(true);

  // Group supplier codes by supplier
  const groupedBySupplier = allSupplierCodes?.reduce(
    (acc, code) => {
      const supplierId = code.supplier_id;
      if (!acc[supplierId]) {
        acc[supplierId] = {
          supplier: code.supplier,
          codes: [],
        };
      }
      acc[supplierId].codes.push(code);
      return acc;
    },
    {} as Record<string, { supplier: any; codes: any[] }>
  );

  // Group by ingredient for price comparison
  const groupedByIngredient = useMemo(() => {
    if (!allSupplierCodes) return {};

    return allSupplierCodes.reduce(
      (acc, code) => {
        const ingredientId = code.ingredient_id;
        if (!acc[ingredientId]) {
          acc[ingredientId] = {
            ingredient: code.ingredient,
            codes: [],
          };
        }
        acc[ingredientId].codes.push(code);
        return acc;
      },
      {} as Record<number, { ingredient: any; codes: any[] }>
    );
  }, [allSupplierCodes]);

  // Calculate price statistics for each ingredient
  const priceComparisons = useMemo(() => {
    const comparisons: Record<
      number,
      {
        ingredient: any;
        minPrice: number;
        maxPrice: number;
        avgPrice: number;
        priceRange: number;
        codes: any[];
      }
    > = {};

    Object.entries(groupedByIngredient).forEach(
      ([ingredientId, { ingredient, codes }]) => {
        const prices = codes
          .map((code) => code.price)
          .filter((price) => price > 0);

        if (prices.length > 0) {
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          const avgPrice =
            prices.reduce((sum, price) => sum + price, 0) / prices.length;
          const priceRange = maxPrice - minPrice;

          comparisons[Number(ingredientId)] = {
            ingredient,
            minPrice,
            maxPrice,
            avgPrice,
            priceRange,
            codes: codes.sort((a, b) => a.price - b.price),
          };
        }
      }
    );

    return comparisons;
  }, [groupedByIngredient]);

  //   const filteredSuppliers = Object.entries(groupedBySupplier || {}).filter(
  //     ([supplierId]) => supplierFilter === "all" || supplierId === supplierFilter
  //   );

  // Create matrix data structure
  const matrixData = useMemo(() => {
    if (!allSupplierCodes || !allIngredients)
      return {
        ingredients: [],
        suppliers: [],
        matrix: {},
        ingredientsWithoutSuppliers: [],
      };

    // Get all ingredients and sort by category
    let ingredients = allIngredients.ingredients.sort((a, b) => {
      // Sort by category name first, then by ingredient name
      const categoryA = a.ingredient_categories?.name || "Bez kategorie";
      const categoryB = b.ingredient_categories?.name || "Bez kategorie";

      if (categoryA !== categoryB) {
        return categoryA.localeCompare(categoryB);
      }

      return a.name.localeCompare(b.name);
    });

    // Get unique suppliers and sort by number of ingredients
    const allSuppliers = Object.values(groupedBySupplier || {})
      .map(({ supplier, codes }) => ({ supplier, count: codes.length }))
      .sort((a, b) => b.count - a.count) // Sort by count descending
      .map(({ supplier }) => supplier);

    // Filter suppliers based on selection (if none selected, show all)
    const suppliers =
      selectedSuppliers.size > 0
        ? allSuppliers.filter((supplier) => selectedSuppliers.has(supplier.id))
        : allSuppliers;

    // Create matrix: ingredient_id -> supplier_id -> code data
    const matrix: Record<number, Record<string, any>> = {};

    allSupplierCodes.forEach((code) => {
      if (!matrix[code.ingredient_id]) {
        matrix[code.ingredient_id] = {};
      }
      matrix[code.ingredient_id][code.supplier_id] = code;
    });

    // Find ingredients without any supplier codes
    const ingredientsWithoutSuppliers = ingredients.filter(
      (ingredient) =>
        !matrix[ingredient.id] ||
        Object.keys(matrix[ingredient.id]).length === 0
    );

    // Filter ingredients based on whether to include ingredients without suppliers
    if (!includeIngredientsWithoutSuppliers) {
      ingredients = ingredients.filter(
        (ingredient) =>
          matrix[ingredient.id] && Object.keys(matrix[ingredient.id]).length > 0
      );
    }

    return {
      ingredients,
      suppliers,
      matrix,
      ingredientsWithoutSuppliers,
    };
  }, [
    allSupplierCodes,
    allIngredients,
    groupedBySupplier,
    selectedSuppliers,
    includeIngredientsWithoutSuppliers,
  ]);

  // CSV export function
  const exportToCSV = () => {
    if (!matrixData.ingredients.length || !matrixData.suppliers.length) return;

    // Create CSV headers
    const headers = [
      "Surovina",
      "Jednotka",
      "Kategorie",
      ...matrixData.suppliers.map((supplier) => `${supplier.full_name} (Cena)`),
      ...(includeIngredientsWithoutSuppliers &&
      matrixData.ingredientsWithoutSuppliers.length > 0
        ? ["Hlavní cena"]
        : []),
    ];

    // Create CSV rows
    const rows = matrixData.ingredients.map((ingredient) => {
      const row = [
        ingredient.name,
        ingredient.unit,
        ingredient.ingredient_categories?.name || "Bez kategorie",
      ];

      // Add supplier prices for each supplier
      matrixData.suppliers.forEach((supplier) => {
        const code = matrixData.matrix[ingredient.id]?.[supplier.id];
        row.push(code?.price ? `${code.price.toFixed(2)} Kč` : "");
      });

      // Add main price data if ingredient has no suppliers
      if (
        includeIngredientsWithoutSuppliers &&
        matrixData.ingredientsWithoutSuppliers.some(
          (ing) => ing.id === ingredient.id
        )
      ) {
        row.push(ingredient.price ? `${ingredient.price.toFixed(2)} Kč` : "");
      }

      return row;
    });

    // Convert to CSV format
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `porovnani-dodavatelu-${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-6 w-48" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Table skeleton */}
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  {/* Header skeleton */}
                  <div className="flex border-b">
                    <Skeleton className="h-12 w-48 sticky left-0 bg-white z-10" />
                    <Skeleton className="h-12 w-32 flex-1" />
                    <Skeleton className="h-12 w-32 flex-1" />
                    <Skeleton className="h-12 w-32 flex-1" />
                    <Skeleton className="h-12 w-32 flex-1" />
                  </div>
                  {/* Rows skeleton */}
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex border-b">
                      <Skeleton className="h-16 w-48 sticky left-0 bg-white z-10" />
                      <Skeleton className="h-16 w-32 flex-1" />
                      <Skeleton className="h-16 w-32 flex-1" />
                      <Skeleton className="h-16 w-32 flex-1" />
                      <Skeleton className="h-16 w-32 flex-1" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional skeleton card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-6 w-40" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-4 border border-gray-200 rounded-lg">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-3 w-24 mb-2" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get all available suppliers for the filter
  const allAvailableSuppliers = useMemo(() => {
    if (!groupedBySupplier) return [];
    return Object.values(groupedBySupplier)
      .map(({ supplier, codes }) => ({ supplier, count: codes.length }))
      .sort((a, b) => b.count - a.count)
      .map(({ supplier }) => supplier);
  }, [groupedBySupplier]);

  // Handle supplier selection
  const handleSupplierToggle = (supplierId: string) => {
    setSelectedSuppliers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(supplierId)) {
        newSet.delete(supplierId);
      } else {
        newSet.add(supplierId);
      }
      return newSet;
    });
  };

  // Handle select all/none
  const handleSelectAll = () => {
    if (selectedSuppliers.size === allAvailableSuppliers.length) {
      setSelectedSuppliers(new Set());
    } else {
      setSelectedSuppliers(new Set(allAvailableSuppliers.map((s) => s.id)));
    }
  };

  return (
    <div className="space-y-6">
      {/* Supplier Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Výběr dodavatelů pro porovnání
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={
                      selectedSuppliers.size === allAvailableSuppliers.length &&
                      allAvailableSuppliers.length > 0
                    }
                    onCheckedChange={handleSelectAll}
                  />
                  <Label htmlFor="select-all" className="font-medium">
                    {selectedSuppliers.size === allAvailableSuppliers.length
                      ? "Odznačit vše"
                      : "Vybrat vše"}
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-without-suppliers"
                    checked={includeIngredientsWithoutSuppliers}
                    onCheckedChange={(checked) =>
                      setIncludeIngredientsWithoutSuppliers(checked === true)
                    }
                  />
                  <Label
                    htmlFor="include-without-suppliers"
                    className="font-medium"
                  >
                    Zahrnout suroviny bez dodavatelů
                  </Label>
                </div>
              </div>
              <Badge variant="outline">
                {selectedSuppliers.size > 0
                  ? `${selectedSuppliers.size} vybráno`
                  : "Všechny dodavatelé"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {allAvailableSuppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50"
                >
                  <Checkbox
                    id={`supplier-${supplier.id}`}
                    checked={selectedSuppliers.has(supplier.id)}
                    onCheckedChange={() => handleSupplierToggle(supplier.id)}
                  />
                  <Label
                    htmlFor={`supplier-${supplier.id}`}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="font-medium">{supplier.full_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {Object.values(groupedBySupplier || {}).find(
                        (group) => group.supplier.id === supplier.id
                      )?.codes.length || 0}{" "}
                      surovin
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Přehled dodavatelů a surovin
            </CardTitle>
            <Button
              onClick={exportToCSV}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {matrixData.ingredients.length === 0 ||
          matrixData.suppliers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Žádné suroviny nebo dodavatelé nejsou nastaveni.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-white z-10 min-w-[200px]">
                      Surovina
                    </TableHead>
                    {matrixData.suppliers.map((supplier) => (
                      <TableHead
                        key={supplier.id}
                        className="text-center min-w-[150px]"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-medium text-sm">
                            {supplier.full_name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {
                              Object.values(matrixData.matrix).filter(
                                (row) => row[supplier.id]
                              ).length
                            }{" "}
                            surovin
                          </Badge>
                        </div>
                      </TableHead>
                    ))}
                    {includeIngredientsWithoutSuppliers &&
                      matrixData.ingredientsWithoutSuppliers.length > 0 && (
                        <TableHead className="text-center min-w-[150px] bg-orange-50">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-medium text-sm text-orange-800">
                              Bez dodavatele
                            </span>
                            <Badge
                              variant="outline"
                              className="text-xs text-orange-600 border-orange-300"
                            >
                              {matrixData.ingredientsWithoutSuppliers.length}{" "}
                              surovin
                            </Badge>
                          </div>
                        </TableHead>
                      )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    // Group ingredients by category
                    const groupedByCategory = matrixData.ingredients.reduce(
                      (acc, ingredient) => {
                        const categoryName =
                          ingredient.ingredient_categories?.name ||
                          "Bez kategorie";
                        if (!acc[categoryName]) {
                          acc[categoryName] = [];
                        }
                        acc[categoryName].push(ingredient);
                        return acc;
                      },
                      {} as Record<string, typeof matrixData.ingredients>
                    );

                    // Sort categories
                    const sortedCategories =
                      Object.keys(groupedByCategory).sort();

                    return sortedCategories.map((categoryName) => (
                      <React.Fragment key={categoryName}>
                        {/* Category header row */}
                        <TableRow className="bg-gray-100">
                          <TableCell
                            colSpan={
                              matrixData.suppliers.length +
                              (includeIngredientsWithoutSuppliers &&
                              matrixData.ingredientsWithoutSuppliers.length > 0
                                ? 2
                                : 1)
                            }
                            className="font-semibold text-gray-800 py-3"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                              {categoryName}
                              <Badge variant="outline" className="text-xs">
                                {groupedByCategory[categoryName].length} surovin
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Ingredients in this category */}
                        {groupedByCategory[categoryName].map((ingredient) => (
                          <TableRow key={ingredient.id}>
                            <TableCell className="sticky left-0 bg-white z-10 font-medium">
                              <div>
                                <div className="font-medium">
                                  {ingredient.name}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {ingredient.unit}
                                </div>
                              </div>
                            </TableCell>
                            {matrixData.suppliers.map((supplier) => {
                              const code =
                                matrixData.matrix[ingredient.id]?.[supplier.id];
                              const comparison =
                                priceComparisons[ingredient.id];
                              const isCheapest =
                                comparison &&
                                code &&
                                code.price === comparison.minPrice;
                              const isMostExpensive =
                                comparison &&
                                code &&
                                code.price === comparison.maxPrice;

                              return (
                                <TableCell
                                  key={supplier.id}
                                  className="text-center"
                                >
                                  {code ? (
                                    <div className="space-y-2">
                                      <div className="flex flex-col items-center gap-1">
                                        <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                                          {code.product_code || "—"}
                                        </code>
                                        <div
                                          className={`font-medium ${
                                            isCheapest
                                              ? "text-green-600"
                                              : isMostExpensive
                                                ? "text-red-600"
                                                : code.is_active
                                                  ? "text-blue-600"
                                                  : "text-gray-500"
                                          }`}
                                        >
                                          {code.price
                                            ? `${code.price.toFixed(2)} Kč`
                                            : "—"}
                                        </div>
                                        {comparison &&
                                          comparison.codes.length > 1 && (
                                            <div className="flex items-center justify-center">
                                              {isCheapest ? (
                                                <div className="flex items-center gap-1 text-green-600">
                                                  <TrendingDown className="h-3 w-3" />
                                                  <span className="text-xs">
                                                    Nejlevnější
                                                  </span>
                                                </div>
                                              ) : isMostExpensive ? (
                                                <div className="flex items-center gap-1 text-red-600">
                                                  <TrendingUp className="h-3 w-3" />
                                                  <span className="text-xs">
                                                    Nejdražší
                                                  </span>
                                                </div>
                                              ) : (
                                                <div className="flex items-center gap-1 text-gray-500">
                                                  <Minus className="h-3 w-3" />
                                                  <span className="text-xs">
                                                    Průměr
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                      </div>
                                      <Badge
                                        variant={
                                          code.is_active
                                            ? "default"
                                            : "secondary"
                                        }
                                        className={`text-xs ${
                                          code.is_active
                                            ? "bg-green-100 text-green-800"
                                            : "bg-gray-100 text-gray-600"
                                        }`}
                                      >
                                        {code.is_active
                                          ? "Aktivní"
                                          : "Neaktivní"}
                                      </Badge>
                                    </div>
                                  ) : (
                                    <div className="text-muted-foreground text-sm">
                                      —
                                    </div>
                                  )}
                                </TableCell>
                              );
                            })}

                            {/* Show ingredient's main price when no supplier codes exist */}
                            {includeIngredientsWithoutSuppliers &&
                              matrixData.ingredientsWithoutSuppliers.some(
                                (ing) => ing.id === ingredient.id
                              ) && (
                                <TableCell className="text-center bg-orange-50">
                                  <div className="space-y-2">
                                    <div className="flex flex-col items-center gap-1">
                                      <code className="bg-orange-100 px-2 py-1 rounded text-xs font-mono">
                                        {ingredient.product_code || "—"}
                                      </code>
                                      <div className="font-medium text-orange-600">
                                        {ingredient.price
                                          ? `${ingredient.price.toFixed(2)} Kč`
                                          : "—"}
                                      </div>
                                    </div>
                                    {/* <Badge
                              variant="outline"
                              className="text-xs text-orange-600 border-orange-300"
                            >
                              Hlavní cena
                            </Badge> */}
                                  </div>
                                </TableCell>
                              )}
                          </TableRow>
                        ))}
                      </React.Fragment>
                    ));
                  })()}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ingredients without suppliers */}
      {matrixData.ingredientsWithoutSuppliers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Minus className="h-5 w-5" />
              Suroviny bez dodavatelů (
              {matrixData.ingredientsWithoutSuppliers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {matrixData.ingredientsWithoutSuppliers.map((ingredient) => (
                <div
                  key={ingredient.id}
                  className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                >
                  <div className="font-medium text-gray-900">
                    {ingredient.name}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {ingredient.unit}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {ingredient.ingredient_categories?.name || "Bez kategorie"}
                  </div>
                  <div className="mt-2">
                    <Badge
                      variant="outline"
                      className="text-xs text-orange-600 border-orange-300"
                    >
                      Bez dodavatele
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
