import { useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Calendar,
  TrendingUp,
  Download,
  BarChart3,
  Package,
  RefreshCw,
} from "lucide-react";
import { useCalculateMonthlyConsumptionFromProduction } from "@/hooks/useDailyIngredientConsumption";
import { useToast } from "@/hooks/use-toast";
import { removeDiacritics } from "@/utils/removeDiacritics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export function MonthlyIngredientConsumption() {
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  // Show only current month by default
  const currentDate = new Date();
  // Fix timezone issues by using explicit date construction
  const [startDate] = useState<Date>(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return new Date(year, month, 1, 0, 0, 0, 0); // First day of current month at midnight
  });
  const [endDate] = useState<Date>(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const day = currentDate.getDate();
    return new Date(year, month, day + 1, 0, 0, 0, 0); // Tomorrow at midnight
  });

  // Fetch calculated consumption data from daily_ingredient_consumption table
  const {
    data: monthlyData,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "monthlyConsumptionFromCalculated",
      startDate.toISOString(),
      endDate.toISOString(),
    ],
    queryFn: async () => {
      // Fix timezone issue by using local date formatting
      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatLocalDate(startDate);
      const endDateStr = formatLocalDate(endDate);

      console.log(
        `Fetching calculated consumption from ${startDateStr} to ${endDateStr}`
      );

      // Fetch calculated consumption data from daily_ingredient_consumption table
      const { data: consumptionData, error: consumptionError } = await supabase
        .from("daily_ingredient_consumption")
        .select(
          `
          date,
          ingredient_id,
          quantity,
          ingredients(
            id,
            name,
            unit,
            ingredient_categories(
              id,
              name
            ),
            ingredient_supplier_codes!ingredient_supplier_codes_ingredient_id_fkey(
              id,
              supplier_id,
              is_active,
              supplier:profiles!ingredient_supplier_codes_supplier_id_fkey(
                id,
                full_name
              )
            )
          )
        `
        )
        .gte("date", startDateStr)
        .lte("date", endDateStr)
        .limit(10000); // Remove default 1000 row limit

      if (consumptionError) {
        console.error(
          "Error fetching calculated consumption:",
          consumptionError
        );
        throw consumptionError;
      }

      if (!consumptionData || consumptionData.length === 0) {
        console.log("No calculated consumption data found");
        return [];
      }

      // Group by month and ingredient
      const monthlyConsumptionMap = new Map<string, Map<number, any>>();

      // Debug tracking for specific ingredient
      const debugIngredientName = "Pšen.mouka světlá T530";
      const debugTracking: Array<{
        date: string;
        quantity: number;
      }> = [];

      console.log(
        `\n=== DEBUG MONTHLY CONSUMPTION: ${debugIngredientName} ===`
      );
      console.log(`Date range: ${startDateStr} to ${endDateStr}`);
      console.log(`Total records found: ${consumptionData.length}`);

      consumptionData.forEach((item) => {
        if (!item.ingredients) return;

        const date = new Date(item.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const ingredientId = item.ingredient_id;
        const quantity = item.quantity || 0;

        // Debug tracking for specific ingredient
        if (
          item.ingredients &&
          item.ingredients[0]?.name === debugIngredientName
        ) {
          debugTracking.push({
            date: item.date,
            quantity: quantity,
          });
        }

        if (!monthlyConsumptionMap.has(monthKey)) {
          monthlyConsumptionMap.set(monthKey, new Map());
        }

        const monthMap = monthlyConsumptionMap.get(monthKey)!;

        if (monthMap.has(ingredientId)) {
          const existing = monthMap.get(ingredientId)!;
          existing.totalQuantity += quantity;
        } else {
          // Type assertion to handle the complex nested structure
          const ingredient = item.ingredients as any;

          // Find active supplier from ingredient_supplier_codes
          const activeSupplier = ingredient.ingredient_supplier_codes?.find(
            (code: any) => code.is_active
          )?.supplier;

          monthMap.set(ingredientId, {
            month: monthKey,
            ingredientId: ingredientId,
            ingredientName: ingredient.name,
            totalQuantity: quantity,
            unit: ingredient.unit || "kg",
            categoryName: ingredient.ingredient_categories?.name,
            supplierName: activeSupplier?.full_name,
          });
        }
      });

      // Debug output for specific ingredient
      if (debugTracking.length > 0) {
        console.log(
          `\nRecords for ${debugIngredientName}: ${debugTracking.length}`
        );

        // Group by date and sum quantities
        const byDate = new Map<string, number>();
        debugTracking.forEach((item) => {
          const current = byDate.get(item.date) || 0;
          byDate.set(item.date, current + item.quantity);
        });

        console.log(`Daily consumption:`);
        Array.from(byDate.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([date, total]) => {
            console.log(`  ${date}: ${total.toFixed(2)} kg`);
          });

        const totalConsumption = debugTracking.reduce(
          (sum, item) => sum + item.quantity,
          0
        );
        console.log(
          `Total consumption for period: ${totalConsumption.toFixed(2)} kg`
        );
        console.log(`=== END DEBUG ===\n`);
      } else {
        console.log(`No records found for ${debugIngredientName}`);
        console.log(`=== END DEBUG ===\n`);
      }

      // Convert to array format
      const result = [];

      for (const [month, ingredientsMap] of monthlyConsumptionMap) {
        const ingredients = Array.from(ingredientsMap.values()).sort((a, b) =>
          a.ingredientName.localeCompare(b.ingredientName)
        );

        result.push({
          month,
          ingredients,
        });
      }

      // Sort by month descending (most recent first)
      result.sort((a, b) => b.month.localeCompare(a.month));

      console.log(
        `Calculated consumption data loaded: ${result.length} months`
      );
      return result;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: true,
  });

  const calculateMonthlyFromProduction =
    useCalculateMonthlyConsumptionFromProduction();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleCalculateMonthFromProduction = async () => {
    try {
      const result = await calculateMonthlyFromProduction.mutateAsync({
        startDate,
        endDate,
      });

      const successfulDays = result.filter((r) => r.success).length;
      const totalDays = result.length;

      // Invalidate the query cache to refresh the data
      await queryClient.invalidateQueries({
        queryKey: ["monthlyConsumptionFromCalculated"],
      });

      toast({
        title: "Úspěch",
        description: `Měsíční spotřeba byla vypočítána pro ${successfulDays}/${totalDays} dnů`,
      });
    } catch (error) {
      console.error(`Monthly calculation failed:`, error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se vypočítat měsíční spotřebu z výroby",
        variant: "destructive",
      });
    }
  };

  // Get available months
  const availableMonths = useMemo(() => {
    if (!monthlyData) return [];
    return monthlyData.map((item) => item.month);
  }, [monthlyData]);

  // Filter data by selected month
  const filteredData = useMemo(() => {
    if (!monthlyData) return [];

    if (selectedMonth === "all") {
      return monthlyData;
    }

    return monthlyData.filter((item) => item.month === selectedMonth);
  }, [monthlyData, selectedMonth]);

  // Flatten data for search filtering
  const flattenedData = useMemo(() => {
    const items: Array<{
      month: string;
      ingredientId: number;
      ingredientName: string;
      totalQuantity: number;
      unit: string;
      categoryName?: string;
      supplierName?: string;
    }> = [];

    filteredData.forEach((monthData) => {
      monthData.ingredients.forEach((ingredient) => {
        items.push({
          month: monthData.month,
          ...ingredient,
        });
      });
    });

    return items;
  }, [filteredData]);

  // Apply search filter
  const searchFilteredData = useMemo(() => {
    if (!globalFilter.trim()) return flattenedData;

    const searchLower = removeDiacritics(globalFilter.toLowerCase());

    return flattenedData.filter((item) => {
      const nameMatch = removeDiacritics(
        item.ingredientName.toLowerCase()
      ).includes(searchLower);
      const categoryMatch = item.categoryName
        ? removeDiacritics(item.categoryName.toLowerCase()).includes(
            searchLower
          )
        : false;
      const supplierMatch = item.supplierName
        ? removeDiacritics(item.supplierName.toLowerCase()).includes(
            searchLower
          )
        : false;

      return nameMatch || categoryMatch || supplierMatch;
    });
  }, [flattenedData, globalFilter]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalIngredients = new Set(
      searchFilteredData.map((item) => item.ingredientId)
    ).size;
    const totalMonths = new Set(searchFilteredData.map((item) => item.month))
      .size;

    // Calculate total value if we had prices (for future enhancement)
    const totalQuantity = searchFilteredData.reduce(
      (sum, item) => sum + item.totalQuantity,
      0
    );

    return {
      totalIngredients,
      totalMonths,
      totalQuantity,
    };
  }, [searchFilteredData]);

  // Group data by month for display
  const groupedByMonth = useMemo(() => {
    const grouped = new Map<string, typeof searchFilteredData>();

    searchFilteredData.forEach((item) => {
      if (!grouped.has(item.month)) {
        grouped.set(item.month, []);
      }
      grouped.get(item.month)!.push(item);
    });

    return grouped;
  }, [searchFilteredData]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "Měsíc",
      "Surovina",
      "Množství",
      "Celkem z DB",
      "Jednotka",
      "Kategorie",
      "Dodavatel",
    ];
    const csvData = searchFilteredData.map((item) => [
      item.month,
      item.ingredientName,
      item.totalQuantity.toFixed(2),
      item.totalQuantity.toFixed(2),
      item.unit,
      item.categoryName || "—",
      item.supplierName || "—",
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `spotreba-surovin-${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format month for display
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString("cs-CZ", { year: "numeric", month: "long" });
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
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
          Chyba při načítání spotřeby: {(error as Error).message}
        </div>
      </Card>
    );
  }

  if (!monthlyData || monthlyData.length === 0) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          {/* Header with button even when no data */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold">Měsíční spotřeba surovin</h2>
              <p className="text-muted-foreground">
                Žádná data o spotřebě pro vybrané období
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCalculateMonthFromProduction}
                disabled={calculateMonthlyFromProduction.isPending}
                variant="default"
                size="sm"
                className="bg-orange-600 hover:bg-orange-700"
              >
                {calculateMonthlyFromProduction.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Počítám měsíc...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    Vypočítat měsíc
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* No data message */}
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <BarChart3 className="h-8 w-8 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Žádná data o spotřebě
            </h3>
            <p className="text-gray-600">
              Pro vybrané období nebyly nalezeny žádné údaje o spotřebě surovin.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold">Měsíční spotřeba surovin</h2>
            <p className="text-muted-foreground">
              Celkem surovin: {summaryStats.totalIngredients} | Měsíců:{" "}
              {summaryStats.totalMonths}
            </p>
            <p className="text-sm text-muted-foreground">
              Období: {format(startDate, "d. MMMM yyyy", { locale: cs })} -{" "}
              {format(endDate, "d. MMMM yyyy", { locale: cs })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleCalculateMonthFromProduction}
              disabled={calculateMonthlyFromProduction.isPending}
              variant="default"
              size="sm"
              className="bg-orange-600 hover:bg-orange-700"
            >
              {calculateMonthlyFromProduction.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Počítám měsíc...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  Vypočítat měsíc
                </>
              )}
            </Button>
            <Button onClick={exportToCSV} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Celkem surovin
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summaryStats.totalIngredients}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Analyzovaných měsíců
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summaryStats.totalMonths}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Celková spotřeba
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summaryStats.totalQuantity.toFixed(1)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Hledat podle názvu, kategorie nebo dodavatele..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-full sm:w-[240px]">
              <SelectValue placeholder="Filtr měsíce" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny měsíce</SelectItem>
              {availableMonths.map((month) => (
                <SelectItem key={month} value={month}>
                  {formatMonth(month)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Data Table */}
        <div className="space-y-6">
          {Array.from(groupedByMonth.entries())
            .sort(([a], [b]) => b.localeCompare(a)) // Sort months descending
            .map(([month, items]) => (
              <div key={month} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-orange-600" />
                  <h3 className="text-lg font-semibold">
                    {formatMonth(month)}
                  </h3>
                  <Badge variant="secondary">{items.length} surovin</Badge>
                </div>

                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Název suroviny</TableHead>
                        <TableHead>Kategorie</TableHead>
                        <TableHead>Dodavatel</TableHead>
                        <TableHead className="text-right">Spotřeba</TableHead>
                        <TableHead className="text-right">
                          Celkem z DB
                        </TableHead>
                        <TableHead>Jednotka</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items
                        .sort((a, b) => b.totalQuantity - a.totalQuantity) // Sort by quantity descending
                        .map((item, index) => (
                          <TableRow
                            key={`${item.month}-${item.ingredientId}-${index}`}
                          >
                            <TableCell className="font-medium">
                              {item.ingredientName}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {item.categoryName || "—"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {item.supplierName || "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-sm font-mono font-semibold">
                                {item.totalQuantity.toFixed(2)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-sm font-mono text-blue-600">
                                {item.totalQuantity.toFixed(2)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.unit}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
        </div>

        {searchFilteredData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nebyly nalezeny žádné položky odpovídající filtru.
          </div>
        )}
      </div>
    </Card>
  );
}
