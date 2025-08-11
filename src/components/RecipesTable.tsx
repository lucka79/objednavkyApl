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
import {
  RecipeWithCategoryAndIngredients,
  useRecipes,
} from "@/hooks/useRecipes";
import { Plus, Search, Scale, Edit, Trash2, ChefHat } from "lucide-react";
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
import { RecipeForm } from "@/components/RecipeForm";
import { removeDiacritics } from "@/utils/removeDiacritics";
import { detectAllergens } from "@/utils/allergenDetection";
import { useAuthStore } from "@/lib/supabase";

export function RecipesTable() {
  // Note: This table automatically refreshes when new recipes are created or updated
  // due to query invalidation in useCreateRecipe and useUpdateRecipe hooks
  const { data, isLoading, error } = useRecipes();
  const { toast } = useToast();
  const [globalFilter, setGlobalFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [recipeTypeFilter, setRecipeTypeFilter] = useState("all");
  const { user: authUser } = useAuthStore();

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  const recipes = data?.recipes || [];
  const categories = data?.categories || [];

  // Check if user can delete recipes
  const canDelete =
    authUser?.role === "admin" || authUser?.email === "l.batelkova@gmail.com";

  // Group recipes by category
  const groupedRecipes = useMemo(() => {
    if (!recipes) return [];

    const grouped = recipes.reduce(
      (acc, recipe) => {
        const categoryName = recipe.categories?.name || "Bez kategorie";
        if (!acc[categoryName]) {
          acc[categoryName] = [];
        }
        acc[categoryName].push(recipe);
        return acc;
      },
      {} as Record<string, typeof recipes>
    );

    // Sort categories and recipes within each category
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([categoryName, recipes]) => ({
        categoryName,
        recipes: recipes.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [recipes]);

  // Filter recipes based on search and category
  const filteredGroupedRecipes = useMemo(() => {
    return groupedRecipes
      .filter(
        ({ categoryName }) =>
          // If there's a search term, show all categories to allow global search
          // Otherwise, respect the category filter
          globalFilter.trim() !== "" ||
          categoryFilter === "all" ||
          categoryName === categoryFilter
      )
      .map(({ categoryName, recipes }) => ({
        categoryName,
        recipes: recipes.filter((recipe) => {
          const searchLower = removeDiacritics(globalFilter.toLowerCase());
          const nameMatch = removeDiacritics(
            recipe.name.toLowerCase()
          ).includes(searchLower);
          const noteMatch = recipe.note
            ? removeDiacritics(recipe.note.toLowerCase()).includes(searchLower)
            : false;

          // Recipe type filter
          const typeMatch =
            recipeTypeFilter === "all" ||
            (recipeTypeFilter === "baker" && recipe.baker) ||
            (recipeTypeFilter === "pastry" && recipe.pastry) ||
            (recipeTypeFilter === "donut" && recipe.donut) ||
            (recipeTypeFilter === "store" && recipe.store) ||
            (recipeTypeFilter === "test" && recipe.test);

          // If there's a search term, search globally but still apply recipe type filter
          if (globalFilter.trim() !== "") {
            return (nameMatch || noteMatch) && typeMatch;
          }

          // If no search term, apply both category and recipe type filters
          const categoryFilterMatch =
            categoryFilter === "all" ||
            (recipe.categories?.name || "Bez kategorie") === categoryFilter;

          return categoryFilterMatch && typeMatch;
        }),
      }))
      .filter(({ recipes }) => recipes.length > 0);
  }, [groupedRecipes, globalFilter, categoryFilter, recipeTypeFilter]);

  // Calculate totals
  //   const totalRecipes = recipes.length;
  const activeRecipes = recipes.length; // All recipes are considered active

  const handleDelete = async (recipe: (typeof recipes)[0]) => {
    try {
      // TODO: Implement delete functionality
      toast({
        title: "Úspěch",
        description: `Recept "${recipe.name}" byl smazán`,
      });
    } catch (error) {
      toast({
        title: "Chyba",
        description: "Nepodařilo se smazat recept",
        variant: "destructive",
      });
    }
  };

  const handleOpenCreate = () => {
    setSelectedRecipe(null);
    setIsFormOpen(true);
  };
  const handleOpenEdit = (recipe: any) => {
    setSelectedRecipe(recipe);
    setIsFormOpen(true);
  };
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedRecipe(null);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <div className="p-6">
            <div className="text-center">Načítání receptů...</div>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <div className="p-6">
            <div className="text-center text-red-600">
              Chyba při načítání receptů: {error.message}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Helper to aggregate unique allergens for a recipe
  const getRecipeAllergens = (recipe: RecipeWithCategoryAndIngredients) => {
    const allergenMap = new Map();
    if (recipe.recipe_ingredients) {
      recipe.recipe_ingredients.forEach((ri) => {
        if (ri.ingredient && ri.ingredient.element) {
          detectAllergens(ri.ingredient.element).forEach((a) => {
            if (!allergenMap.has(a.name)) allergenMap.set(a.name, a);
          });
        }
      });
    }
    return Array.from(allergenMap.values());
  };

  // Helper to get border color based on recipe type
  const getRecipeBorderColor = (recipe: RecipeWithCategoryAndIngredients) => {
    if (recipe.baker) return "border-l-blue-500";
    if (recipe.pastry) return "border-l-pink-500";
    if (recipe.donut) return "border-l-purple-500";
    if (recipe.store) return "border-l-green-500";
    if (recipe.test) return "border-l-yellow-500";
    return ""; // No border for recipes without flags
  };

  return (
    <>
      <Card>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold">Recepty</h2>
              <p className="text-muted-foreground">
                {activeRecipes} receptů celkem
              </p>
            </div>
            <Button
              className="bg-orange-600 hover:bg-orange-700"
              onClick={handleOpenCreate}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nový recept
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Hledat podle názvu nebo poznámky..."
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

          {/* Recipe Type Filters */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium text-muted-foreground self-center">
              Typ receptu:
            </span>
            <Button
              variant={recipeTypeFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setRecipeTypeFilter("all")}
              className={
                recipeTypeFilter === "all"
                  ? "bg-orange-600 hover:bg-orange-700"
                  : ""
              }
            >
              Všechny
            </Button>
            <Button
              variant={recipeTypeFilter === "baker" ? "default" : "outline"}
              size="sm"
              onClick={() => setRecipeTypeFilter("baker")}
              className={
                recipeTypeFilter === "baker"
                  ? "bg-blue-500 hover:bg-blue-600"
                  : "border-blue-500 text-blue-500 hover:bg-blue-50"
              }
            >
              Pekař
            </Button>
            <Button
              variant={recipeTypeFilter === "pastry" ? "default" : "outline"}
              size="sm"
              onClick={() => setRecipeTypeFilter("pastry")}
              className={
                recipeTypeFilter === "pastry"
                  ? "bg-pink-500 hover:bg-pink-600"
                  : "border-pink-500 text-pink-500 hover:bg-pink-50"
              }
            >
              Cukrář
            </Button>
            <Button
              variant={recipeTypeFilter === "donut" ? "default" : "outline"}
              size="sm"
              onClick={() => setRecipeTypeFilter("donut")}
              className={
                recipeTypeFilter === "donut"
                  ? "bg-purple-500 hover:bg-purple-600"
                  : "border-purple-500 text-purple-500 hover:bg-purple-50"
              }
            >
              Koblihy
            </Button>
            <Button
              variant={recipeTypeFilter === "store" ? "default" : "outline"}
              size="sm"
              onClick={() => setRecipeTypeFilter("store")}
              className={
                recipeTypeFilter === "store"
                  ? "bg-green-500 hover:bg-green-600"
                  : "border-green-500 text-green-500 hover:bg-green-50"
              }
            >
              Prodejna
            </Button>
            <Button
              variant={recipeTypeFilter === "test" ? "default" : "outline"}
              size="sm"
              onClick={() => setRecipeTypeFilter("test")}
              className={
                recipeTypeFilter === "test"
                  ? "bg-yellow-500 hover:bg-yellow-600"
                  : "border-yellow-500 text-yellow-500 hover:bg-yellow-50"
              }
            >
              Test
            </Button>
          </div>

          {/* Recipes by Category */}
          <div className="space-y-6">
            {filteredGroupedRecipes.map(({ categoryName, recipes }) => (
              <div key={categoryName} className="space-y-2">
                <div className="flex items-center gap-2">
                  <ChefHat className="h-4 w-4 text-orange-600" />
                  <h3 className="text-lg font-semibold text-orange-800">
                    {categoryName}
                  </h3>
                  <Badge variant="outline" className="text-xs">
                    {recipes.length} receptů
                  </Badge>
                </div>

                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Název</TableHead>
                        <TableHead className="text-right">Množství</TableHead>
                        <TableHead className="text-right">Cena</TableHead>
                        <TableHead className="text-right">Cena/kg</TableHead>
                        <TableHead>Alergeny</TableHead>
                        <TableHead>Poznámka</TableHead>
                        <TableHead className="text-center">Test</TableHead>
                        <TableHead className="text-right">Akce</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recipes.map((recipe) => {
                        const borderColor = getRecipeBorderColor(recipe);
                        const hasColorFlag =
                          recipe.baker ||
                          recipe.pastry ||
                          recipe.donut ||
                          recipe.store ||
                          recipe.test;
                        return (
                          <TableRow
                            key={recipe.id}
                            onClick={() => handleOpenEdit(recipe)}
                            className={`cursor-pointer hover:bg-orange-50 transition-colors ${hasColorFlag ? "border-l-4" : ""} ${borderColor}`}
                            style={{ userSelect: "none" }}
                          >
                            <TableCell className="font-medium">
                              {recipe.name}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center gap-1 justify-end">
                                <Scale className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">
                                  {recipe.quantity.toFixed(2)} kg
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-sm">
                                {recipe.price.toFixed(2)} Kč
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-sm">
                                {recipe.pricePerKilo.toFixed(2)} Kč/kg
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {getRecipeAllergens(recipe).length > 0 ? (
                                  getRecipeAllergens(recipe)
                                    .slice(0, 3)
                                    .map((allergen, idx) => {
                                      const IconComponent = allergen.icon;
                                      return (
                                        <span
                                          key={idx}
                                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${allergen.color}`}
                                        >
                                          <IconComponent className="h-3 w-3" />
                                          {allergen.name}
                                        </span>
                                      );
                                    })
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    Bez alergenů
                                  </span>
                                )}
                                {getRecipeAllergens(recipe).length > 3 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{getRecipeAllergens(recipe).length - 3}{" "}
                                    další
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {recipe.note || "—"}
                              </span>
                            </TableCell>

                            <TableCell className="text-center">
                              {recipe.test ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 bg-yellow-100 text-yellow-600 rounded-full text-xs font-semibold">
                                  ✓
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>

                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEdit(recipe);
                                  }}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                {canDelete && (
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
                                        <AlertDialogTitle>
                                          Smazat recept
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Opravdu chcete smazat recept "
                                          {recipe.name}"? Tato akce je nevratná.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>
                                          Zrušit
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDelete(recipe)}
                                          className="bg-red-600 hover:bg-red-700"
                                        >
                                          Smazat
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Add fake empty row to help with border display */}
                      <TableRow className="h-0">
                        <TableCell
                          colSpan={7}
                          className="p-0 border-0"
                        ></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>

          {filteredGroupedRecipes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nebyly nalezeny žádné recepty odpovídající filtru.
            </div>
          )}
        </div>
      </Card>
      {/* Recipe Form Dialog */}
      <RecipeForm
        open={isFormOpen}
        onClose={handleCloseForm}
        initialRecipe={selectedRecipe}
      />
    </>
  );
}
