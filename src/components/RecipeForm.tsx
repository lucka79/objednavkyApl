import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useRecipes,
  Recipe,
  RecipeCategory,
  RecipeWithCategory,
} from "@/hooks/useRecipes";
import { useIngredients } from "@/hooks/useIngredients";
import { Save, X, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface RecipeFormProps {
  open: boolean;
  onClose: () => void;
  initialRecipe?: RecipeWithCategory | null;
}

interface RecipeFormIngredient {
  id: string;
  ingredient_id: number | null;
  quantity: number;
  dbId?: number; // To track database ID for existing ingredients
}

const initialFormData: Omit<Recipe, "id" | "created_at"> = {
  name: "",
  category_id: 0,
  price: 0,
  pricePerKilo: 0,
  quantity: 1,
  note: "",
  baking: "",
  dough: "",
  stir: "",
  water: "",
};

export function RecipeForm({ open, onClose, initialRecipe }: RecipeFormProps) {
  const {
    data,

    updateRecipe,
    fetchRecipeIngredients,
    saveRecipeIngredients,
  } = useRecipes();
  const { data: ingredientsData } = useIngredients();
  const categories = data?.categories || [];
  const ingredients = ingredientsData?.ingredients || [];
  const { toast } = useToast();
  const [formData, setFormData] =
    useState<Omit<Recipe, "id" | "created_at">>(initialFormData);
  const [recipeIngredients, setRecipeIngredients] = useState<
    RecipeFormIngredient[]
  >([]);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingIngredients, setLoadingIngredients] = useState(false);
  const isEditMode = Boolean(initialRecipe);

  useEffect(() => {
    if (open) {
      if (initialRecipe) {
        const { id, created_at, categories, ...rest } = initialRecipe;
        setFormData({ ...rest });
        // Fetch existing ingredients for the recipe
        loadRecipeIngredients(initialRecipe.id);
      } else {
        setFormData(initialFormData);
        setRecipeIngredients([]);
      }
    }
  }, [open, initialRecipe]);

  // Load recipe ingredients from database
  const loadRecipeIngredients = async (recipeId: number) => {
    setLoadingIngredients(true);
    try {
      const dbIngredients = await fetchRecipeIngredients(recipeId);
      const formIngredients: RecipeFormIngredient[] = dbIngredients.map(
        (ing, index) => ({
          id: `${ing.id}-${index}`,
          ingredient_id: ing.ingredient_id,
          quantity: ing.quantity,
          dbId: ing.id,
        })
      );
      setRecipeIngredients(formIngredients);
    } catch (error) {
      console.error("Failed to load recipe ingredients:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se načíst suroviny receptu",
        variant: "destructive",
      });
    } finally {
      setLoadingIngredients(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Ingredient management functions
  const addIngredient = () => {
    const newIngredient: RecipeFormIngredient = {
      id: Date.now().toString(),
      ingredient_id: null,
      quantity: 0,
    };
    setRecipeIngredients((prev) => [...prev, newIngredient]);
  };

  const removeIngredient = (id: string) => {
    setRecipeIngredients((prev) => prev.filter((ing) => ing.id !== id));
  };

  const updateIngredient = (
    id: string,
    field: keyof RecipeFormIngredient,
    value: any
  ) => {
    setRecipeIngredients((prev) =>
      prev.map((ing) => (ing.id === id ? { ...ing, [field]: value } : ing))
    );
  };

  // Calculate totals
  const calculateTotals = () => {
    let totalWeight = 0;
    let totalPrice = 0;

    recipeIngredients.forEach((recipeIng) => {
      if (recipeIng.ingredient_id && recipeIng.quantity > 0) {
        const ingredient = ingredients.find(
          (ing) => ing.id === recipeIng.ingredient_id
        );
        if (ingredient) {
          const weightInKg = recipeIng.quantity * ingredient.kiloPerUnit;
          totalWeight += weightInKg;

          if (ingredient.price) {
            totalPrice += recipeIng.quantity * ingredient.price;
          }
        }
      }
    });

    return { totalWeight, totalPrice };
  };

  const { totalWeight, totalPrice } = calculateTotals();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    console.log("Saving recipe", { isEditMode, formData, initialRecipe });
    try {
      let recipeId: number;

      if (isEditMode && initialRecipe) {
        await updateRecipe(initialRecipe.id, formData);
        recipeId = initialRecipe.id;
        toast({ title: "Úspěch", description: "Recept byl upraven." });
      } else {
        // For new recipes, we need to create the recipe first and get its ID
        const { data: newRecipe, error } = await supabase
          .from("recipes")
          .insert([formData])
          .select()
          .single();

        if (error) throw error;
        recipeId = newRecipe.id;
        toast({ title: "Úspěch", description: "Recept byl vytvořen." });
      }

      // Save recipe ingredients
      const ingredientsToSave = recipeIngredients
        .filter((ing) => ing.ingredient_id && ing.quantity > 0)
        .map((ing) => ({
          ingredient_id: ing.ingredient_id!,
          quantity: ing.quantity,
        }));

      await saveRecipeIngredients(recipeId, ingredientsToSave);

      onClose();
    } catch (error) {
      toast({
        title: "Chyba",
        description:
          error instanceof Error
            ? error.message
            : "Nepodařilo se uložit recept",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            {isEditMode ? "Upravit recept" : "Nový recept"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Základní informace</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Název *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Název receptu"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Kategorie *</Label>
                  <Select
                    value={
                      formData.category_id
                        ? formData.category_id.toString()
                        : ""
                    }
                    onValueChange={(value) =>
                      handleInputChange("category_id", parseInt(value))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte kategorii" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((category: RecipeCategory) => (
                        <SelectItem
                          key={category.id}
                          value={category.id.toString()}
                        >
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4"></div>
            </CardContent>
          </Card>

          {/* Ingredients Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                Suroviny
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addIngredient}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Přidat surovinu
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingIngredients ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">Načítání surovin...</p>
                </div>
              ) : recipeIngredients.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Zatím nejsou přidány žádné suroviny. Klikněte na "Přidat
                  surovinu" pro začátek.
                </p>
              ) : (
                <div className="space-y-3">
                  {recipeIngredients.map((recipeIng) => {
                    const selectedIngredient = ingredients.find(
                      (ing) => ing.id === recipeIng.ingredient_id
                    );
                    // const ingredientWeight =
                    //   selectedIngredient && recipeIng.quantity > 0
                    //     ? (
                    //         recipeIng.quantity * selectedIngredient.kiloPerUnit
                    //       ).toFixed(3)
                    //     : "0.000";
                    // const ingredientPrice =
                    //   selectedIngredient &&
                    //   selectedIngredient.price &&
                    //   recipeIng.quantity > 0
                    //     ? (
                    //         recipeIng.quantity * selectedIngredient.price
                    //       ).toFixed(2)
                    //     : "0.00";

                    return (
                      <div
                        key={recipeIng.id}
                        className="grid grid-cols-1 md:grid-cols-5 gap-3 p-3 border rounded-md"
                      >
                        <div className="md:col-span-2 flex items-center h-full">
                          <div className="font-medium">
                            {selectedIngredient ? (
                              <>
                                {selectedIngredient.name}
                                <span className="ml-4 text-sm text-muted-foreground">
                                  {selectedIngredient.price &&
                                  recipeIng.quantity > 0
                                    ? `${(recipeIng.quantity * selectedIngredient.price).toFixed(2)} Kč`
                                    : "0.00 Kč"}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">
                                (neznámá surovina)
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm">
                            Množství{" "}
                            {selectedIngredient
                              ? `(${selectedIngredient.unit})`
                              : ""}
                          </Label>
                          <Input
                            type="number"
                            step="0.001"
                            value={recipeIng.quantity}
                            onChange={(e) =>
                              updateIngredient(
                                recipeIng.id,
                                "quantity",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="mt-1"
                            placeholder="0"
                          />
                        </div>

                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeIngredient(recipeIng.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Calculation Summary */}
              {recipeIngredients.length > 0 && (
                <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-md">
                  <h4 className="font-semibold text-orange-800 mb-2">
                    Kalkulace receptu
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">
                        Celková hmotnost:
                      </span>
                      <div className="font-semibold">
                        {totalWeight.toFixed(3)} kg
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Celková cena surovin:
                      </span>
                      <div className="font-semibold">
                        {totalPrice.toFixed(2)} Kč
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cena za kg:</span>
                      <div className="font-semibold">
                        {totalWeight > 0
                          ? (totalPrice / totalWeight).toFixed(2)
                          : "0.00"}{" "}
                        Kč/kg
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          quantity: parseFloat(totalWeight.toFixed(3)),
                        }));
                      }}
                      disabled={totalWeight === 0}
                    >
                      Použít hmotnost ({totalWeight.toFixed(3)} kg)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          price: parseFloat(totalPrice.toFixed(2)),
                        }));
                      }}
                      disabled={totalPrice === 0}
                    >
                      Použít cenu ({totalPrice.toFixed(2)} Kč)
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Proces</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="baking">Pečení</Label>
                  <Input
                    id="baking"
                    value={formData.baking || ""}
                    onChange={(e) =>
                      handleInputChange("baking", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dough">Těsto</Label>
                  <Input
                    id="dough"
                    value={formData.dough || ""}
                    onChange={(e) => handleInputChange("dough", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stir">Míchání</Label>
                  <Input
                    id="stir"
                    value={formData.stir || ""}
                    onChange={(e) => handleInputChange("stir", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="water">Voda</Label>
                  <Input
                    id="water"
                    value={formData.water || ""}
                    onChange={(e) => handleInputChange("water", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">Poznámka</Label>
                  <Input
                    id="note"
                    value={formData.note || ""}
                    onChange={(e) => handleInputChange("note", e.target.value)}
                    placeholder="Poznámka k receptu"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-2" />
              Zrušit
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving
                ? "Ukládám..."
                : isEditMode
                  ? "Uložit změny"
                  : "Vytvořit"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
