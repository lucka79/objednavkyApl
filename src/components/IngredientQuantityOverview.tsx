import { useMemo, useState, useEffect } from "react";
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
import { useIngredientStore } from "@/stores/ingredientStore";
import {
  Search,
  Package,
  Tag,
  Scale,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  FileText,
} from "lucide-react";

import { removeDiacritics } from "@/utils/removeDiacritics";

import { useSupplierUsers } from "@/hooks/useProfiles";

interface IngredientQuantity {
  id: number;
  name: string;
  currentQuantity: number;
  unit: string;
  category: string;
  supplier: string;
  lastUpdated: string;
  status: "low" | "normal" | "high";
  price: number;
  totalValue: number;
}

export function IngredientQuantityOverview() {
  const {
    ingredients,
    categories,
    isLoading,
    error,
    fetchIngredients,
    fetchCategories,
  } = useIngredientStore();

  const [globalFilter, setGlobalFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");
  const { data: supplierUsers } = useSupplierUsers();

  // Mock quantity data - in real implementation, this would come from your database
  const mockQuantities: IngredientQuantity[] = useMemo(() => {
    if (!ingredients) return [];

    return ingredients.map((ingredient) => {
      // Generate mock quantity data
      const currentQuantity = Math.random() * 100;
      const status =
        currentQuantity < 10 ? "low" : currentQuantity > 80 ? "high" : "normal";
      const price = ingredient.price || 0;

      return {
        id: ingredient.id,
        name: ingredient.name,
        currentQuantity,
        unit: ingredient.unit,
        category: ingredient.ingredient_categories?.name || "Bez kategorie",
        supplier:
          (supplierUsers || []).find(
            (u: any) => u.id === ingredient.supplier_id
          )?.full_name || "—",
        lastUpdated: new Date().toISOString(),
        status,
        price,
        totalValue: currentQuantity * price,
      };
    });
  }, [ingredients, supplierUsers]);

  // Load data on mount
  useEffect(() => {
    fetchIngredients();
    fetchCategories();
  }, [fetchIngredients, fetchCategories]);

  // Filter ingredients based on search, category, and status
  const filteredQuantities = useMemo(() => {
    return mockQuantities.filter((item) => {
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
  }, [mockQuantities, globalFilter, categoryFilter, statusFilter]);

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
        <div className="text-center py-8">Načítání přehledu surovin...</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center py-8 text-red-600">
          Chyba při načítání surovin: {error}
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
                {categories.map((category) => (
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
