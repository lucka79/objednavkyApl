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
  Tag,
  Printer,
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

    // Create matrix: ingredient_id -> supplier_id -> array of codes
    const matrix: Record<number, Record<string, any[]>> = {};

    allSupplierCodes.forEach((code) => {
      if (!matrix[code.ingredient_id]) {
        matrix[code.ingredient_id] = {};
      }
      if (!matrix[code.ingredient_id][code.supplier_id]) {
        matrix[code.ingredient_id][code.supplier_id] = [];
      }
      matrix[code.ingredient_id][code.supplier_id].push(code);
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

    // If suppliers are selected, show ingredients that ANY selected supplier has
    if (selectedSuppliers.size > 0) {
      ingredients = ingredients.filter((ingredient) => {
        if (!matrix[ingredient.id]) return false;

        // Check if this ingredient has codes for ANY selected supplier
        const selectedSupplierIds = Array.from(selectedSuppliers);
        return selectedSupplierIds.some(
          (supplierId) =>
            matrix[ingredient.id][supplierId] &&
            matrix[ingredient.id][supplierId].length > 0
        );
      });
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

  // Print function
  const handlePrint = () => {
    if (!matrixData.ingredients.length || !matrixData.suppliers.length) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Group ingredients by category
    const groupedByCategory = matrixData.ingredients.reduce(
      (acc, ingredient) => {
        const categoryName =
          ingredient.ingredient_categories?.name || "Bez kategorie";
        if (!acc[categoryName]) {
          acc[categoryName] = [];
        }
        acc[categoryName].push(ingredient);
        return acc;
      },
      {} as Record<string, typeof matrixData.ingredients>
    );

    const sortedCategories = Object.keys(groupedByCategory).sort();

    // Generate table rows
    const tableRows = sortedCategories
      .map((categoryName) => {
        const categoryRows = groupedByCategory[categoryName]
          .map((ingredient) => {
            // Build ingredient name cell with price
            let ingredientCell = `
              <td style="font-weight: 600; padding: 8px;">
                <div>${ingredient.name}</div>
                <div style="font-size: 11px; color: #666;">${ingredient.unit}`;
            if (ingredient.package) {
              ingredientCell += ` | Balení: ${ingredient.package} ${ingredient.unit}`;
            }
            ingredientCell += `</div>`;
            if (ingredient.price) {
              ingredientCell += `<div style="font-size: 11px; font-weight: 600; color: #333; margin-top: 4px;">Hlavní cena: ${ingredient.price.toFixed(2)} Kč</div>`;
            }
            ingredientCell += `</td>`;

            // Build supplier cells
            const supplierCells = matrixData.suppliers
              .map((supplier) => {
                const codes =
                  matrixData.matrix[ingredient.id]?.[supplier.id] || [];

                if (codes.length === 0) {
                  return '<td style="text-align: center; padding: 8px;">—</td>';
                }

                // Check if any code is cheapest
                const comparison = priceComparisons[ingredient.id];
                const hasCheapestCode = codes.some(
                  (code) =>
                    comparison && code && code.price === comparison.minPrice
                );

                const cellStyle = hasCheapestCode
                  ? "background-color: #dcfce7; border: 2px solid #4ade80; text-align: center; padding: 8px;"
                  : "text-align: center; padding: 8px;";

                const codesHtml = codes
                  .map((code, codeIndex) => {
                    const isCheapest =
                      comparison && code && code.price === comparison.minPrice;

                    const isLastCode = codeIndex === codes.length - 1;
                    const codeStyle = isCheapest
                      ? `background-color: #bbf7d0; padding: 4px; border-radius: 4px; margin-bottom: ${isLastCode ? "0" : "8px"}; ${!isLastCode ? "border-bottom: 1px solid #d1d5db; padding-bottom: 8px;" : ""}`
                      : codes.length > 1 && !isLastCode
                        ? "margin-bottom: 8px; border-bottom: 1px solid #d1d5db; padding-bottom: 8px;"
                        : "margin-bottom: 4px;";

                    let codeHtml = `<div style="${codeStyle}">`;
                    codeHtml += `<div style="font-size: 11px; font-weight: 500;">`;
                    if (code.product_code) {
                      codeHtml += `<code style="font-family: monospace; background: #f3f4f6; padding: 2px 4px; border-radius: 2px;">${code.product_code}</code> `;
                    }
                    codeHtml += `${code.supplier_ingredient_name || ingredient.name}`;
                    if (code.package) {
                      codeHtml += ` (${code.package} ${ingredient.unit})`;
                    }
                    codeHtml += `</div>`;
                    codeHtml += `<div style="font-weight: 600; font-size: 12px; color: ${
                      isCheapest ? "#15803d" : "#1f2937"
                    };">${code.price ? `${code.price.toFixed(2)} Kč` : "—"}</div>`;
                    if (code.updated_at) {
                      codeHtml += `<div style="font-size: 10px; color: #666;">${new Date(
                        code.updated_at
                      ).toLocaleDateString("cs-CZ", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                      })}</div>`;
                    }
                    codeHtml += `</div>`;
                    return codeHtml;
                  })
                  .join("");

                return `<td style="${cellStyle}">${codesHtml}</td>`;
              })
              .join("");

            return `<tr>${ingredientCell}${supplierCells}</tr>`;
          })
          .join("");

        // Category header row
        const categoryHeader = `
          <tr style="background-color: #f3f4f6;">
            <td colspan="${
              matrixData.suppliers.length + 1
            }" style="font-weight: 600; padding: 12px 8px; font-size: 14px;">
              ${categoryName} (${groupedByCategory[categoryName].length} surovin)
            </td>
          </tr>
        `;

        return categoryHeader + categoryRows;
      })
      .join("");

    // Build supplier headers
    const supplierHeaders = matrixData.suppliers
      .map(
        (supplier) => `
      <th style="text-align: center; padding: 8px; background-color: #f9fafb; font-weight: 600; border: 1px solid #e5e7eb;">
        ${supplier.full_name}
      </th>
    `
      )
      .join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Porovnání dodavatelů surovin</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
            }
            h1 {
              margin-bottom: 10px;
            }
            .subtitle {
              color: #666;
              margin-bottom: 20px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #e5e7eb;
              padding: 8px;
            }
            th {
              background-color: #f9fafb;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background-color: #f9fafb;
            }
            @media print {
              body {
                padding: 10px;
              }
              button {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <h1>Porovnání dodavatelů surovin</h1>
          <div class="subtitle">
            Vygenerováno: ${new Date().toLocaleString("cs-CZ")}
            ${
              selectedSuppliers.size > 0
                ? ` | Vybráno dodavatelů: ${selectedSuppliers.size}`
                : " | Všichni dodavatelé"
            }
          </div>
          <table>
            <thead>
              <tr>
                <th style="text-align: left; padding: 8px; background-color: #f9fafb; font-weight: 600; border: 1px solid #e5e7eb;">Surovina</th>
                ${supplierHeaders}
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // CSV export function
  const exportToCSV = () => {
    if (!matrixData.ingredients.length || !matrixData.suppliers.length) return;

    // Create CSV headers
    const headers = [
      "Surovina",
      "Jednotka",
      "Balení",
      "Kategorie",
      ...matrixData.suppliers.map(
        (supplier) => `${supplier.full_name} (Název)`
      ),
      ...matrixData.suppliers.map((supplier) => `${supplier.full_name} (Kód)`),
      ...matrixData.suppliers.map((supplier) => `${supplier.full_name} (Cena)`),
      ...matrixData.suppliers.map(
        (supplier) => `${supplier.full_name} (Balení)`
      ),
      ...matrixData.suppliers.map(
        (supplier) => `${supplier.full_name} (Aktualizováno)`
      ),
      ...(includeIngredientsWithoutSuppliers &&
      matrixData.ingredientsWithoutSuppliers.length > 0
        ? ["Hlavní cena", "Hlavní cena (Aktualizováno)"]
        : []),
    ];

    // Create CSV rows
    const rows = matrixData.ingredients.map((ingredient) => {
      const row = [
        ingredient.name,
        ingredient.unit,
        ingredient.package ? `${ingredient.package} ${ingredient.unit}` : "",
        ingredient.ingredient_categories?.name || "Bez kategorie",
      ];

      // Add supplier ingredient names for each supplier
      matrixData.suppliers.forEach((supplier) => {
        const codes = matrixData.matrix[ingredient.id]?.[supplier.id] || [];
        const names = codes
          .map((code) => code?.supplier_ingredient_name || ingredient.name)
          .join("; ");
        row.push(names || "");
      });

      // Add supplier product codes for each supplier
      matrixData.suppliers.forEach((supplier) => {
        const codes = matrixData.matrix[ingredient.id]?.[supplier.id] || [];
        const productCodes = codes
          .map((code) => code?.product_code || "")
          .filter(Boolean)
          .join("; ");
        row.push(productCodes || "");
      });

      // Add supplier prices for each supplier
      matrixData.suppliers.forEach((supplier) => {
        const codes = matrixData.matrix[ingredient.id]?.[supplier.id] || [];
        const prices = codes
          .map((code) => (code?.price ? `${code.price.toFixed(2)} Kč` : ""))
          .filter(Boolean)
          .join("; ");
        row.push(prices || "");
      });

      // Add supplier packages for each supplier
      matrixData.suppliers.forEach((supplier) => {
        const codes = matrixData.matrix[ingredient.id]?.[supplier.id] || [];
        const packages = codes
          .map((code) =>
            code?.package ? `${code.package} ${ingredient.unit}` : ""
          )
          .filter(Boolean)
          .join("; ");
        row.push(packages || "");
      });

      // Add supplier update dates for each supplier
      matrixData.suppliers.forEach((supplier) => {
        const codes = matrixData.matrix[ingredient.id]?.[supplier.id] || [];
        const dates = codes
          .map((code) =>
            code?.updated_at
              ? new Date(code.updated_at).toLocaleDateString("cs-CZ")
              : ""
          )
          .filter(Boolean)
          .join("; ");
        row.push(dates || "");
      });

      // Add main price data if ingredient has no suppliers
      if (
        includeIngredientsWithoutSuppliers &&
        matrixData.ingredientsWithoutSuppliers.some(
          (ing) => ing.id === ingredient.id
        )
      ) {
        row.push(ingredient.price ? `${ingredient.price.toFixed(2)} Kč` : "");
        row.push(
          (ingredient as any).updated_at
            ? new Date((ingredient as any).updated_at).toLocaleDateString(
                "cs-CZ"
              )
            : ""
        );
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
                    className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  />
                  <Label
                    htmlFor="include-without-suppliers"
                    className="font-medium cursor-pointer"
                  >
                    Zahrnout suroviny bez dodavatelů
                    {matrixData.ingredientsWithoutSuppliers.length > 0 && (
                      <Badge
                        variant="outline"
                        className="ml-2 text-xs text-orange-600 border-orange-300"
                      >
                        {matrixData.ingredientsWithoutSuppliers.length}
                      </Badge>
                    )}
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
            <div className="flex items-center gap-2">
              <Button
                onClick={exportToCSV}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button
                onClick={handlePrint}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Printer className="h-4 w-4" />
                Tisknout
              </Button>
            </div>
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
                        <TableRow className="bg-gray-50">
                          <TableCell
                            colSpan={
                              matrixData.suppliers.length +
                              (includeIngredientsWithoutSuppliers &&
                              matrixData.ingredientsWithoutSuppliers.length > 0
                                ? 2
                                : 1)
                            }
                            className="py-3"
                          >
                            <div className="flex items-center gap-2">
                              <Tag className="h-4 w-4 text-orange-600" />
                              <h3 className="text-lg font-semibold text-orange-800">
                                {categoryName}
                              </h3>
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
                                  {ingredient.package && (
                                    <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">
                                      Balení: {ingredient.package}{" "}
                                      {ingredient.unit}
                                    </span>
                                  )}
                                </div>
                                {ingredient.price && (
                                  <div className="text-xs font-semibold text-gray-700 mt-1">
                                    Hlavní cena: {ingredient.price.toFixed(2)}{" "}
                                    Kč
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            {matrixData.suppliers.map((supplier) => {
                              const codes =
                                matrixData.matrix[ingredient.id]?.[
                                  supplier.id
                                ] || [];
                              const comparison =
                                priceComparisons[ingredient.id];

                              // Check if any code in this supplier is the cheapest
                              const hasCheapestCode = codes.some(
                                (code) =>
                                  comparison &&
                                  code &&
                                  code.price === comparison.minPrice
                              );

                              return (
                                <TableCell
                                  key={supplier.id}
                                  className={`text-center ${
                                    hasCheapestCode
                                      ? "bg-green-50 border-2 border-green-400"
                                      : ""
                                  }`}
                                >
                                  {codes.length > 0 ? (
                                    <div className="space-y-1.5">
                                      {codes.map((code, codeIndex) => {
                                        const isCheapest =
                                          comparison &&
                                          code &&
                                          code.price === comparison.minPrice;
                                        const isMostExpensive =
                                          comparison &&
                                          code &&
                                          code.price === comparison.maxPrice;

                                        return (
                                          <div
                                            key={codeIndex}
                                            className={`space-y-1 ${
                                              codes.length > 1
                                                ? "border-b border-gray-200 pb-1.5 last:border-0 last:pb-0"
                                                : ""
                                            } ${
                                              isCheapest
                                                ? "bg-green-100 rounded p-1"
                                                : ""
                                            }`}
                                          >
                                            <div className="flex flex-col items-center gap-0.5">
                                              {/* Product code, name and package - All on same row */}
                                              <div
                                                className={`text-xs font-medium px-1.5 py-0.5 rounded w-full text-center ${
                                                  isCheapest
                                                    ? "bg-green-200 text-green-900 font-semibold"
                                                    : code.supplier_ingredient_name
                                                      ? "bg-blue-50 text-blue-800"
                                                      : "bg-gray-50 text-gray-600"
                                                }`}
                                                title={
                                                  code.supplier_ingredient_name ||
                                                  ingredient.name
                                                }
                                              >
                                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                                  {code.product_code && (
                                                    <code
                                                      className={`font-mono ${
                                                        isCheapest
                                                          ? "text-green-800 font-semibold"
                                                          : ""
                                                      }`}
                                                    >
                                                      {code.product_code}
                                                    </code>
                                                  )}
                                                  <span>
                                                    {code.supplier_ingredient_name ||
                                                      ingredient.name}
                                                  </span>
                                                  {code.package && (
                                                    <span className="text-muted-foreground">
                                                      ({code.package}{" "}
                                                      {ingredient.unit})
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              <div
                                                className={`font-bold text-sm ${
                                                  isCheapest
                                                    ? "text-green-700"
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
                                              {code.updated_at && (
                                                <div className="text-xs text-muted-foreground">
                                                  {new Date(
                                                    code.updated_at
                                                  ).toLocaleDateString(
                                                    "cs-CZ",
                                                    {
                                                      day: "2-digit",
                                                      month: "2-digit",
                                                      year: "2-digit",
                                                    }
                                                  )}
                                                </div>
                                              )}
                                              {comparison &&
                                                comparison.codes.length > 1 && (
                                                  <div className="flex items-center justify-center">
                                                    {isCheapest ? (
                                                      <div className="flex items-center gap-1 text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                                                        <TrendingDown className="h-3 w-3 font-bold" />
                                                        <span className="text-xs font-semibold">
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
                                              className={`text-xs pointer-events-none ${
                                                code.is_active
                                                  ? "bg-green-100 text-green-800 hover:bg-green-100"
                                                  : "bg-gray-100 text-gray-600 hover:bg-gray-100"
                                              }`}
                                            >
                                              {code.is_active
                                                ? "Aktivní"
                                                : "Neaktivní"}
                                            </Badge>
                                          </div>
                                        );
                                      })}
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
                                      {(ingredient as any).updated_at && (
                                        <div className="text-xs text-muted-foreground">
                                          {new Date(
                                            (ingredient as any).updated_at
                                          ).toLocaleDateString("cs-CZ", {
                                            day: "2-digit",
                                            month: "2-digit",
                                            year: "2-digit",
                                          })}
                                        </div>
                                      )}
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

      {/* Ingredients without suppliers - Warning Card */}
      {matrixData.ingredientsWithoutSuppliers.length > 0 && (
        <Card className="border-orange-300 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <Minus className="h-5 w-5" />
              ⚠️ Suroviny bez dodavatelů (
              {matrixData.ingredientsWithoutSuppliers.length})
            </CardTitle>
            <p className="text-sm text-orange-700 mt-2">
              Tyto suroviny nemají přiřazené žádné kódy dodavatelů. Přidejte jim
              dodavatele v sekci "Suroviny" pro lepší porovnání cen.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {matrixData.ingredientsWithoutSuppliers.map((ingredient) => (
                <div
                  key={ingredient.id}
                  className="p-4 border border-orange-200 rounded-lg bg-white shadow-sm"
                >
                  <div className="font-medium text-gray-900">
                    {ingredient.name}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {ingredient.unit}
                    {ingredient.package && (
                      <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">
                        Balení: {ingredient.package} {ingredient.unit}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {ingredient.ingredient_categories?.name || "Bez kategorie"}
                  </div>
                  {ingredient.price && (
                    <div className="text-sm font-medium text-orange-600 mt-2">
                      Hlavní cena: {ingredient.price.toFixed(2)} Kč
                    </div>
                  )}
                  <div className="mt-2">
                    <Badge
                      variant="outline"
                      className="text-xs text-orange-600 border-orange-300 bg-orange-100"
                    >
                      Chybí kódy dodavatelů
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
