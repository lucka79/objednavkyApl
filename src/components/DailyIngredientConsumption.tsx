import { useState, useEffect } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Package,
  RefreshCw,
  TrendingUp,
  Calculator,
  CheckCircle,
  Info,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import {
  useDailyIngredientConsumption,
  useCalculateDailyConsumptionFromProduction,
  useDeleteDailyConsumption,
} from "@/hooks/useDailyIngredientConsumption";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export function DailyIngredientConsumption() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dataSource, setDataSource] = useState<"production" | null>(null);
  const [hasBakerProductions, setHasBakerProductions] = useState<
    boolean | null
  >(null);
  const { toast } = useToast();

  const {
    data: consumption,
    isLoading,
    error,
  } = useDailyIngredientConsumption(selectedDate);
  const calculateDailyFromProduction =
    useCalculateDailyConsumptionFromProduction();
  const deleteDaily = useDeleteDailyConsumption();

  // Check if baker productions exist for the selected date
  useEffect(() => {
    const checkBakerProductions = async () => {
      const dateStr = selectedDate.toISOString().split("T")[0];
      const { count, error } = await supabase
        .from("bakers")
        .select("*", { count: "exact", head: true })
        .eq("date", dateStr);

      if (!error) {
        setHasBakerProductions(count !== null && count > 0);
      }
    };

    checkBakerProductions();
  }, [selectedDate]);

  const handleCalculateDailyFromProduction = async () => {
    try {
      const result =
        await calculateDailyFromProduction.mutateAsync(selectedDate);
      setDataSource("production");
      toast({
        title: "Úspěch",
        description: result.message,
      });
    } catch (error) {
      toast({
        title: "Chyba",
        description: "Nepodařilo se vypočítat spotřebu z výroby",
        variant: "destructive",
      });
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    if (!isNaN(newDate.getTime())) {
      setSelectedDate(newDate);
      setDataSource(null); // Reset data source when date changes
    }
  };

  const handleDeleteData = async () => {
    if (
      !confirm(
        `Opravdu chcete smazat všechna data spotřeby pro ${format(selectedDate, "d. MMMM yyyy", { locale: cs })}?`
      )
    ) {
      return;
    }

    try {
      const result = await deleteDaily.mutateAsync(selectedDate);
      setDataSource(null);
      toast({
        title: "Úspěch",
        description: result.message,
      });
    } catch (error) {
      toast({
        title: "Chyba",
        description: "Nepodařilo se smazat data spotřeby",
        variant: "destructive",
      });
    }
  };

  const groupedByIngredient = consumption?.items.reduce(
    (acc, item) => {
      const key = item.ingredientId;
      if (!acc[key]) {
        acc[key] = {
          ingredientId: item.ingredientId,
          ingredientName: item.ingredientName,
          unit: item.unit,
          totalQuantity: 0,
          directQuantity: 0,
          recipeQuantity: 0,
          products: new Map<
            number,
            { name: string; quantity: number; source: string }
          >(),
        };
      }

      acc[key].totalQuantity += item.quantity;
      if (item.source === "direct") {
        acc[key].directQuantity += item.quantity;
      } else {
        acc[key].recipeQuantity += item.quantity;
      }

      const productKey = item.productId;
      if (acc[key].products.has(productKey)) {
        const existing = acc[key].products.get(productKey)!;
        existing.quantity += item.quantity;
      } else {
        acc[key].products.set(productKey, {
          name: item.productName,
          quantity: item.quantity,
          source: item.source,
        });
      }

      return acc;
    },
    {} as Record<
      number,
      {
        ingredientId: number;
        ingredientName: string;
        unit: string;
        totalQuantity: number;
        directQuantity: number;
        recipeQuantity: number;
        products: Map<
          number,
          { name: string; quantity: number; source: string }
        >;
      }
    >
  );

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

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">Denní spotřeba surovin</h2>
              {consumption && consumption.items.length > 0 && (
                <Badge
                  variant={
                    dataSource === "production" ? "default" : "secondary"
                  }
                  className={dataSource === "production" ? "bg-orange-600" : ""}
                >
                  {dataSource === "production"
                    ? "🏭 Z výroby"
                    : "💾 Z databáze"}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {format(selectedDate, "d. MMMM yyyy", { locale: cs })}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <input
              type="date"
              value={format(selectedDate, "yyyy-MM-dd")}
              onChange={handleDateChange}
              className="px-3 py-2 border rounded-md"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleCalculateDailyFromProduction}
                disabled={calculateDailyFromProduction.isPending}
                variant="default"
                size="sm"
                className="bg-orange-600 hover:bg-orange-700"
              >
                {calculateDailyFromProduction.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Počítám...
                  </>
                ) : (
                  <>
                    <Calculator className="h-4 w-4 mr-2" />
                    Vypočítat den
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Delete Data Button */}
        {consumption && consumption.items.length > 0 && (
          <div className="flex justify-end">
            <Button
              onClick={handleDeleteData}
              disabled={deleteDaily.isPending}
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {deleteDaily.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Mažu...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Smazat data pro tento den
                </>
              )}
            </Button>
          </div>
        )}

        {/* Production Availability Info */}
        {hasBakerProductions !== null && (
          <Alert
            className={
              hasBakerProductions
                ? "border-green-200 bg-green-50"
                : "border-yellow-200 bg-yellow-50"
            }
          >
            <Info
              className={`h-4 w-4 ${hasBakerProductions ? "text-green-600" : "text-yellow-600"}`}
            />
            <AlertDescription
              className={
                hasBakerProductions ? "text-green-800" : "text-yellow-800"
              }
            >
              {hasBakerProductions ? (
                <>
                  <strong>✅ Výrobní plány existují</strong> pro{" "}
                  {format(selectedDate, "d. MMMM yyyy", { locale: cs })}. Můžete
                  vypočítat spotřebu surovin.
                </>
              ) : (
                <>
                  <strong>⚠️ Žádné výrobní plány</strong> pro{" "}
                  {format(selectedDate, "d. MMMM yyyy", { locale: cs })}. Pro
                  výpočet spotřeby je potřeba nejprve vytvořit výrobní plány v
                  sekci "Plánovač denní produkce".
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

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
                {consumption?.totalIngredients || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Produktů</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {consumption?.totalProducts || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Položek spotřeby
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {consumption?.items.length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        {groupedByIngredient && Object.keys(groupedByIngredient).length > 0 ? (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Surovina</TableHead>
                  <TableHead className="text-right">Z receptů</TableHead>
                  <TableHead className="text-right">Přímá</TableHead>
                  <TableHead className="text-right">Celkem</TableHead>
                  <TableHead>Jednotka</TableHead>
                  <TableHead>Produkty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.values(groupedByIngredient)
                  .sort((a, b) => b.totalQuantity - a.totalQuantity)
                  .map((item) => (
                    <TableRow key={item.ingredientId}>
                      <TableCell className="font-medium">
                        {item.ingredientName}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.recipeQuantity > 0 && (
                          <span className="text-sm font-mono">
                            {item.recipeQuantity.toFixed(2)}
                          </span>
                        )}
                        {item.recipeQuantity === 0 && (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.directQuantity > 0 && (
                          <span className="text-sm font-mono">
                            {item.directQuantity.toFixed(2)}
                          </span>
                        )}
                        {item.directQuantity === 0 && (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-mono font-semibold">
                          {item.totalQuantity.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.unit}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Array.from(item.products.values()).map(
                            (product, idx) => (
                              <Badge
                                key={idx}
                                variant={
                                  product.source === "direct"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {product.name} ({product.quantity.toFixed(1)})
                              </Badge>
                            )
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
            <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <Package className="h-8 w-8 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Žádná data o spotřebě
            </h3>
            <p className="text-gray-600 mb-4">
              Pro vybraný den nebyly nalezeny žádné údaje o spotřebě surovin.
            </p>
            <Button
              onClick={handleCalculateDailyFromProduction}
              variant="outline"
            >
              <Calculator className="h-4 w-4 mr-2" />
              Vypočítat spotřebu
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
