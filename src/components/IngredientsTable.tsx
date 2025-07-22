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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIngredientStore } from "@/stores/ingredientStore";
import {
  Plus,
  Search,
  Package,
  Tag,
  Scale,
  Edit,
  Trash2,
  FileText,
  ZapIcon,
} from "lucide-react";
import { IngredientForm } from "./IngredientForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export function IngredientsTable() {
  const {
    ingredients,
    categories,
    isLoading,
    error,
    fetchIngredients,
    fetchCategories,
    openCreateForm,
    openEditForm,
    deleteIngredient,
  } = useIngredientStore();

  const { toast } = useToast();
  const [globalFilter, setGlobalFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("categories");

  // Load data on mount
  useEffect(() => {
    fetchIngredients();
    fetchCategories();
  }, [fetchIngredients, fetchCategories]);

  // Group ingredients by category
  const groupedIngredients = useMemo(() => {
    if (!ingredients) return [];

    const grouped = ingredients.reduce(
      (acc, ingredient) => {
        const categoryName =
          ingredient.ingredient_categories?.name || "Bez kategorie";
        if (!acc[categoryName]) {
          acc[categoryName] = [];
        }
        acc[categoryName].push(ingredient);
        return acc;
      },
      {} as Record<string, typeof ingredients>
    );

    // Sort categories and ingredients within each category
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([categoryName, ingredients]) => ({
        categoryName,
        ingredients: ingredients.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [ingredients]);

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

  // Filter all ingredients for the "all" tab
  const filteredAllIngredients = useMemo(() => {
    if (!ingredients) return [];

    return ingredients
      .filter(
        (ingredient) =>
          ingredient.name.toLowerCase().includes(globalFilter.toLowerCase()) ||
          ingredient.ean?.includes(globalFilter) ||
          ingredient.ingredient_categories?.name
            .toLowerCase()
            .includes(globalFilter.toLowerCase())
      )
      .filter((ingredient) => {
        if (categoryFilter === "all") return true;
        const categoryName =
          ingredient.ingredient_categories?.name || "Bez kategorie";
        return categoryName === categoryFilter;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ingredients, globalFilter, categoryFilter]);

  const handleDelete = async (ingredient: (typeof ingredients)[0]) => {
    try {
      await deleteIngredient(ingredient.id);
      toast({
        title: "Úspěch",
        description: "Ingredience byla úspěšně smazána",
      });
    } catch (error) {
      toast({
        title: "Chyba",
        description: "Nepodařilo se smazat ingredienci",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">Načítání surovin...</div>
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

  const totalIngredients = ingredients.length || 0;
  const activeIngredients = ingredients.filter((i) => i.active).length || 0;

  const renderIngredientRow = (ingredient: any) => (
    <TableRow
      key={ingredient.id}
      onClick={() => openEditForm(ingredient)}
      className="cursor-pointer hover:bg-orange-50 transition-colors"
      style={{ userSelect: "none" }}
    >
      <TableCell className="font-medium">{ingredient.name}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Scale className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">{ingredient.unit}</span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <span className="text-sm">{ingredient.kiloPerUnit.toFixed(3)}</span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center gap-1 justify-end">
          <span className="text-sm">
            {ingredient.price ? `${ingredient.price.toFixed(2)} Kč` : "—"}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Package className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">
            {ingredient.package ? `${ingredient.package}` : "—"}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <span className="text-sm">
          {ingredient.vat ? `${ingredient.vat}%` : "—"}
        </span>
      </TableCell>
      <TableCell className="text-center">
        {ingredient.element && ingredient.element.trim() !== "" ? (
          <FileText className="h-4 w-4 text-blue-600 inline-block" />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        {ingredient.kJ || ingredient.kcal ? (
          <ZapIcon className="h-4 w-4 text-orange-500 inline-block" />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant={ingredient.active ? "default" : "secondary"}
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
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openEditForm(ingredient);
            }}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Smazat ingredienci</AlertDialogTitle>
                <AlertDialogDescription>
                  Opravdu chcete smazat ingredienci "{ingredient.name}"? Tato
                  akce je nevratná.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Zrušit</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleDelete(ingredient)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Smazat
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <>
      <Card className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold">Suroviny</h2>
              <p className="text-muted-foreground">
                {activeIngredients} aktivních z {totalIngredients} celkem
              </p>
            </div>
            <Button
              className="bg-orange-600 hover:bg-orange-700"
              onClick={openCreateForm}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nová surovina
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
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
                <SelectItem value="Bez kategorie">Bez kategorie</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="categories">Podle kategorií</TabsTrigger>
              <TabsTrigger value="all">Všechny suroviny</TabsTrigger>
            </TabsList>

            {/* Categories Tab */}
            <TabsContent value="categories" className="space-y-6 mt-6">
              {filteredGroupedIngredients.map(
                ({ categoryName, ingredients }) => (
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
                            <TableHead className="text-right">
                              kg/Jednotka
                            </TableHead>
                            <TableHead className="text-right">Cena</TableHead>
                            <TableHead>Balení</TableHead>
                            <TableHead className="text-right">DPH</TableHead>
                            <TableHead>Složení</TableHead>
                            <TableHead>Výživa</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Pouze prodejna</TableHead>
                            <TableHead className="text-right">Akce</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ingredients.map(renderIngredientRow)}
                          {/* Add fake empty row to help with border display */}
                          <TableRow className="h-0">
                            <TableCell
                              colSpan={11}
                              className="p-0 border-0"
                            ></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )
              )}

              {filteredGroupedIngredients.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nebyly nalezeny žádné ingredience odpovídající filtru.
                </div>
              )}
            </TabsContent>

            {/* All Ingredients Tab */}
            <TabsContent value="all" className="space-y-6 mt-6">
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
                      <TableHead>Složení</TableHead>
                      <TableHead>Výživa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pouze prodejna</TableHead>
                      <TableHead className="text-right">Akce</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAllIngredients.map(renderIngredientRow)}
                    {/* Add fake empty row to help with border display */}
                    <TableRow className="h-0">
                      <TableCell
                        colSpan={11}
                        className="p-0 border-0"
                      ></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {filteredAllIngredients.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nebyly nalezeny žádné ingredience odpovídající filtru.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </Card>

      {/* Ingredient Form Dialog */}
      <IngredientForm />
    </>
  );
}
