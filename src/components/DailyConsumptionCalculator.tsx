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
  Calculator,
  Calendar as CalendarIcon,
  Package,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

import { useToast } from "@/hooks/use-toast";
import { useDailyConsumption } from "@/hooks/useDailyConsumption";
import { useUpdateIngredientQuantity } from "@/hooks/useIngredientQuantities";

export function DailyConsumptionCalculator() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCalculating, setIsCalculating] = useState(false);
  const { toast } = useToast();
  const updateQuantity = useUpdateIngredientQuantity();

  // Fetch daily consumption data
  const {
    data: consumptionData,
    isLoading,
    error,
  } = useDailyConsumption(selectedDate);

  // Calculate consumption summary
  const consumptionSummary = useMemo(() => {
    if (!consumptionData) return null;

    const totalIngredients = consumptionData.length;
    const totalConsumption = consumptionData.reduce(
      (sum, item) => sum + item.totalConsumption,
      0
    );
    const lowStockAfter = consumptionData.filter(
      (item) => item.newQuantity < 10
    ).length;
    const outOfStock = consumptionData.filter(
      (item) => item.newQuantity <= 0
    ).length;

    return {
      totalIngredients,
      totalConsumption,
      lowStockAfter,
      outOfStock,
    };
  }, [consumptionData]);

  const handleApplyConsumption = async () => {
    if (!consumptionData) return;

    setIsCalculating(true);
    try {
      // Update quantities for each ingredient
      const updatePromises = consumptionData.map((item) =>
        updateQuantity.mutateAsync({
          ingredient_id: item.ingredientId,
          quantity_change: -item.totalConsumption,
          operation_type: "decrease",
        })
      );

      await Promise.all(updatePromises);

      toast({
        title: "Úspěch",
        description: `Spotřeba byla úspěšně aplikována na ${consumptionData.length} surovin`,
      });
    } catch (error) {
      toast({
        title: "Chyba",
        description: "Nepodařilo se aplikovat spotřebu surovin",
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const getStatusIcon = (newQuantity: number) => {
    if (newQuantity <= 0) {
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    } else if (newQuantity < 10) {
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    } else {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getStatusBadge = (newQuantity: number) => {
    if (newQuantity <= 0) {
      return <Badge variant="destructive">Vyprodáno</Badge>;
    } else if (newQuantity < 10) {
      return (
        <Badge variant="outline" className="text-orange-600">
          Nízké zásoby
        </Badge>
      );
    } else {
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
          Chyba při načítání spotřeby: {error.message}
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
            <h2 className="text-2xl font-bold">Kalkulátor denní spotřeby</h2>
            <p className="text-muted-foreground">
              Výpočet spotřeby surovin na základě denních objednávek a receptů
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
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button
              onClick={handleApplyConsumption}
              disabled={
                isCalculating ||
                !consumptionData ||
                consumptionData.length === 0
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isCalculating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Aplikuji...
                </>
              ) : (
                <>
                  <Calculator className="h-4 w-4 mr-2" />
                  Aplikovat spotřebu
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {consumptionSummary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Celkem surovin
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {consumptionSummary.totalIngredients}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Celková spotřeba
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {consumptionSummary.totalConsumption.toFixed(1)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Nízké zásoby po
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {consumptionSummary.lowStockAfter}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Vyprodáno</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {consumptionSummary.outOfStock}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Consumption Table */}
        {consumptionData && consumptionData.length > 0 ? (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Surovina</TableHead>
                  <TableHead className="text-right">
                    Aktuální množství
                  </TableHead>
                  <TableHead className="text-right">Spotřeba</TableHead>
                  <TableHead className="text-right">Nové množství</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Objednávky</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consumptionData.map((item) => (
                  <TableRow key={item.ingredientId}>
                    <TableCell className="font-medium">
                      {item.ingredientName}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-mono">
                        {item.currentQuantity.toFixed(1)} {item.unit}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-mono text-red-600">
                        -{item.totalConsumption.toFixed(1)} {item.unit}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-mono">
                        {item.newQuantity.toFixed(1)} {item.unit}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(item.newQuantity)}
                        {getStatusBadge(item.newQuantity)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground">
                        {item.orders.length} objednávek
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Žádná spotřeba nebyla nalezena pro vybraný den.
          </div>
        )}
      </div>
    </Card>
  );
}
