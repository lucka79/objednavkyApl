import { useEffect, useMemo, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Package,
  Tag,
  Scale,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  FileText,
  RefreshCw,
} from "lucide-react";

import { removeDiacritics } from "@/utils/removeDiacritics";
import { useIngredients } from "@/hooks/useIngredients";
import { useUsers } from "@/hooks/useProfiles";
import { supabase } from "@/lib/supabase";
import { MonthlyIngredientConsumption } from "./MonthlyIngredientConsumption";
import { DailyIngredientConsumption } from "./DailyIngredientConsumption";
import { ProductionCalendar } from "./ProductionCalendar";
import { useQuery } from "@tanstack/react-query";

export function IngredientQuantityOverview() {
  const [globalFilter, setGlobalFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [showZeroQuantities, setShowZeroQuantities] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(
    "e597fcc9-7ce8-407d-ad1a-fdace061e42f"
  );
  const [inventoryDate, setInventoryDate] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Fetch inventory data from database
  const {
    data: inventoryItems,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["inventoryItems", selectedUserId, selectedMonth.toISOString()],
    queryFn: async () => {
      // First, determine the appropriate inventory date for the selected month
      const today = new Date();
      const isCurrentMonth =
        selectedMonth.getFullYear() === today.getFullYear() &&
        selectedMonth.getMonth() === today.getMonth();

      let targetInventoryDate: string | null = null;

      if (isCurrentMonth) {
        // For current month, use the latest inventory
        const { data: inventory } = await supabase
          .from("inventories")
          .select("date")
          .eq("user_id", selectedUserId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        targetInventoryDate = inventory?.date || null;
      } else {
        // For past months, use inventory from the last day of the month before the selected month
        const firstDayOfSelectedMonth = new Date(
          selectedMonth.getFullYear(),
          selectedMonth.getMonth(),
          1
        );
        const lastDayOfPreviousMonth = new Date(firstDayOfSelectedMonth);
        lastDayOfPreviousMonth.setDate(lastDayOfPreviousMonth.getDate() - 1);

        const lastDayStr = `${lastDayOfPreviousMonth.getFullYear()}-${String(lastDayOfPreviousMonth.getMonth() + 1).padStart(2, "0")}-${String(lastDayOfPreviousMonth.getDate()).padStart(2, "0")}`;

        const { data: inventory } = await supabase
          .from("inventories")
          .select("date")
          .eq("user_id", selectedUserId)
          .lte("date", lastDayStr)
          .order("date", { ascending: false })
          .limit(1)
          .single();

        targetInventoryDate = inventory?.date || null;
      }

      if (!targetInventoryDate) {
        console.log("No inventory date found for selected month");
        return [];
      }

      console.log("=== INVENTORY QUERY DEBUG ===");
      console.log("Selected month:", selectedMonth.toISOString());
      console.log("Target inventory date:", targetInventoryDate);
      console.log("Is current month:", isCurrentMonth);

      // Now fetch inventory items for the specific inventory date
      const { data, error } = await supabase
        .from("inventory_items")
        .select(
          `
          id,
          quantity,
          ingredient_id,
          inventories!inner (
            user_id,
            date
          ),
          ingredients!inner (
            id,
            name,
            unit,
            price,
            ingredient_categories (
              id,
              name
            ),
            ingredient_supplier_codes (
              id,
              supplier_id,
              is_active
            )
          )
        `
        )
        .eq("inventories.user_id", selectedUserId)
        .eq("inventories.date", targetInventoryDate)
        .not("ingredient_id", "is", null);

      if (error) {
        console.error("Error fetching inventory items:", error);
        throw error;
      }

      console.log("Found inventory items:", data?.length || 0);
      console.log("=== END INVENTORY QUERY DEBUG ===");

      return data || [];
    },
    enabled: !!selectedUserId,
  });

  const { data: ingredients } = useIngredients();
  const { data: allUsers } = useUsers();

  // Fetch suppliers for lookup (from profiles table)
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("supplier", true);

      if (error) {
        console.error("Error fetching suppliers:", error);
        throw error;
      }

      return data || [];
    },
  });
  // Fetch monthly consumption data from daily_ingredient_consumption table
  const { data: monthlyConsumption } = useQuery({
    queryKey: ["monthlyConsumptionForOverview", selectedMonth.toISOString()],
    queryFn: async () => {
      const firstDayOfMonth = new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth(),
        1
      );
      const lastDayOfMonth = new Date(
        selectedMonth.getFullYear(),
        selectedMonth.getMonth() + 1,
        0
      );

      // If selected month is current month, use tomorrow as end date
      const today = new Date();
      const isCurrentMonth =
        selectedMonth.getFullYear() === today.getFullYear() &&
        selectedMonth.getMonth() === today.getMonth();

      const endDate = isCurrentMonth
        ? new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
        : lastDayOfMonth;

      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatLocalDate(firstDayOfMonth);
      const endDateStr = formatLocalDate(endDate);

      const { data: consumptionData, error } = await supabase
        .from("daily_ingredient_consumption")
        .select(
          `
          ingredient_id,
          quantity
        `
        )
        .gte("date", startDateStr)
        .lte("date", endDateStr);

      if (error) {
        console.error("Error fetching monthly consumption:", error);
        throw error;
      }

      if (!consumptionData || consumptionData.length === 0) {
        return [];
      }

      // Aggregate consumption by ingredient
      const consumptionMap = new Map<number, number>();

      consumptionData.forEach((item) => {
        const ingredientId = item.ingredient_id;
        const quantity = item.quantity || 0;

        if (consumptionMap.has(ingredientId)) {
          consumptionMap.set(
            ingredientId,
            consumptionMap.get(ingredientId)! + quantity
          );
        } else {
          consumptionMap.set(ingredientId, quantity);
        }
      });

      return Array.from(consumptionMap.entries()).map(
        ([ingredientId, totalQuantity]) => ({
          ingredientId,
          totalQuantity,
        })
      );
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: true,
  });

  // Extract inventory date from the first inventory item (if any)
  useEffect(() => {
    if (inventoryItems && inventoryItems.length > 0) {
      const firstItem = inventoryItems[0] as any;
      if (firstItem.inventories?.date) {
        setInventoryDate(firstItem.inventories.date);
      }
    } else {
      setInventoryDate(null);
    }
  }, [inventoryItems]);

  // Get categories from ingredients data
  const categories = useMemo(() => {
    if (!ingredients?.ingredients) return [];

    const categoryMap = new Map();
    ingredients.ingredients.forEach((ingredient: any) => {
      if (ingredient.ingredient_categories) {
        categoryMap.set(
          ingredient.ingredient_categories.id,
          ingredient.ingredient_categories
        );
      }
    });

    return Array.from(categoryMap.values());
  }, [ingredients]);

  // Transform inventory data for display and group by category
  const groupedQuantities = useMemo(() => {
    if (!inventoryItems) return [];

    // Create a map of consumption data for quick lookup
    const consumptionMap = new Map<number, number>();
    if (monthlyConsumption) {
      monthlyConsumption.forEach((consumption) => {
        consumptionMap.set(consumption.ingredientId, consumption.totalQuantity);
      });
    }

    // Create a map of suppliers for quick lookup
    const supplierMap = new Map<string, string>();
    if (suppliers) {
      suppliers.forEach((supplier: any) => {
        supplierMap.set(supplier.id, supplier.full_name);
      });
    }

    // Aggregate quantities by ingredient to avoid duplicates
    const aggregatedData = new Map();

    inventoryItems
      .filter((item) => showZeroQuantities || item.quantity > 0)
      .forEach((item) => {
        const ingredient = item.ingredients as any;
        if (!ingredient) return;

        const ingredientId = item.ingredient_id;
        const existing = aggregatedData.get(ingredientId);

        if (existing) {
          // Add to existing quantity
          existing.currentQuantity += item.quantity || 0;
          existing.totalValue = existing.currentQuantity * existing.price;
        } else {
          // Create new entry
          const price = ingredient?.price || 0;
          const monthlyConsumption = consumptionMap.get(ingredientId) || 0;

          // Find active supplier from ingredient_supplier_codes
          const activeSupplierCode =
            ingredient?.ingredient_supplier_codes?.find(
              (code: any) => code.is_active
            );
          const supplierName = activeSupplierCode?.supplier_id
            ? supplierMap.get(activeSupplierCode.supplier_id) || "—"
            : "—";

          aggregatedData.set(ingredientId, {
            id: item.id, // Keep the first inventory item ID
            ingredientId,
            name: ingredient?.name || "Neznámá surovina",
            currentQuantity: item.quantity || 0,
            monthlyConsumption,
            unit: ingredient?.unit || "kg",
            category:
              ingredient?.ingredient_categories?.name || "Bez kategorie",
            supplier: supplierName,
            lastUpdated: new Date().toISOString(),
            price,
            totalValue: (item.quantity || 0) * price,
          });
        }
      });

    const transformedData = Array.from(aggregatedData.values()).map((item) => {
      const status =
        item.currentQuantity < 10
          ? "low"
          : item.currentQuantity > 80
            ? "high"
            : "normal";
      return {
        ...item,
        status,
      };
    });

    // Group by category
    const grouped = transformedData.reduce(
      (acc, item) => {
        const categoryName = item.category;
        if (!acc[categoryName]) {
          acc[categoryName] = [];
        }
        acc[categoryName].push(item);
        return acc;
      },
      {} as Record<string, typeof transformedData>
    );

    // Sort categories and ingredients within each category
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([categoryName, ingredients]) => ({
        categoryName,
        ingredients: (ingredients as any[]).sort((a: any, b: any) =>
          a.name.localeCompare(b.name)
        ),
      }));
  }, [inventoryItems, monthlyConsumption, showZeroQuantities, suppliers]);

  // Filter grouped ingredients based on search, category, and status
  const filteredGroupedQuantities = useMemo(() => {
    return groupedQuantities
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
        ingredients: ingredients.filter((item: any) => {
          const searchLower = removeDiacritics(globalFilter.toLowerCase());
          const nameMatch = removeDiacritics(item.name.toLowerCase()).includes(
            searchLower
          );
          const categoryMatch = removeDiacritics(
            item.category.toLowerCase()
          ).includes(searchLower);
          const supplierMatch = removeDiacritics(
            item.supplier.toLowerCase()
          ).includes(searchLower);

          const searchMatch =
            globalFilter.trim() === "" ||
            nameMatch ||
            categoryMatch ||
            supplierMatch;
          const categoryFilterMatch =
            categoryFilter === "all" || item.category === categoryFilter;
          const statusFilterMatch =
            statusFilter === "all" || item.status === statusFilter;

          return searchMatch && categoryFilterMatch && statusFilterMatch;
        }),
      }))
      .filter(({ ingredients }) => ingredients.length > 0);
  }, [groupedQuantities, globalFilter, categoryFilter, statusFilter]);

  // Flatten for summary stats and other uses
  const filteredQuantities = useMemo(() => {
    return filteredGroupedQuantities.flatMap(({ ingredients }) => ingredients);
  }, [filteredGroupedQuantities]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalItems = filteredQuantities.length;
    const lowStock = filteredQuantities.filter(
      (item) => item.status === "low"
    ).length;
    const totalValue = filteredQuantities.reduce(
      (sum, item) => sum + item.totalValue,
      0
    );
    const averageQuantity =
      filteredQuantities.reduce((sum, item) => sum + item.currentQuantity, 0) /
        totalItems || 0;

    return {
      totalItems,
      lowStock,
      totalValue,
      averageQuantity,
    };
  }, [filteredQuantities]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "low":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "high":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "low":
        return <Badge variant="destructive">Nízké zásoby</Badge>;
      case "high":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Vysoké zásoby
          </Badge>
        );
      default:
        return <Badge variant="secondary">Normální</Badge>;
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
          Chyba při načítání zásob: {error.message}
        </div>
      </Card>
    );
  }

  if (!inventoryItems || inventoryItems.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-orange-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Žádné zásoby nebyly nalezeny
          </h3>
          <p className="text-gray-600 mb-4">
            Pro zobrazení zásob je potřeba inicializovat databázi z
            inventory_items pro vybraného uživatele.
          </p>
          <div className="space-y-4">
            <div className="flex justify-center">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-80">
                  <SelectValue placeholder="Vyberte uživatele" />
                </SelectTrigger>
                <SelectContent>
                  {(allUsers || []).map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Obnovit
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold">Přehled zásob surovin</h2>
              <p className="text-muted-foreground">
                Celkový počet položek: {summaryStats.totalItems} | Nízké zásoby:{" "}
                {summaryStats.lowStock} | Celková hodnota:{" "}
                {summaryStats.totalValue.toFixed(2)} Kč
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Uživatel:{" "}
                {allUsers?.find((user) => user.id === selectedUserId)
                  ?.full_name || selectedUserId}
                {inventoryDate && (
                  <span className="ml-2">
                    | Datum inventury:{" "}
                    {new Date(inventoryDate).toLocaleDateString("cs-CZ")}
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Měsíc:</label>
                <Select
                  value={`${selectedMonth.getFullYear()}-${selectedMonth.getMonth()}`}
                  onValueChange={(value) => {
                    const [year, month] = value.split("-");
                    setSelectedMonth(
                      new Date(parseInt(year), parseInt(month), 1)
                    );
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue>
                      {(() => {
                        const months = [
                          "Leden",
                          "Únor",
                          "Březen",
                          "Duben",
                          "Květen",
                          "Červen",
                          "Červenec",
                          "Srpen",
                          "Září",
                          "Říjen",
                          "Listopad",
                          "Prosinec",
                        ];
                        return `${months[selectedMonth.getMonth()]} ${selectedMonth.getFullYear()}`;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const months = [
                        "Leden",
                        "Únor",
                        "Březen",
                        "Duben",
                        "Květen",
                        "Červen",
                        "Červenec",
                        "Srpen",
                        "Září",
                        "Říjen",
                        "Listopad",
                        "Prosinec",
                      ];
                      const currentYear = new Date().getFullYear();
                      const options = [];

                      // Add current year months
                      for (let month = 0; month < 12; month++) {
                        options.push(
                          <SelectItem
                            key={`${currentYear}-${month}`}
                            value={`${currentYear}-${month}`}
                          >
                            {months[month]} {currentYear}
                          </SelectItem>
                        );
                      }

                      // Add previous year months
                      for (let month = 0; month < 12; month++) {
                        options.push(
                          <SelectItem
                            key={`${currentYear - 1}-${month}`}
                            value={`${currentYear - 1}-${month}`}
                          >
                            {months[month]} {currentYear - 1}
                          </SelectItem>
                        );
                      }

                      return options;
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => setShowZeroQuantities(!showZeroQuantities)}
                variant={showZeroQuantities ? "default" : "outline"}
                size="sm"
              >
                {showZeroQuantities ? (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Skrýt nulové
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Zobrazit nulové
                  </>
                )}
              </Button>
              <Select
                value={selectedUserId}
                onValueChange={(value) => {
                  setSelectedUserId(value);
                  setInventoryDate(null);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Vyberte uživatele" />
                </SelectTrigger>
                <SelectContent>
                  {(allUsers || []).map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Celkem položek
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryStats.totalItems}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Nízké zásoby
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {summaryStats.lowStock}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Celková hodnota
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryStats.totalValue.toFixed(2)} Kč
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Průměrné množství
                </CardTitle>
                <Scale className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summaryStats.averageQuantity.toFixed(1)}
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
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtr kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny kategorie</SelectItem>
                {categories.map((category: any) => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
                <SelectItem value="Bez kategorie">Bez kategorie</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtr stavu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny stavy</SelectItem>
                <SelectItem value="low">Nízké zásoby</SelectItem>
                <SelectItem value="normal">Normální</SelectItem>
                <SelectItem value="high">Vysoké zásoby</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Přehled zásob</TabsTrigger>
              <TabsTrigger value="low-stock">Nízké zásoby</TabsTrigger>
              <TabsTrigger value="daily">Denní spotřeba</TabsTrigger>
              <TabsTrigger value="consumption">Měsíční spotřeba</TabsTrigger>
              <TabsTrigger value="calendar">Kalendář produkce</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              {/* Production Calendar */}
              <ProductionCalendar selectedMonth={selectedMonth} />

              {filteredGroupedQuantities.map(
                ({ categoryName, ingredients }) => (
                  <div key={categoryName} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-orange-600" />
                      <h3 className="text-lg font-semibold text-orange-800">
                        {categoryName}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {ingredients.length} surovin
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
                            <TableHead className="text-right w-[120px]">
                              <div className="flex flex-col items-end">
                                <span>Množství</span>
                                {inventoryDate && (
                                  <span className="text-xs text-muted-foreground font-normal">
                                    Inventura:{" "}
                                    {new Date(inventoryDate).toLocaleDateString(
                                      "cs-CZ"
                                    )}
                                  </span>
                                )}
                              </div>
                            </TableHead>
                            <TableHead className="w-[100px]">
                              Jednotka
                            </TableHead>
                            <TableHead className="text-right w-[140px]">
                              <div className="flex flex-col items-end">
                                <span>Spotřeba (měsíc)</span>
                                <span className="text-xs text-muted-foreground font-normal">
                                  {selectedMonth.getFullYear()}-
                                  {String(
                                    selectedMonth.getMonth() + 1
                                  ).padStart(2, "0")}
                                  -01 až{" "}
                                  {(() => {
                                    const today = new Date();
                                    const isCurrentMonth =
                                      selectedMonth.getFullYear() ===
                                        today.getFullYear() &&
                                      selectedMonth.getMonth() ===
                                        today.getMonth();
                                    if (isCurrentMonth) {
                                      return String(
                                        today.getDate() + 1
                                      ).padStart(2, "0");
                                    } else {
                                      const lastDay = new Date(
                                        selectedMonth.getFullYear(),
                                        selectedMonth.getMonth() + 1,
                                        0
                                      );
                                      return String(lastDay.getDate()).padStart(
                                        2,
                                        "0"
                                      );
                                    }
                                  })()}
                                </span>
                              </div>
                            </TableHead>
                            <TableHead className="text-right w-[100px]">
                              Cena
                            </TableHead>
                            <TableHead className="text-right w-[120px]">
                              Hodnota
                            </TableHead>
                            <TableHead className="w-[120px]">Status</TableHead>
                            <TableHead className="text-right w-[80px]">
                              Akce
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ingredients.map((item: any) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                {item.name}
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">{item.supplier}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-sm font-mono">
                                  {item.currentQuantity.toFixed(1)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Scale className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-sm">{item.unit}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-sm font-mono text-blue-600">
                                  {item.monthlyConsumption.toFixed(1)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-sm">
                                  {item.price.toFixed(2)} Kč
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-sm font-semibold">
                                  {item.totalValue.toFixed(2)} Kč
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(item.status)}
                                  {getStatusBadge(item.status)}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm">
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )
              )}

              {filteredGroupedQuantities.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nebyly nalezeny žádné položky odpovídající filtru.
                </div>
              )}
            </TabsContent>

            {/* Low Stock Tab */}
            <TabsContent value="low-stock" className="space-y-6 mt-6">
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Název</TableHead>
                      <TableHead className="w-[150px]">Kategorie</TableHead>
                      <TableHead className="w-[150px]">Dodavatel</TableHead>
                      <TableHead className="text-right w-[120px]">
                        <div className="flex flex-col items-end">
                          <span>Množství</span>
                          {inventoryDate && (
                            <span className="text-xs text-muted-foreground font-normal">
                              Inventura:{" "}
                              {new Date(inventoryDate).toLocaleDateString(
                                "cs-CZ"
                              )}
                            </span>
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="w-[100px]">Jednotka</TableHead>
                      <TableHead className="text-right w-[100px]">
                        Cena
                      </TableHead>
                      <TableHead className="text-right w-[120px]">
                        Hodnota
                      </TableHead>
                      <TableHead className="text-right w-[80px]">
                        Akce
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuantities
                      .filter((item: any) => item.status === "low")
                      .map((item: any) => (
                        <TableRow key={item.id} className="bg-red-50">
                          <TableCell className="font-medium">
                            {item.name}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Tag className="h-3 w-3 text-orange-600" />
                              <span className="text-sm">{item.category}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{item.supplier}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-sm font-mono text-red-600">
                              {item.currentQuantity.toFixed(1)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Scale className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{item.unit}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-sm">
                              {item.price.toFixed(2)} Kč
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-sm font-semibold">
                              {item.totalValue.toFixed(2)} Kč
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">
                              <FileText className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>

              {filteredQuantities.filter((item) => item.status === "low")
                .length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Žádné položky s nízkými zásobami.
                </div>
              )}
            </TabsContent>

            {/* Daily Consumption Tab */}
            <TabsContent value="daily" className="space-y-6 mt-6">
              <DailyIngredientConsumption />
            </TabsContent>

            {/* Monthly Consumption Tab */}
            <TabsContent value="consumption" className="space-y-6 mt-6">
              <MonthlyIngredientConsumption />
            </TabsContent>

            {/* Production Calendar Tab */}
            <TabsContent value="calendar" className="space-y-6 mt-6">
              <ProductionCalendar selectedMonth={selectedMonth} />
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </>
  );
}
