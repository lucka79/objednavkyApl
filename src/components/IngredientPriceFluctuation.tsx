import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Calendar, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

interface IngredientPriceFluctuationProps {
  open: boolean;
  onClose: () => void;
  selectedMonth: Date;
  supplierId?: string;
  receiverId?: string;
  useWholeYear?: boolean;
}

export function IngredientPriceFluctuation({
  open,
  onClose,
  selectedMonth,
  supplierId,
  receiverId,
  useWholeYear = false,
}: IngredientPriceFluctuationProps) {
  const [selectedIngredient, setSelectedIngredient] = useState<string | null>(
    null
  );
  const [localSupplierFilter, setLocalSupplierFilter] = useState<string>(
    supplierId || "all"
  );

  // Reset filters when dialog opens/closes
  useEffect(() => {
    if (open) {
      setLocalSupplierFilter(supplierId || "all");
    } else {
      // Reset ingredient selection when dialog closes
      setSelectedIngredient(null);
    }
  }, [open, supplierId]);

  // Fetch suppliers for filtering
  const { data: suppliers } = useQuery({
    queryKey: ["suppliersForPriceChart"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("role", "supplier")
        .order("full_name");

      if (error) {
        console.error("Error fetching suppliers:", error);
        throw error;
      }

      return data || [];
    },
    enabled: open,
  });

  // Use local filter if available, otherwise use prop
  const effectiveSupplierId =
    localSupplierFilter !== "all" ? localSupplierFilter : supplierId;

  // Fetch price data for the selected month or whole year
  const { data: priceData, isLoading } = useQuery({
    queryKey: [
      "ingredientPriceFluctuation",
      selectedMonth.toISOString(),
      effectiveSupplierId,
      receiverId,
      useWholeYear,
    ],
    queryFn: async () => {
      let firstDayOfMonth: Date;
      let lastDayOfMonth: Date;

      if (useWholeYear) {
        // Use whole year
        firstDayOfMonth = new Date(selectedMonth.getFullYear(), 0, 1);
        lastDayOfMonth = new Date(selectedMonth.getFullYear(), 11, 31);
      } else {
        // Use selected month
        firstDayOfMonth = new Date(
          selectedMonth.getFullYear(),
          selectedMonth.getMonth(),
          1
        );
        lastDayOfMonth = new Date(
          selectedMonth.getFullYear(),
          selectedMonth.getMonth() + 1,
          0
        );
      }

      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatLocalDate(firstDayOfMonth);
      const endDateStr = formatLocalDate(lastDayOfMonth);

      // Build the query
      let query = supabase
        .from("items_received")
        .select(
          `
          id,
          quantity,
          unit_price,
          matched_ingredient_id,
          created_at,
          invoice_received_id,
          invoices_received!inner(
            id,
            invoice_date,
            invoice_number,
            supplier_id,
            receiver_id,
            supplier:supplier_id(
              id,
              full_name
            )
          ),
          ingredient:matched_ingredient_id(
            id,
            name,
            price,
            ingredient_supplier_codes(
              supplier_id,
              supplier_ingredient_name,
              price,
              is_active
            )
          )
        `
        )
        .gte("invoices_received.invoice_date", startDateStr)
        .lte("invoices_received.invoice_date", endDateStr)
        .not("matched_ingredient_id", "is", null)
        .order("created_at", { ascending: true });

      // Apply filters
      if (effectiveSupplierId && effectiveSupplierId !== "all") {
        query = query.eq("invoices_received.supplier_id", effectiveSupplierId);
      }

      if (receiverId && receiverId !== "all") {
        query = query.eq("invoices_received.receiver_id", receiverId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching price fluctuation data:", error);
        throw error;
      }

      return data || [];
    },
    enabled: open,
  });

  // Get unique ingredients filtered by supplier
  const ingredients = useMemo(() => {
    if (!priceData) return [];

    const ingredientMap = new Map();

    priceData.forEach((item: any) => {
      if (item.ingredient && !ingredientMap.has(item.matched_ingredient_id)) {
        const itemSupplierId = item.invoices_received.supplier_id;

        // Only include ingredient if it matches the selected supplier filter
        // (or if no specific supplier is selected)
        if (effectiveSupplierId && effectiveSupplierId !== "all") {
          if (itemSupplierId !== effectiveSupplierId) {
            return; // Skip this ingredient
          }
        }

        // Get supplier's ingredient name if available
        const supplierCode = item.ingredient.ingredient_supplier_codes?.find(
          (code: any) => code.supplier_id === itemSupplierId
        );
        const supplierIngredientName =
          supplierCode?.supplier_ingredient_name || null;

        // Get all other alternative names (from other suppliers)
        const alternativeNames =
          item.ingredient.ingredient_supplier_codes
            ?.filter(
              (code: any) =>
                code.supplier_ingredient_name &&
                code.supplier_ingredient_name !== supplierIngredientName &&
                code.supplier_ingredient_name !== item.ingredient.name
            )
            .map((code: any) => code.supplier_ingredient_name)
            .filter(
              (name: string, index: number, arr: string[]) =>
                arr.indexOf(name) === index
            ) || [];

        ingredientMap.set(item.matched_ingredient_id, {
          id: item.matched_ingredient_id,
          name: item.ingredient.name,
          supplierIngredientName,
          alternativeNames,
          basePrice: item.ingredient.price,
          supplierId: itemSupplierId,
        });
      }
    });

    return Array.from(ingredientMap.values()).sort((a, b) => {
      const aName = a.supplierIngredientName || a.name;
      const bName = b.supplierIngredientName || b.name;
      return aName.localeCompare(bName);
    });
  }, [priceData, effectiveSupplierId]);

  // Auto-select first ingredient when dialog opens with ingredients available
  useEffect(() => {
    if (open && ingredients.length > 0 && !selectedIngredient) {
      setSelectedIngredient(ingredients[0].id.toString());
    }
  }, [open, ingredients, selectedIngredient]);

  // Reset ingredient selection when supplier filter changes
  useEffect(() => {
    if (open) {
      setSelectedIngredient(null);
    }
  }, [localSupplierFilter, open]);

  // Handle left/right arrow key navigation for ingredients
  useEffect(() => {
    if (!open || ingredients.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();

        const currentIndex = selectedIngredient
          ? ingredients.findIndex(
              (ing) => ing.id.toString() === selectedIngredient
            )
          : -1;

        let newIndex: number;

        if (e.key === "ArrowRight") {
          // Move to next ingredient (or wrap to first)
          newIndex =
            currentIndex === -1 || currentIndex === ingredients.length - 1
              ? 0
              : currentIndex + 1;
        } else {
          // Move to previous ingredient (or wrap to last)
          newIndex =
            currentIndex === -1 || currentIndex === 0
              ? ingredients.length - 1
              : currentIndex - 1;
        }

        setSelectedIngredient(ingredients[newIndex].id.toString());
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, ingredients, selectedIngredient]);

  // Prepare chart data for selected ingredient
  const chartData = useMemo(() => {
    if (!priceData || !selectedIngredient) return [];

    const filtered = priceData.filter(
      (item: any) => item.matched_ingredient_id === parseInt(selectedIngredient)
    );

    // Group by invoice and date
    const grouped = filtered.reduce((acc: any, item: any) => {
      const date = item.invoices_received.invoice_date;
      const invoiceNumber = item.invoices_received.invoice_number;
      const key = `${date}_${invoiceNumber}`;

      if (!acc[key]) {
        acc[key] = {
          date,
          invoiceNumber,
          unitPrice: item.unit_price,
          quantity: item.quantity,
          invoiceDate: new Date(item.invoices_received.invoice_date),
          supplierName: item.invoices_received.supplier?.full_name || "—",
          supplierId: item.invoices_received.supplier_id,
        };
      }

      return acc;
    }, {});

    // Get base price for reference line
    const selectedIngredientData = ingredients.find(
      (ing) => ing.id === parseInt(selectedIngredient)
    );
    const basePrice = selectedIngredientData?.basePrice || 0;

    return Object.values(grouped)
      .sort(
        (a: any, b: any) => b.invoiceDate.getTime() - a.invoiceDate.getTime()
      )
      .map((item: any) => ({
        date: new Date(item.date).toLocaleDateString("cs-CZ"),
        invoiceNumber: item.invoiceNumber,
        "Cena z faktury": item.unitPrice,
        "Základní cena": basePrice,
        quantity: item.quantity,
        supplierName: item.supplierName,
        supplierId: item.supplierId,
      }));
  }, [priceData, selectedIngredient, ingredients]);

  // Check if there are multiple suppliers
  const hasMultipleSuppliers = useMemo(() => {
    if (!chartData || chartData.length === 0) return false;
    const uniqueSuppliers = new Set(
      chartData.map((item: any) => item.supplierId)
    );
    return uniqueSuppliers.size > 1;
  }, [chartData]);

  // Calculate statistics
  const statistics = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return {
        avgPrice: 0,
        minPrice: 0,
        maxPrice: 0,
        priceChange: 0,
        priceChangePercent: 0,
        avgQuantity: 0,
        avgWeekQuantity: 0,
        totalQuantity: 0,
      };
    }

    const prices = chartData.map((item: any) => item["Cena z faktury"]);
    const quantities = chartData.map((item: any) => item.quantity);

    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    // Since data is now sorted descending (newest first), we need to reverse for chronological comparison
    const firstPrice = prices[prices.length - 1]; // Oldest price
    const lastPrice = prices[0]; // Newest price
    const priceChange = lastPrice - firstPrice;
    const priceChangePercent =
      firstPrice > 0 ? (priceChange / firstPrice) * 100 : 0;

    // Helper function to get ISO week number
    const getWeekNumber = (date: Date) => {
      const d = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
      );
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil(
        ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
      );
      return `${d.getUTCFullYear()}-W${weekNo}`;
    };

    // Quantity statistics - group by month
    const monthlyQuantities = chartData.reduce((acc: any, item: any) => {
      // Extract year-month from date (e.g., "2024-01")
      const dateParts = item.date.split(".");
      if (dateParts.length >= 2) {
        const month = dateParts[1]; // month
        const year = dateParts[2]; // year
        const monthKey = `${year}-${month}`;

        if (!acc[monthKey]) {
          acc[monthKey] = 0;
        }
        acc[monthKey] += item.quantity;
      }
      return acc;
    }, {});

    // Quantity statistics - group by week
    const weeklyQuantities = chartData.reduce((acc: any, item: any) => {
      // Parse Czech date format (dd.mm.yyyy)
      const dateParts = item.date.split(".");
      if (dateParts.length === 3) {
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1; // JS months are 0-indexed
        const year = parseInt(dateParts[2], 10);
        const date = new Date(year, month, day);
        const weekKey = getWeekNumber(date);

        if (!acc[weekKey]) {
          acc[weekKey] = 0;
        }
        acc[weekKey] += item.quantity;
      }
      return acc;
    }, {});

    const monthlyTotals = Object.values(monthlyQuantities) as number[];
    const weeklyTotals = Object.values(weeklyQuantities) as number[];
    const totalQuantity = quantities.reduce((sum, q) => sum + q, 0);
    const avgQuantity =
      monthlyTotals.length > 0
        ? monthlyTotals.reduce((sum: number, q: number) => sum + q, 0) /
          monthlyTotals.length
        : 0;
    const avgWeekQuantity =
      weeklyTotals.length > 0
        ? weeklyTotals.reduce((sum: number, q: number) => sum + q, 0) /
          weeklyTotals.length
        : 0;

    return {
      avgPrice,
      minPrice,
      maxPrice,
      priceChange,
      priceChangePercent,
      avgQuantity,
      avgWeekQuantity,
      totalQuantity,
    };
  }, [chartData]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Vývoj cen surovin
            <span className="text-sm text-muted-foreground font-normal">
              (
              {useWholeYear
                ? `Celý rok ${selectedMonth.getFullYear()}`
                : selectedMonth.toLocaleDateString("cs-CZ", {
                    month: "long",
                    year: "numeric",
                  })}
              )
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Supplier Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Dodavatel</label>
              <Select
                value={localSupplierFilter}
                onValueChange={setLocalSupplierFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Všichni dodavatelé" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  <SelectItem value="all">Všichni dodavatelé</SelectItem>
                  {suppliers?.map((supplier: any) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ingredient Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Surovina</label>
              <Select
                value={selectedIngredient || ""}
                onValueChange={setSelectedIngredient}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte surovinu..." />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {ingredients.map((ingredient) => (
                    <SelectItem
                      key={ingredient.id}
                      value={ingredient.id.toString()}
                    >
                      <div className="flex flex-col">
                        <span>
                          {ingredient.supplierIngredientName || ingredient.name}
                        </span>
                        {ingredient.alternativeNames &&
                          ingredient.alternativeNames.length > 0 && (
                            <span className="text-xs text-blue-500 italic">
                              {ingredient.alternativeNames.join(", ")}
                            </span>
                          )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-64 w-full" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            </div>
          ) : selectedIngredient && chartData.length > 0 ? (
            <>
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Průměrná cena
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {statistics.avgPrice.toFixed(2)} Kč
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Minimální cena
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {statistics.minPrice.toFixed(2)} Kč
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Maximální cena
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {statistics.maxPrice.toFixed(2)} Kč
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Změna ceny
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className={`text-2xl font-bold ${
                        statistics.priceChange > 0
                          ? "text-red-600"
                          : statistics.priceChange < 0
                            ? "text-green-600"
                            : "text-gray-600"
                      }`}
                    >
                      {statistics.priceChange > 0 ? "+" : ""}
                      {statistics.priceChange.toFixed(2)} Kč
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Změna v %
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className={`text-2xl font-bold ${
                        statistics.priceChangePercent > 0
                          ? "text-red-600"
                          : statistics.priceChangePercent < 0
                            ? "text-green-600"
                            : "text-gray-600"
                      }`}
                    >
                      {statistics.priceChangePercent > 0 ? "+" : ""}
                      {statistics.priceChangePercent.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quantity Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Celkové množství
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {statistics.totalQuantity.toFixed(1)} kg
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Průměrné množství (měsíčně)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {statistics.avgQuantity.toFixed(1)} kg
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Průměrné množství (týdně)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {statistics.avgWeekQuantity.toFixed(1)} kg
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Data Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Historie cen</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Datum</th>
                          <th className="text-left p-2">Číslo faktury</th>
                          {hasMultipleSuppliers && (
                            <th className="text-left p-2">Dodavatel</th>
                          )}
                          <th className="text-right p-2">Cena z faktury</th>
                          <th className="text-right p-2">Základní cena</th>
                          <th className="text-right p-2">Rozdíl</th>
                          <th className="text-right p-2">Množství</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chartData.map((item: any, index: number) => {
                          const diff =
                            item["Cena z faktury"] - item["Základní cena"];
                          const diffPercent =
                            item["Základní cena"] > 0
                              ? (diff / item["Základní cena"]) * 100
                              : 0;

                          return (
                            <tr
                              key={index}
                              className="border-b hover:bg-gray-50"
                            >
                              <td className="p-2">{item.date}</td>
                              <td className="p-2">{item.invoiceNumber}</td>
                              {hasMultipleSuppliers && (
                                <td className="p-2 text-muted-foreground">
                                  {item.supplierName}
                                </td>
                              )}
                              <td className="text-right p-2 font-medium">
                                {item["Cena z faktury"].toFixed(2)} Kč
                              </td>
                              <td className="text-right p-2 text-muted-foreground">
                                {item["Základní cena"].toFixed(2)} Kč
                              </td>
                              <td
                                className={`text-right p-2 font-medium ${
                                  diff > 0
                                    ? "text-red-600"
                                    : diff < 0
                                      ? "text-green-600"
                                      : "text-gray-600"
                                }`}
                              >
                                {diff > 0 ? "+" : ""}
                                {diff.toFixed(2)} Kč ({diffPercent.toFixed(1)}%)
                              </td>
                              <td className="text-right p-2">
                                {item.quantity} kg
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : selectedIngredient ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>
                Pro vybranou surovinu nebyly nalezeny žádné ceny v tomto měsíci.
              </p>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Vyberte surovinu pro zobrazení vývoje ceny</p>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Zavřít
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
