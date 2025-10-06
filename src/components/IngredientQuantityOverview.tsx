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
import {
  useIngredientQuantities,
  useInitializeIngredientQuantities,
} from "@/hooks/useIngredientQuantities";
import { useIngredients } from "@/hooks/useIngredients";
import { useToast } from "@/hooks/use-toast";
import { useUsers } from "@/hooks/useProfiles";
import { supabase } from "@/lib/supabase";

export function IngredientQuantityOverview() {
  const [globalFilter, setGlobalFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedUserId, setSelectedUserId] = useState(
    "e597fcc9-7ce8-407d-ad1a-fdace061e42f"
  );
  const [inventoryDate, setInventoryDate] = useState<string | null>(null);

  // Fetch real data from database
  const { data: quantities, isLoading, error } = useIngredientQuantities();
  const { data: ingredients } = useIngredients();
  const { data: allUsers } = useUsers();
  const { toast } = useToast();
  const initializeQuantities = useInitializeIngredientQuantities();

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

  // Transform quantities data for display
  const transformedQuantities = useMemo(() => {
    if (!quantities) return [];

    return quantities.map((qty) => {
      const status =
        qty.current_quantity < 10
          ? "low"
          : qty.current_quantity > 80
            ? "high"
            : "normal";
      const price = qty.ingredient?.price || 0;

      return {
        id: qty.id,
        ingredientId: qty.ingredient_id,
        name: qty.ingredient?.name || "Neznámá surovina",
        currentQuantity: qty.current_quantity,
        unit: qty.unit,
        category:
          qty.ingredient?.ingredient_categories?.name || "Bez kategorie",
        supplier: qty.ingredient?.supplier?.full_name || "—",
        lastUpdated: qty.last_updated,
        status,
        price,
        totalValue: qty.current_quantity * price,
      };
    });
  }, [quantities]);

  // Filter ingredients based on search, category, and status
  const filteredQuantities = useMemo(() => {
    return transformedQuantities.filter((item) => {
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
    });
  }, [transformedQuantities, globalFilter, categoryFilter, statusFilter]);

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

  const handleInitializeInventory = async () => {
    try {
      await initializeQuantities.mutateAsync(selectedUserId);
      const selectedUser = allUsers?.find(
        (user: any) => user.id === selectedUserId
      );

      // Fetch the inventory date for display
      const { data: inventory } = await supabase
        .from("inventories")
        .select("date")
        .eq("user_id", selectedUserId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (inventory?.date) {
        setInventoryDate(inventory.date);
      }

      toast({
        title: "Úspěch",
        description: `Zásoby byly úspěšně inicializovány z inventory_items pro uživatele ${selectedUser?.full_name || selectedUserId}`,
      });
    } catch (error) {
      toast({
        title: "Chyba",
        description: "Nepodařilo se inicializovat zásoby z inventory_items",
        variant: "destructive",
      });
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

  if (!quantities || quantities.length === 0) {
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
                onClick={handleInitializeInventory}
                disabled={initializeQuantities.isPending}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {initializeQuantities.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Inicializuji...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Inicializovat zásoby
                  </>
                )}
              </Button>
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
              <Button
                onClick={handleInitializeInventory}
                disabled={initializeQuantities.isPending}
                variant="outline"
                size="sm"
              >
                {initializeQuantities.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Inicializuji...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Reinit zásoby
                  </>
                )}
              </Button>
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
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Přehled zásob</TabsTrigger>
              <TabsTrigger value="low-stock">Nízké zásoby</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Název</TableHead>
                      <TableHead>Kategorie</TableHead>
                      <TableHead>Dodavatel</TableHead>
                      <TableHead className="text-right">Množství</TableHead>
                      <TableHead>Jednotka</TableHead>
                      <TableHead className="text-right">Cena</TableHead>
                      <TableHead className="text-right">Hodnota</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Akce</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuantities.map((item) => (
                      <TableRow key={item.id}>
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

              {filteredQuantities.length === 0 && (
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
                      <TableHead>Název</TableHead>
                      <TableHead>Kategorie</TableHead>
                      <TableHead>Dodavatel</TableHead>
                      <TableHead className="text-right">Množství</TableHead>
                      <TableHead>Jednotka</TableHead>
                      <TableHead className="text-right">Cena</TableHead>
                      <TableHead className="text-right">Hodnota</TableHead>
                      <TableHead className="text-right">Akce</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuantities
                      .filter((item) => item.status === "low")
                      .map((item) => (
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
          </Tabs>
        </div>
      </Card>
    </>
  );
}
