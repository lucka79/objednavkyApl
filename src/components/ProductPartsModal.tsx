import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  Trash2,
  Save,
  Package,
  List,
  Copy,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useRecipes } from "@/hooks/useRecipes";
import { useIngredients } from "@/hooks/useIngredients";
import { fetchAllProducts } from "@/hooks/useProducts";
import { useQueryClient } from "@tanstack/react-query";
import { detectAllergens } from "@/utils/allergenDetection";

interface ProductPart {
  id?: number;
  product_id: number;
  recipe_id?: number | null;
  pastry_id?: number | null;
  ingredient_id?: number | null;
  quantity: number;
  productOnly?: boolean | null;
}

interface ProductPartsModalProps {
  open: boolean;
  onClose: () => void;
  productId: number;
  productName: string;
}

export function ProductPartsModal({
  open,
  onClose,
  productId,
  productName,
}: ProductPartsModalProps) {
  const [productParts, setProductParts] = useState<ProductPart[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch data for dropdowns
  const { data: recipesData } = useRecipes();
  const { data: ingredientsData } = useIngredients();
  const { data: productsData } = fetchAllProducts();

  const recipes = recipesData?.recipes || [];
  const ingredients = ingredientsData?.ingredients || [];
  const products = productsData || [];

  // Load existing product parts
  useEffect(() => {
    if (open && productId) {
      loadProductParts();
    }
  }, [open, productId]);

  const loadProductParts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("product_parts")
        .select(
          `
          *,
          recipes(name),
          ingredients(name, unit),
          pastry:products!product_parts_pastry_id_fkey(name)
        `
        )
        .eq("product_id", productId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setProductParts(data || []);
    } catch (error) {
      console.error("Error loading product parts:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se načíst části produktu",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addNewPart = () => {
    const newPart: ProductPart = {
      product_id: productId,
      recipe_id: null,
      pastry_id: null,
      ingredient_id: null,
      quantity: 1,
      productOnly: false,
    };
    setProductParts([...productParts, newPart]);
  };

  const updatePart = (index: number, field: keyof ProductPart, value: any) => {
    const updatedParts = [...productParts];
    updatedParts[index] = { ...updatedParts[index], [field]: value };

    // Clear other IDs when one is selected
    if (field === "recipe_id" && value) {
      updatedParts[index].pastry_id = null;
      updatedParts[index].ingredient_id = null;
    } else if (field === "pastry_id" && value) {
      updatedParts[index].recipe_id = null;
      updatedParts[index].ingredient_id = null;
    } else if (field === "ingredient_id" && value) {
      updatedParts[index].recipe_id = null;
      updatedParts[index].pastry_id = null;
    }

    setProductParts(updatedParts);
  };

  const removePart = async (index: number) => {
    const part = productParts[index];

    // If it has an ID, delete from database
    if (part.id) {
      try {
        const { error } = await supabase
          .from("product_parts")
          .delete()
          .eq("id", part.id);

        if (error) throw error;

        toast({
          title: "Úspěch",
          description: "Část produktu byla smazána",
        });

        // Invalidate product parts count query
        queryClient.invalidateQueries({ queryKey: ["productPartsCount"] });
      } catch (error) {
        console.error("Error deleting product part:", error);
        toast({
          title: "Chyba",
          description: "Nepodařilo se smazat část produktu",
          variant: "destructive",
        });
        return;
      }
    }

    // Remove from local state
    const updatedParts = productParts.filter((_, i) => i !== index);
    setProductParts(updatedParts);
  };

  const saveProductParts = async () => {
    setIsSaving(true);
    try {
      // Validate parts
      const validParts = productParts.filter(
        (part) =>
          part.quantity > 0 &&
          (part.recipe_id || part.pastry_id || part.ingredient_id)
      );

      // Delete existing parts
      await supabase.from("product_parts").delete().eq("product_id", productId);

      // Insert new parts
      if (validParts.length > 0) {
        const partsToInsert = validParts.map((part) => ({
          product_id: part.product_id,
          recipe_id: part.recipe_id,
          pastry_id: part.pastry_id,
          ingredient_id: part.ingredient_id,
          quantity: part.quantity,
          productOnly: part.productOnly || false,
        }));

        const { error } = await supabase
          .from("product_parts")
          .insert(partsToInsert);

        if (error) throw error;
      }

      toast({
        title: "Úspěch",
        description: "Části produktu byly uloženy",
      });

      // Invalidate product parts count query
      queryClient.invalidateQueries({ queryKey: ["productPartsCount"] });

      await loadProductParts(); // Reload to get IDs
    } catch (error) {
      console.error("Error saving product parts:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se uložit části produktu",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getPartUnit = (part: ProductPart) => {
    if (part.ingredient_id) {
      const ingredient = ingredients.find((i) => i.id === part.ingredient_id);
      return ingredient?.unit || "kg";
    }
    if (part.recipe_id) {
      return "kg";
    }
    if (part.pastry_id) {
      return "ks";
    }
    return "ks";
  };

  const getPartPrice = (part: ProductPart) => {
    if (part.ingredient_id) {
      const ingredient = ingredients.find((i) => i.id === part.ingredient_id);
      if (ingredient?.price) {
        // Convert quantity to kg using kiloPerUnit, then multiply by price per kg
        const weightInKg = part.quantity * ingredient.kiloPerUnit;
        return weightInKg * ingredient.price;
      }
      return 0;
    }
    if (part.recipe_id) {
      const recipe = recipes.find((r) => r.id === part.recipe_id);
      if (recipe && recipe.recipe_ingredients) {
        // Calculate the total weight of the recipe
        let recipeWeightKg = 0;
        recipe.recipe_ingredients.forEach((recipeIng: any) => {
          if (recipeIng.ingredient) {
            const ingredient = recipeIng.ingredient;
            const weightInKg = recipeIng.quantity * ingredient.kiloPerUnit;
            recipeWeightKg += weightInKg;
          }
        });

        // Calculate price per kg of the recipe
        const recipePricePerKg =
          recipeWeightKg > 0 ? recipe.price / recipeWeightKg : 0;

        // Calculate price for the actual quantity being used
        return recipePricePerKg * part.quantity;
      }
      return 0;
    }
    if (part.pastry_id) {
      const product = products.find((p) => p.id === part.pastry_id);
      return product?.price ? product.price * part.quantity : 0;
    }
    return 0;
  };

  const getTotalPrice = () => {
    return productParts.reduce((total, part) => {
      // Skip parts marked as productOnly
      if (part.productOnly) {
        return total;
      }
      return total + getPartPrice(part);
    }, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Části produktu: {productName}
          </DialogTitle>
        </DialogHeader>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Sestavení produktu</CardTitle>
              <Button
                onClick={addNewPart}
                size="sm"
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Přidat část
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4">Načítání...</div>
            ) : productParts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Zatím nejsou definovány žádné části produktu.
                <br />
                Klikněte na "Přidat část" pro začátek.
              </div>
            ) : (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Typ</TableHead>
                      <TableHead>Název</TableHead>
                      <TableHead className="text-right">Množství</TableHead>
                      <TableHead>Jednotka</TableHead>
                      <TableHead className="text-right">Cena</TableHead>
                      <TableHead>Produkt prodejny</TableHead>
                      <TableHead className="text-right">Akce</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productParts.map((part, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Select
                            value={
                              part.recipe_id
                                ? "recipe"
                                : part.pastry_id
                                  ? "product"
                                  : part.ingredient_id
                                    ? "ingredient"
                                    : ""
                            }
                            onValueChange={(value) => {
                              if (value === "recipe") {
                                updatePart(
                                  index,
                                  "recipe_id",
                                  recipes[0]?.id || null
                                );
                              } else if (value === "product") {
                                updatePart(
                                  index,
                                  "pastry_id",
                                  products[0]?.id || null
                                );
                              } else if (value === "ingredient") {
                                updatePart(
                                  index,
                                  "ingredient_id",
                                  ingredients[0]?.id || null
                                );
                              }
                            }}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Vyberte typ" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="recipe">Recept</SelectItem>
                              <SelectItem value="product">Produkt</SelectItem>
                              <SelectItem value="ingredient">
                                Surovina
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {part.recipe_id && (
                            <Select
                              value={part.recipe_id.toString()}
                              onValueChange={(value) =>
                                updatePart(index, "recipe_id", parseInt(value))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Vyberte recept" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {recipes.map((recipe) => (
                                  <SelectItem
                                    key={recipe.id}
                                    value={recipe.id.toString()}
                                  >
                                    {recipe.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {part.pastry_id && (
                            <Select
                              value={part.pastry_id.toString()}
                              onValueChange={(value) =>
                                updatePart(index, "pastry_id", parseInt(value))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Vyberte produkt" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {products.map((product) => (
                                  <SelectItem
                                    key={product.id}
                                    value={product.id.toString()}
                                  >
                                    {product.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {part.ingredient_id && (
                            <Select
                              value={part.ingredient_id.toString()}
                              onValueChange={(value) =>
                                updatePart(
                                  index,
                                  "ingredient_id",
                                  parseInt(value)
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Vyberte surovinu" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {ingredients.map((ingredient) => (
                                  <SelectItem
                                    key={ingredient.id}
                                    value={ingredient.id.toString()}
                                  >
                                    {ingredient.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {!part.recipe_id &&
                            !part.pastry_id &&
                            !part.ingredient_id && (
                              <span className="text-muted-foreground">
                                Vyberte typ a položku
                              </span>
                            )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            value={part.quantity}
                            onChange={(e) =>
                              updatePart(
                                index,
                                "quantity",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-24 text-right no-spinner"
                          />
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {getPartUnit(part)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm text-muted-foreground">
                            {getPartPrice(part).toFixed(2)} Kč
                          </span>
                        </TableCell>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={part.productOnly || false}
                            onChange={(e) =>
                              updatePart(index, "productOnly", e.target.checked)
                            }
                            className="rounded"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removePart(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Total Price Summary */}
                <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-md">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-orange-800">
                      Celková cena částí produktu:
                    </span>
                    <span className="text-lg font-bold text-orange-900">
                      {getTotalPrice().toFixed(2)} Kč
                    </span>
                  </div>
                  {productParts.length > 0 && (
                    <div className="text-xs text-orange-700 mt-1">
                      Počet částí: {productParts.length}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ingredients Elements Summary Section */}
        {productParts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <List className="h-5 w-5" />
                Složení všech surovin produktu
              </CardTitle>
            </CardHeader>
            <CardContent className="bg-blue-50/50 rounded-lg p-4 border border-blue-100">
              {(() => {
                // Collect all ingredients with elements from all parts (excluding productOnly parts)
                const ingredientsWithElements: Array<{
                  ingredient: any;
                  quantity: number;
                }> = [];

                productParts.forEach((part) => {
                  // Skip parts marked as productOnly
                  if (part.productOnly) return;

                  // Handle direct ingredients
                  if (part.ingredient_id) {
                    const ingredient = ingredients.find(
                      (i) => i.id === part.ingredient_id
                    );
                    if (
                      ingredient &&
                      ingredient.element &&
                      ingredient.element.trim() !== ""
                    ) {
                      ingredientsWithElements.push({
                        ingredient,
                        quantity: part.quantity,
                      });
                    }
                  }

                  // Handle ingredients from recipes
                  if (part.recipe_id) {
                    const recipe = recipes.find((r) => r.id === part.recipe_id);
                    if (recipe && recipe.recipe_ingredients) {
                      recipe.recipe_ingredients.forEach((recipeIng: any) => {
                        if (
                          recipeIng.ingredient &&
                          recipeIng.ingredient.element &&
                          recipeIng.ingredient.element.trim() !== ""
                        ) {
                          const usedQuantity =
                            recipeIng.quantity * part.quantity;
                          ingredientsWithElements.push({
                            ingredient: recipeIng.ingredient,
                            quantity: usedQuantity,
                          });
                        }
                      });
                    }
                  }
                });

                // Sort by quantity (descending) and merge elements
                const sortedIngredients = ingredientsWithElements.sort(
                  (a, b) => b.quantity - a.quantity
                );

                if (sortedIngredients.length === 0) {
                  return (
                    <p className="text-muted-foreground text-center py-4">
                      Žádná ze surovin nemá definované složení.
                    </p>
                  );
                }

                // Merge all elements into a single text
                const mergedElements = sortedIngredients
                  .map(({ ingredient }) => ingredient.element.trim())
                  .join(", ");

                const allergens = detectAllergens(mergedElements);

                return (
                  <div className="bg-white/80 rounded border border-blue-200 p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="text-sm text-gray-700 leading-relaxed flex-1">
                        {mergedElements}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(mergedElements);
                          toast({
                            title: "Zkopírováno",
                            description: "Složení bylo zkopírováno do schránky",
                          });
                        }}
                        className="flex-shrink-0"
                        title="Kopírovat složení"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-xs text-blue-600 mt-2">
                      Složení z {sortedIngredients.length} surovin (seřazeno
                      podle množství)
                    </div>
                    {allergens.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-semibold text-red-800 mb-2 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Detekované alergeny:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {allergens.map((allergen, index) => {
                            const IconComponent = allergen.icon;
                            return (
                              <span
                                key={index}
                                className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${allergen.color}`}
                              >
                                <IconComponent className="h-3 w-3" />
                                {allergen.name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Product Energy Calculation Section */}
        {productParts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-green-600" />
                Energetické údaje produktu
              </CardTitle>
            </CardHeader>
            <CardContent className="bg-green-50/50 rounded-lg p-4 border border-green-100">
              {(() => {
                let totalKJ = 0;
                let totalKcal = 0;
                let totalWeightKg = 0;
                let totalFat = 0;
                let totalSaturates = 0;
                let totalCarbohydrate = 0;
                let totalSugars = 0;
                let totalProtein = 0;
                let totalFibre = 0;
                let totalSalt = 0;
                let partsCount = 0;

                // Calculate nutritional values from all parts (excluding productOnly)
                productParts.forEach((part) => {
                  if (part.productOnly) return; // Skip productOnly parts

                  partsCount++;

                  // Handle recipe parts
                  if (part.recipe_id) {
                    const recipe = recipes.find((r) => r.id === part.recipe_id);
                    if (recipe && recipe.recipe_ingredients) {
                      // Calculate total weight and nutritional values for the full recipe
                      let recipeWeightKg = 0;
                      let recipeKJ = 0;
                      let recipeKcal = 0;
                      let recipeFat = 0;
                      let recipeSaturates = 0;
                      let recipeCarbohydrate = 0;
                      let recipeSugars = 0;
                      let recipeProtein = 0;
                      let recipeFibre = 0;
                      let recipeSalt = 0;

                      recipe.recipe_ingredients.forEach((recipeIng: any) => {
                        if (recipeIng.ingredient) {
                          const ingredient = recipeIng.ingredient;
                          // Properly convert ingredient quantity to kg using kiloPerUnit
                          const weightInKg =
                            recipeIng.quantity * ingredient.kiloPerUnit;
                          recipeWeightKg += weightInKg;

                          // Calculate nutritional values per 100g basis
                          const factor = weightInKg * 10; // Convert kg to 100g units
                          recipeKJ += ingredient.kJ * factor;
                          recipeKcal += ingredient.kcal * factor;
                          recipeFat += ingredient.fat * factor;
                          recipeSaturates += ingredient.saturates * factor;
                          recipeCarbohydrate +=
                            ingredient.carbohydrate * factor;
                          recipeSugars += ingredient.sugars * factor;
                          recipeProtein += ingredient.protein * factor;
                          recipeFibre += ingredient.fibre * factor;
                          recipeSalt += ingredient.salt * factor;
                        }
                      });

                      // For recipe parts, part.quantity represents the actual weight in kg being used
                      // Calculate proportional nutritional values based on the portion being used
                      if (recipeWeightKg > 0) {
                        const proportion = part.quantity / recipeWeightKg;

                        totalWeightKg += part.quantity; // Use actual weight, not multiplied
                        totalKJ += recipeKJ * proportion;
                        totalKcal += recipeKcal * proportion;
                        totalFat += recipeFat * proportion;
                        totalSaturates += recipeSaturates * proportion;
                        totalCarbohydrate += recipeCarbohydrate * proportion;
                        totalSugars += recipeSugars * proportion;
                        totalProtein += recipeProtein * proportion;
                        totalFibre += recipeFibre * proportion;
                        totalSalt += recipeSalt * proportion;
                      }
                    }
                  }

                  // Handle ingredient parts
                  if (part.ingredient_id) {
                    const ingredient = ingredients.find(
                      (i) => i.id === part.ingredient_id
                    );
                    if (ingredient) {
                      const weightInKg = part.quantity * ingredient.kiloPerUnit;
                      totalWeightKg += weightInKg;

                      // Calculate nutritional values per 100g basis
                      const factor = weightInKg * 10; // Convert kg to 100g units
                      totalKJ += ingredient.kJ * factor;
                      totalKcal += ingredient.kcal * factor;
                      totalFat += ingredient.fat * factor;
                      totalSaturates += ingredient.saturates * factor;
                      totalCarbohydrate += ingredient.carbohydrate * factor;
                      totalSugars += ingredient.sugars * factor;
                      totalProtein += ingredient.protein * factor;
                      totalFibre += ingredient.fibre * factor;
                      totalSalt += ingredient.salt * factor;
                    }
                  }

                  // Handle pastry/product parts (weight only, no nutritional data typically)
                  if (part.pastry_id) {
                    const product = products.find(
                      (p) => p.id === part.pastry_id
                    );
                    if (product) {
                      // Use the actual quantity from the part setup (in kg units for recipes/ingredients)
                      // For pastry products, the quantity represents the actual amount used
                      totalWeightKg += part.quantity;

                      // If products had nutritional data, we would calculate it here similar to ingredients
                      // For now, pastry products only contribute to weight
                    }
                  }
                });

                if (partsCount === 0) {
                  return (
                    <p className="text-muted-foreground text-center py-4">
                      Žádné části produktu pro výpočet výživových hodnot.
                    </p>
                  );
                }

                // Calculate per 100g values
                const energyPer100gKJ =
                  totalWeightKg > 0 ? (totalKJ / totalWeightKg) * 0.1 : 0;
                const energyPer100gKcal =
                  totalWeightKg > 0 ? (totalKcal / totalWeightKg) * 0.1 : 0;
                const fatPer100g =
                  totalWeightKg > 0 ? (totalFat / totalWeightKg) * 0.1 : 0;
                const saturatesPer100g =
                  totalWeightKg > 0
                    ? (totalSaturates / totalWeightKg) * 0.1
                    : 0;
                const carbohydratePer100g =
                  totalWeightKg > 0
                    ? (totalCarbohydrate / totalWeightKg) * 0.1
                    : 0;
                const sugarsPer100g =
                  totalWeightKg > 0 ? (totalSugars / totalWeightKg) * 0.1 : 0;
                const proteinPer100g =
                  totalWeightKg > 0 ? (totalProtein / totalWeightKg) * 0.1 : 0;
                const fibrePer100g =
                  totalWeightKg > 0 ? (totalFibre / totalWeightKg) * 0.1 : 0;
                const saltPer100g =
                  totalWeightKg > 0 ? (totalSalt / totalWeightKg) * 0.1 : 0;

                return (
                  <div className="bg-white/80 rounded border border-green-200 p-4">
                    <div className="space-y-4">
                      {/* Basic Info */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">
                            Celková hmotnost:
                          </span>
                          <div className="font-semibold text-green-800">
                            {totalWeightKg.toFixed(3)} kg
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Celková energie:
                          </span>
                          <div className="font-semibold text-green-800">
                            {totalKJ.toFixed(0)} KJ / {totalKcal.toFixed(0)}{" "}
                            Kcal
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Energie na 100g:
                          </span>
                          <div className="font-semibold text-green-800">
                            {energyPer100gKJ.toFixed(0)} KJ /{" "}
                            {energyPer100gKcal.toFixed(0)} Kcal
                          </div>
                        </div>
                      </div>

                      {/* Nutritional Values per 100g */}
                      <div className="border-t pt-3">
                        <h4 className="font-semibold text-green-800 mb-2 text-sm">
                          Výživové hodnoty na 100g:
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                          {(() => {
                            // Adult Reference Intake (RI) values per day
                            const referenceIntakes = {
                              energy: 2000, // kcal
                              fat: 70, // g
                              saturates: 20, // g
                              carbohydrate: 260, // g
                              sugars: 90, // g
                              protein: 50, // g
                              salt: 6, // g
                            };

                            // Traffic light thresholds per 100g (UK standards)
                            const getTrafficLightColor = (
                              nutrient: string,
                              value: number
                            ) => {
                              const thresholds = {
                                fat: { high: 17.5, medium: 3.0 },
                                saturates: { high: 5.0, medium: 1.5 },
                                carbohydrate: { high: 22.5, medium: 5.0 }, // Total carbs
                                sugars: { high: 22.5, medium: 5.0 },
                                salt: { high: 1.5, medium: 0.3 },
                                // For beneficial nutrients (higher = better)
                                protein: { high: 12.0, medium: 6.0 }, // High protein is good
                                fibre: { high: 6.0, medium: 3.0 }, // High fibre is good
                              };

                              const threshold =
                                thresholds[nutrient as keyof typeof thresholds];
                              if (!threshold)
                                return "bg-gray-100 text-gray-800";

                              // For harmful nutrients (fat, saturates, sugars, salt): red = high, green = low
                              if (
                                [
                                  "fat",
                                  "saturates",
                                  "carbohydrate",
                                  "sugars",
                                  "salt",
                                ].includes(nutrient)
                              ) {
                                if (value >= threshold.high)
                                  return "bg-red-500 text-white";
                                if (value >= threshold.medium)
                                  return "bg-amber-500 text-white";
                                return "bg-green-500 text-white";
                              }

                              // For beneficial nutrients (protein, fibre): green = high, red = low
                              if (["protein", "fibre"].includes(nutrient)) {
                                if (value >= threshold.high)
                                  return "bg-green-500 text-white";
                                if (value >= threshold.medium)
                                  return "bg-amber-500 text-white";
                                return "bg-gray-300 text-gray-700";
                              }

                              return "bg-gray-100 text-gray-800";
                            };

                            // Calculate RI percentages
                            const getRIPercentage = (
                              nutrient: string,
                              value: number
                            ) => {
                              const ri =
                                referenceIntakes[
                                  nutrient as keyof typeof referenceIntakes
                                ];
                              if (!ri) return 0;
                              return Math.round((value / ri) * 100);
                            };

                            return (
                              <>
                                {/* Energy */}
                                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium text-blue-800">
                                      Energie
                                    </span>
                                    <span className="text-xs text-blue-600">
                                      {getRIPercentage(
                                        "energy",
                                        energyPer100gKcal
                                      )}
                                      % RI*
                                    </span>
                                  </div>
                                  <div className="font-bold text-blue-900">
                                    {energyPer100gKcal.toFixed(0)} kcal
                                  </div>
                                  <div className="text-xs text-blue-700">
                                    {energyPer100gKJ.toFixed(0)} kJ
                                  </div>
                                </div>

                                {/* Fat */}
                                <div
                                  className={`p-3 rounded-lg ${getTrafficLightColor("fat", fatPer100g)}`}
                                >
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium">Tuky</span>
                                    <span className="text-xs opacity-90">
                                      {getRIPercentage("fat", fatPer100g)}% RI*
                                    </span>
                                  </div>
                                  <div className="font-bold">
                                    {fatPer100g.toFixed(1)}g
                                  </div>
                                </div>

                                {/* Saturated Fat */}
                                <div
                                  className={`p-3 rounded-lg ${getTrafficLightColor("saturates", saturatesPer100g)}`}
                                >
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium">
                                      Nasycené
                                    </span>
                                    <span className="text-xs opacity-90">
                                      {getRIPercentage(
                                        "saturates",
                                        saturatesPer100g
                                      )}
                                      % RI*
                                    </span>
                                  </div>
                                  <div className="font-bold">
                                    {saturatesPer100g.toFixed(1)}g
                                  </div>
                                </div>

                                {/* Carbohydrates */}
                                <div
                                  className={`p-3 rounded-lg ${getTrafficLightColor("carbohydrate", carbohydratePer100g)}`}
                                >
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium">
                                      Sacharidy
                                    </span>
                                    <span className="text-xs opacity-90">
                                      {getRIPercentage(
                                        "carbohydrate",
                                        carbohydratePer100g
                                      )}
                                      % RI*
                                    </span>
                                  </div>
                                  <div className="font-bold">
                                    {carbohydratePer100g.toFixed(1)}g
                                  </div>
                                </div>

                                {/* Sugars */}
                                <div
                                  className={`p-3 rounded-lg ${getTrafficLightColor("sugars", sugarsPer100g)}`}
                                >
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium">
                                      Z toho cukry
                                    </span>
                                    <span className="text-xs opacity-90">
                                      {getRIPercentage("sugars", sugarsPer100g)}
                                      % RI*
                                    </span>
                                  </div>
                                  <div className="font-bold">
                                    {sugarsPer100g.toFixed(1)}g
                                  </div>
                                </div>

                                {/* Protein */}
                                <div
                                  className={`p-3 rounded-lg ${getTrafficLightColor("protein", proteinPer100g)}`}
                                >
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium">
                                      Bílkoviny
                                    </span>
                                    <span className="text-xs opacity-90">
                                      {getRIPercentage(
                                        "protein",
                                        proteinPer100g
                                      )}
                                      % RI*
                                    </span>
                                  </div>
                                  <div className="font-bold">
                                    {proteinPer100g.toFixed(1)}g
                                  </div>
                                </div>

                                {/* Fibre */}
                                <div
                                  className={`p-3 rounded-lg ${getTrafficLightColor("fibre", fibrePer100g)}`}
                                >
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium">
                                      Vláknina
                                    </span>
                                    <span className="text-xs opacity-90">
                                      -
                                    </span>
                                  </div>
                                  <div className="font-bold">
                                    {fibrePer100g.toFixed(1)}g
                                  </div>
                                </div>

                                {/* Salt */}
                                <div
                                  className={`p-3 rounded-lg ${getTrafficLightColor("salt", saltPer100g)}`}
                                >
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium">Sůl</span>
                                    <span className="text-xs opacity-90">
                                      {getRIPercentage("salt", saltPer100g)}%
                                      RI*
                                    </span>
                                  </div>
                                  <div className="font-bold">
                                    {saltPer100g.toFixed(1)}g
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>

                        {/* Reference Intake Footer */}
                        <div className="mt-3 pt-2 border-t border-green-200">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-xs text-green-600">
                              *RI = Referenční příjem průměrného dospělého (8400
                              kJ/2000 kcal)
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const nutritionalText = `VÝŽIVOVÉ ÚDAJE NA 100g:

Energie: ${energyPer100gKcal.toFixed(0)} kcal (${energyPer100gKJ.toFixed(0)} kJ) - ${Math.round((energyPer100gKcal / 2000) * 100)}% RI*
Tuky: ${fatPer100g.toFixed(1)}g - ${Math.round((fatPer100g / 70) * 100)}% RI*
  z toho nasycené mastné kyseliny: ${saturatesPer100g.toFixed(1)}g - ${Math.round((saturatesPer100g / 20) * 100)}% RI*
Sacharidy: ${carbohydratePer100g.toFixed(1)}g - ${Math.round((carbohydratePer100g / 260) * 100)}% RI*
  z toho cukry: ${sugarsPer100g.toFixed(1)}g - ${Math.round((sugarsPer100g / 90) * 100)}% RI*
Bílkoviny: ${proteinPer100g.toFixed(1)}g - ${Math.round((proteinPer100g / 50) * 100)}% RI*
Vláknina: ${fibrePer100g.toFixed(1)}g
Sůl: ${saltPer100g.toFixed(1)}g - ${Math.round((saltPer100g / 6) * 100)}% RI*

*RI = Referenční příjem průměrného dospělého (8400 kJ/2000 kcal)
Celková hmotnost produktu: ${totalWeightKg.toFixed(3)} kg`;

                                navigator.clipboard.writeText(nutritionalText);
                                toast({
                                  title: "Zkopírováno",
                                  description:
                                    "Výživové údaje byly zkopírovány do schránky",
                                });
                              }}
                              className="flex-shrink-0"
                              title="Kopírovat výživové údaje"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs">
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 bg-green-500 rounded"></div>
                              <span className="text-gray-600">Nízké</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 bg-amber-500 rounded"></div>
                              <span className="text-gray-600">Střední</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 bg-red-500 rounded"></div>
                              <span className="text-gray-600">Vysoké</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-green-600 mt-3 pt-2 border-t">
                      Vypočítáno z {partsCount} částí produktu (bez produktů
                      prodejny)
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Zrušit
          </Button>
          <Button
            onClick={saveProductParts}
            disabled={isSaving}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Ukládám..." : "Uložit změny"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
