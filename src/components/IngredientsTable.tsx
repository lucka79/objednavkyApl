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
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIngredients, IngredientWithCategory } from "@/hooks/useIngredients";
import { Plus, Search, Package, Tag, Scale } from "lucide-react";

export function IngredientsTable() {
  const { data, error, isLoading } = useIngredients();
  const [globalFilter, setGlobalFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Group ingredients by category
  const groupedIngredients = useMemo(() => {
    if (!data?.ingredients) return [];

    const grouped = data.ingredients.reduce(
      (acc, ingredient) => {
        const categoryName =
          ingredient.ingredient_categories?.name || "Bez kategorie";
        if (!acc[categoryName]) {
          acc[categoryName] = [];
        }
        acc[categoryName].push(ingredient);
        return acc;
      },
      {} as Record<string, IngredientWithCategory[]>
    );

    // Sort categories and ingredients within each category
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([categoryName, ingredients]) => ({
        categoryName,
        ingredients: ingredients.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [data?.ingredients]);

  // Filter ingredients based on search and category
  const filteredGroupedIngredients = useMemo(() => {
    return groupedIngredients
      .filter(
        ({ categoryName }) =>
          categoryFilter === "all" || categoryName === categoryFilter
      )
      .map(({ categoryName, ingredients }) => ({
        categoryName,
        ingredients: ingredients.filter(
          (ingredient) =>
            ingredient.name
              .toLowerCase()
              .includes(globalFilter.toLowerCase()) ||
            ingredient.ean?.includes(globalFilter) ||
            ingredient.ingredient_categories?.name
              .toLowerCase()
              .includes(globalFilter.toLowerCase())
        ),
      }))
      .filter(({ ingredients }) => ingredients.length > 0);
  }, [groupedIngredients, globalFilter, categoryFilter]);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">Načítání ingrediencí...</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center py-8 text-red-600">
          Chyba při načítání ingrediencí: {error.message}
        </div>
      </Card>
    );
  }

  const totalIngredients = data?.ingredients.length || 0;
  const activeIngredients =
    data?.ingredients.filter((i) => i.active).length || 0;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold">Ingredience</h2>
            <p className="text-muted-foreground">
              {activeIngredients} aktivních z {totalIngredients} celkem
            </p>
          </div>
          <Button className="bg-orange-600 hover:bg-orange-700">
            <Plus className="h-4 w-4 mr-2" />
            Nová ingredience
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Hledat podle názvu, EAN nebo kategorie..."
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
              {data?.categories.map((category) => (
                <SelectItem key={category.id} value={category.name}>
                  {category.name}
                </SelectItem>
              ))}
              <SelectItem value="Bez kategorie">Bez kategorie</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Ingredients by Category */}
        <div className="space-y-6">
          {filteredGroupedIngredients.map(({ categoryName, ingredients }) => (
            <div key={categoryName} className="space-y-2">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-orange-600" />
                <h3 className="text-lg font-semibold text-orange-800">
                  {categoryName}
                </h3>
                <Badge variant="outline" className="text-xs">
                  {ingredients.length} ingrediencí
                </Badge>
              </div>

              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Název</TableHead>
                      <TableHead>Jednotka</TableHead>
                      <TableHead className="text-right">kg/Jednotka</TableHead>
                      <TableHead className="text-right">Cena</TableHead>
                      <TableHead>Balení</TableHead>
                      <TableHead className="text-right">DPH</TableHead>
                      {/* <TableHead>EAN</TableHead> */}
                      <TableHead>Status</TableHead>
                      <TableHead>Pouze prodejna</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ingredients.map((ingredient) => (
                      <TableRow key={ingredient.id}>
                        <TableCell className="font-medium">
                          {ingredient.name}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Scale className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{ingredient.unit}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm">
                            {ingredient.kiloPerUnit.toFixed(3)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <span className="text-sm">
                              {ingredient.price
                                ? `${ingredient.price.toFixed(2)} Kč`
                                : "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Package className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">
                              {ingredient.package
                                ? `${ingredient.package}`
                                : "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm">
                            {ingredient.vat ? `${ingredient.vat}%` : "—"}
                          </span>
                        </TableCell>
                        {/* <TableCell>
                          <span className="text-sm font-mono">
                            {ingredient.ean || "—"}
                          </span>
                        </TableCell> */}
                        <TableCell>
                          <Badge
                            variant={
                              ingredient.active ? "default" : "secondary"
                            }
                            className={
                              ingredient.active
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-600"
                            }
                          >
                            {ingredient.active ? "Aktivní" : "Neaktivní"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              ingredient.storeOnly
                                ? "border-orange-500 text-orange-700"
                                : "border-gray-300 text-gray-600"
                            }
                          >
                            {ingredient.storeOnly ? "Ano" : "Ne"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>

        {filteredGroupedIngredients.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nebyly nalezeny žádné ingredience odpovídající filtru.
          </div>
        )}
      </div>
    </Card>
  );
}
