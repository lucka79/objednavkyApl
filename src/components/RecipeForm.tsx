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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useRecipes,
  useCreateRecipe,
  useUpdateRecipe,
  Recipe,
  RecipeCategory,
  RecipeWithCategoryAndIngredients,
} from "@/hooks/useRecipes";
import { Ingredient, useIngredients } from "@/hooks/useIngredients";
import {
  Save,
  X,
  Plus,
  Trash2,
  FileText,
  Copy,
  Package,
  Printer,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { detectAllergens } from "@/utils/allergenDetection";
import { removeDiacritics } from "@/utils/removeDiacritics";
import { supabase, useAuthStore } from "@/lib/supabase";
import { Product } from "types";

interface RecipeFormProps {
  open: boolean;
  onClose: () => void;
  initialRecipe?: RecipeWithCategoryAndIngredients | null;
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
  baker: false,
  pastry: false,
  donut: false,
  store: false,
  test: true,
};

function IngredientPickerModal({
  open,
  onClose,
  onPick,
  ingredients,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (ingredientId: number, quantity: number) => void;
  ingredients: Ingredient[];
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = ingredients.filter((ing) =>
    removeDiacritics(ing.name)
      .toLowerCase()
      .includes(removeDiacritics(search).toLowerCase())
  );

  // Debug: Check for duplicate ingredient IDs in filtered list
  if (open && filtered.length > 0) {
    const filteredIds = filtered.map((ing) => ing.id);
    const duplicateFilteredIds = filteredIds.filter(
      (id, index) => filteredIds.indexOf(id) !== index
    );
    if (duplicateFilteredIds.length > 0) {
      console.warn(
        "⚠️ Duplicate ingredient IDs in picker:",
        duplicateFilteredIds
      );
      console.log("Filtered ingredients:", filtered);
    }
  }

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedId(null);
      setQuantity(1);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Přidat surovinu</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            ref={inputRef}
            placeholder="Hledat surovinu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-60 overflow-y-auto border rounded">
            {filtered.length === 0 ? (
              <div className="p-4 text-muted-foreground text-center">
                Nenalezeno
              </div>
            ) : (
              <ul>
                {filtered.map((ing) => (
                  <li
                    key={ing.id}
                    className={`px-3 py-2 cursor-pointer hover:bg-orange-50 rounded flex items-center gap-2 ${selectedId === ing.id ? "bg-orange-100" : ""}`}
                    onClick={() => setSelectedId(ing.id)}
                  >
                    <span className="font-medium">{ing.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {ing.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0.001}
              step={0.001}
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
              onFocus={(e) => e.target.select()}
              className="w-24 no-spinner"
              placeholder="Množství"
              inputMode="decimal"
              disabled={!selectedId}
            />
            <Button
              type="button"
              onClick={() => {
                if (selectedId && quantity > 0) {
                  onPick(selectedId, quantity);
                  onClose();
                }
              }}
              disabled={!selectedId || quantity <= 0}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Přidat
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Zrušit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RecipeForm({ open, onClose, initialRecipe }: RecipeFormProps) {
  const {
    data,

    fetchRecipeIngredients,
    saveRecipeIngredients,
  } = useRecipes();
  const { data: ingredientsData } = useIngredients();
  const createRecipeMutation = useCreateRecipe();
  const updateRecipeMutation = useUpdateRecipe();
  const categories = data?.categories || [];
  const rawIngredients = ingredientsData?.ingredients || [];

  // Debug: Check for duplicate ingredient IDs and deduplicate
  const ingredients = React.useMemo(() => {
    const ids = rawIngredients.map((ing) => ing.id);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);

    if (duplicateIds.length > 0) {
      console.warn(
        "⚠️ Found duplicate ingredient IDs in ingredients list:",
        duplicateIds
      );
      console.log("Raw ingredients count:", rawIngredients.length);

      // Deduplicate by ID (keep first occurrence)
      const seen = new Set<number>();
      const deduplicated = rawIngredients.filter((ing) => {
        if (seen.has(ing.id)) {
          return false;
        }
        seen.add(ing.id);
        return true;
      });

      console.log("Deduplicated ingredients count:", deduplicated.length);
      return deduplicated;
    }

    return rawIngredients;
  }, [rawIngredients]);
  const { toast } = useToast();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const [formData, setFormData] =
    useState<Omit<Recipe, "id" | "created_at">>(initialFormData);
  const [recipeIngredients, setRecipeIngredients] = useState<
    RecipeFormIngredient[]
  >([]);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingIngredients, setLoadingIngredients] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsUsingRecipe, setProductsUsingRecipe] = useState<
    (Product & { usedQuantity: number })[]
  >([]);
  const isEditMode = Boolean(initialRecipe);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Debug function to inspect recipe data
  const debugRecipe = () => {
    console.group("🔍 Recipe Debug Information");
    console.log("Recipe Name:", formData.name);
    console.log("Recipe ID:", initialRecipe?.id);
    console.log("Is Edit Mode:", isEditMode);
    console.log("\n📋 Form Data:", formData);
    console.log("\n🥕 Recipe Ingredients Count:", recipeIngredients.length);
    console.log("Recipe Ingredients:", recipeIngredients);

    // Check for missing or invalid ingredients
    const invalidIngredients = recipeIngredients.filter(
      (ri) => !ri.ingredient_id || ri.quantity <= 0
    );
    if (invalidIngredients.length > 0) {
      console.warn("⚠️ Invalid Ingredients Found:", invalidIngredients);
    }

    // Check ingredient references
    recipeIngredients.forEach((recipeIng, index) => {
      const ingredient = ingredients.find(
        (ing) => ing.id === recipeIng.ingredient_id
      );
      if (!ingredient) {
        console.error(
          `❌ Ingredient ${recipeIng.ingredient_id} not found for recipe ingredient #${index + 1}`
        );
      } else {
        console.log(`✅ Ingredient #${index + 1}:`, {
          id: ingredient.id,
          name: ingredient.name,
          quantity: recipeIng.quantity,
          unit: ingredient.unit,
          kiloPerUnit: ingredient.kiloPerUnit,
          pricePerUnit: ingredient.price,
          cost: recipeIng.quantity * (ingredient.price || 0),
          weightInKg: recipeIng.quantity * ingredient.kiloPerUnit,
        });
      }
    });

    // Calculate totals
    const { totalWeight, totalPrice } = calculateTotals();
    console.log("\n💰 Calculated Totals:");
    console.log("  Total Weight:", totalWeight.toFixed(3), "kg");
    console.log("  Total Price:", totalPrice.toFixed(2), "Kč");
    console.log(
      "  Price per Kilo:",
      totalWeight > 0 ? (totalPrice / totalWeight).toFixed(2) : "0.00",
      "Kč/kg"
    );

    // Check nutritional data
    const nutritionalTotals = calculateNutritionalTotals();
    console.log("\n🍎 Nutritional Totals (per 100g):");
    if (nutritionalTotals.totalWeightKg > 0) {
      console.log(
        "  Energy:",
        (
          (nutritionalTotals.totalKJ / nutritionalTotals.totalWeightKg) *
          0.1
        ).toFixed(0),
        "kJ /",
        (
          (nutritionalTotals.totalKcal / nutritionalTotals.totalWeightKg) *
          0.1
        ).toFixed(0),
        "kcal"
      );
      console.log(
        "  Fat:",
        (
          (nutritionalTotals.totalFat / nutritionalTotals.totalWeightKg) *
          0.1
        ).toFixed(1),
        "g"
      );
      console.log(
        "  Saturates:",
        (
          (nutritionalTotals.totalSaturates / nutritionalTotals.totalWeightKg) *
          0.1
        ).toFixed(1),
        "g"
      );
      console.log(
        "  Carbohydrates:",
        (
          (nutritionalTotals.totalCarbohydrate /
            nutritionalTotals.totalWeightKg) *
          0.1
        ).toFixed(1),
        "g"
      );
      console.log(
        "  Sugars:",
        (
          (nutritionalTotals.totalSugars / nutritionalTotals.totalWeightKg) *
          0.1
        ).toFixed(1),
        "g"
      );
      console.log(
        "  Protein:",
        (
          (nutritionalTotals.totalProtein / nutritionalTotals.totalWeightKg) *
          0.1
        ).toFixed(1),
        "g"
      );
      console.log(
        "  Fibre:",
        (
          (nutritionalTotals.totalFibre / nutritionalTotals.totalWeightKg) *
          0.1
        ).toFixed(1),
        "g"
      );
      console.log(
        "  Salt:",
        (
          (nutritionalTotals.totalSalt / nutritionalTotals.totalWeightKg) *
          0.1
        ).toFixed(1),
        "g"
      );
    } else {
      console.warn("⚠️ No nutritional data available (total weight is 0)");
    }

    // Check products using this recipe
    console.log("\n📦 Products Using Recipe:", productsUsingRecipe.length);
    productsUsingRecipe.forEach((product) => {
      console.log(`  - ${product.name} (quantity: ${product.usedQuantity})`);
    });

    // Check allergens
    const allergens = calculateRecipeAllergens();
    console.log("\n⚠️ Allergens:", allergens.length);
    allergens.forEach((allergen) => {
      console.log(`  - ${allergen.name}`);
    });

    // Check for potential issues
    console.log("\n🔍 Potential Issues:");
    let issuesFound = false;

    if (recipeIngredients.length === 0) {
      console.warn("  ❌ Recipe has no ingredients");
      issuesFound = true;
    }

    if (totalWeight === 0) {
      console.warn("  ❌ Total weight is 0");
      issuesFound = true;
    }

    // Note: Price is stored per unit (not per kg)

    if (!issuesFound) {
      console.log("  ✅ No issues detected!");
    }

    console.groupEnd();
  };

  useEffect(() => {
    if (open) {
      if (initialRecipe) {
        const { id, created_at, categories, recipe_ingredients, ...rest } =
          initialRecipe;
        setFormData({ ...rest });
        // Fetch existing ingredients for the recipe
        loadRecipeIngredients(initialRecipe.id);
        // Load products that use this recipe
        loadProductsUsingRecipe(initialRecipe.id);
      } else {
        setFormData(initialFormData);
        setRecipeIngredients([]);
        setProductsUsingRecipe([]);
      }
    }
  }, [open, initialRecipe]);

  // Auto-debug specific recipe
  useEffect(() => {
    if (
      open &&
      formData.name === "Salát Kuřecí velká b." &&
      recipeIngredients.length > 0
    ) {
      console.log("🔍 Auto-debugging recipe: Salát Kuřecí velká b.");
      debugRecipe();
    }
  }, [open, formData.name, recipeIngredients]);

  // Load recipe ingredients from database
  const loadRecipeIngredients = async (recipeId: number) => {
    setLoadingIngredients(true);
    try {
      const dbIngredients = await fetchRecipeIngredients(recipeId);

      // Debug: Check for duplicate IDs
      console.log("=== DEBUG: Loading recipe ingredients ===");
      console.log("Recipe ID:", recipeId);
      console.log("DB Ingredients:", dbIngredients);

      const ids = dbIngredients.map((ing) => ing.id);
      const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
      if (duplicateIds.length > 0) {
        console.warn("⚠️ Found duplicate ingredient IDs:", duplicateIds);
      }

      const formIngredients: RecipeFormIngredient[] = dbIngredients.map(
        (ing, index) => ({
          id: `db-${ing.id}-${index}`,
          ingredient_id: ing.ingredient_id,
          quantity: ing.quantity,
          dbId: ing.id,
        })
      );

      console.log(
        "Form Ingredients with keys:",
        formIngredients.map((fi) => ({
          key: fi.id,
          ingredient_id: fi.ingredient_id,
        }))
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

  // Load products that use this recipe
  const loadProductsUsingRecipe = async (recipeId: number) => {
    setLoadingProducts(true);
    try {
      const { data: productParts, error } = await supabase
        .from("product_parts")
        .select(
          `
          product_id,
          quantity,
          products!product_parts_product_id_fkey (
            id,
            name,
            code,
            price,
            priceMobil,
            priceBuyer,
            active,
            store,
            buyer,
            category_id,
            description,
            image
          )
        `
        )
        .eq("recipe_id", recipeId)
        .not("products!product_parts_product_id_fkey", "is", null);

      if (error) throw error;

      if (productParts && productParts.length > 0) {
        const productsWithQuantity = productParts
          .map((part) => {
            const product = part.products as unknown as Product;
            return {
              ...product,
              usedQuantity: part.quantity,
            };
          })
          .filter(
            (product): product is Product & { usedQuantity: number } =>
              product !== null && "name" in product
          )
          .sort((a, b) => a.name.localeCompare(b.name, "cs"));

        setProductsUsingRecipe(productsWithQuantity);
      } else {
        setProductsUsingRecipe([]);
      }
    } catch (error) {
      console.error("Failed to load products using recipe:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se načíst produkty používající tento recept",
        variant: "destructive",
      });
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Ingredient management functions
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

  const handleAddIngredient = (ingredientId: number, quantity: number) => {
    setRecipeIngredients((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ingredient_id: ingredientId,
        quantity,
      },
    ]);
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
            // Price is stored per unit, so cost = quantity × price
            totalPrice += recipeIng.quantity * ingredient.price;
          }
        }
      }
    });

    return { totalWeight, totalPrice };
  };

  // Calculate nutritional totals
  const calculateNutritionalTotals = () => {
    let totalKJ = 0;
    let totalKcal = 0;
    let totalFat = 0;
    let totalSaturates = 0;
    let totalCarbohydrate = 0;
    let totalSugars = 0;
    let totalProtein = 0;
    let totalFibre = 0;
    let totalSalt = 0;
    let totalWeightKg = 0;

    recipeIngredients.forEach((recipeIng) => {
      if (recipeIng.ingredient_id && recipeIng.quantity > 0) {
        const ingredient = ingredients.find(
          (ing) => ing.id === recipeIng.ingredient_id
        );
        if (ingredient) {
          const weightInKg = recipeIng.quantity * ingredient.kiloPerUnit;
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
    });

    return {
      totalKJ,
      totalKcal,
      totalFat,
      totalSaturates,
      totalCarbohydrate,
      totalSugars,
      totalProtein,
      totalFibre,
      totalSalt,
      totalWeightKg,
    };
  };

  // Calculate recipe allergens from all ingredients
  const calculateRecipeAllergens = () => {
    const allAllergens = new Map();

    recipeIngredients.forEach((recipeIng) => {
      if (recipeIng.ingredient_id) {
        const ingredient = ingredients.find(
          (ing) => ing.id === recipeIng.ingredient_id
        );
        if (ingredient) {
          const allergens = detectAllergens(ingredient.element);
          allergens.forEach((allergen) => {
            allAllergens.set(allergen.name, allergen);
          });
        }
      }
    });

    return Array.from(allAllergens.values());
  };

  const recipeAllergens = calculateRecipeAllergens();

  const { totalWeight, totalPrice } = calculateTotals();
  const nutritionalTotals = calculateNutritionalTotals();

  // Helper to get border color based on recipe type
  const getBorderInfo = () => {
    const colors = [];
    if (formData.baker)
      colors.push({ class: "border-l-blue-500", color: "#3b82f6" });
    if (formData.pastry)
      colors.push({ class: "border-l-pink-500", color: "#ec4899" });
    if (formData.donut)
      colors.push({ class: "border-l-purple-500", color: "#8b5cf6" });
    if (formData.store)
      colors.push({ class: "border-l-green-500", color: "#10b981" });
    if (formData.test)
      colors.push({ class: "border-l-yellow-500", color: "#eab308" });

    return colors;
  };

  // Calculate nutritional breakdown per ingredient for tooltips
  const calculateNutritionalBreakdown = (nutritionType: string) => {
    const breakdown: Array<{ name: string; value: number; unit: string }> = [];

    recipeIngredients.forEach((recipeIng) => {
      if (recipeIng.ingredient_id && recipeIng.quantity > 0) {
        const ingredient = ingredients.find(
          (ing) => ing.id === recipeIng.ingredient_id
        );
        if (ingredient) {
          const weightInKg = recipeIng.quantity * ingredient.kiloPerUnit;
          const factor = weightInKg * 10; // Convert kg to 100g units

          let per100gValue = 0;
          const unit = nutritionType === "energy" ? "kcal" : "g";

          switch (nutritionType) {
            case "energy":
              per100gValue =
                nutritionalTotals.totalWeightKg > 0
                  ? ((ingredient.kJ * factor) /
                      nutritionalTotals.totalWeightKg) *
                    0.1
                  : 0;
              breakdown.push({
                name: ingredient.name,
                value: per100gValue,
                unit: "kJ",
              });
              per100gValue =
                nutritionalTotals.totalWeightKg > 0
                  ? ((ingredient.kcal * factor) /
                      nutritionalTotals.totalWeightKg) *
                    0.1
                  : 0;
              breakdown.push({
                name: ingredient.name,
                value: per100gValue,
                unit: "kcal",
              });
              return; // Special case for energy - already added both kJ and kcal
            case "fat":
              per100gValue =
                nutritionalTotals.totalWeightKg > 0
                  ? ((ingredient.fat * factor) /
                      nutritionalTotals.totalWeightKg) *
                    0.1
                  : 0;
              break;
            case "saturates":
              per100gValue =
                nutritionalTotals.totalWeightKg > 0
                  ? ((ingredient.saturates * factor) /
                      nutritionalTotals.totalWeightKg) *
                    0.1
                  : 0;
              break;
            case "carbohydrate":
              per100gValue =
                nutritionalTotals.totalWeightKg > 0
                  ? ((ingredient.carbohydrate * factor) /
                      nutritionalTotals.totalWeightKg) *
                    0.1
                  : 0;
              break;
            case "sugars":
              per100gValue =
                nutritionalTotals.totalWeightKg > 0
                  ? ((ingredient.sugars * factor) /
                      nutritionalTotals.totalWeightKg) *
                    0.1
                  : 0;
              break;
            case "protein":
              per100gValue =
                nutritionalTotals.totalWeightKg > 0
                  ? ((ingredient.protein * factor) /
                      nutritionalTotals.totalWeightKg) *
                    0.1
                  : 0;
              break;
            case "fibre":
              per100gValue =
                nutritionalTotals.totalWeightKg > 0
                  ? ((ingredient.fibre * factor) /
                      nutritionalTotals.totalWeightKg) *
                    0.1
                  : 0;
              break;
            case "salt":
              per100gValue =
                nutritionalTotals.totalWeightKg > 0
                  ? ((ingredient.salt * factor) /
                      nutritionalTotals.totalWeightKg) *
                    0.1
                  : 0;
              break;
          }

          if (per100gValue > 0) {
            breakdown.push({
              name: ingredient.name,
              value: per100gValue,
              unit,
            });
          }
        }
      }
    });

    // Sort by value descending and filter out zero values
    return breakdown
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${formData.name || "Recept"}</title>
          <style>
            @page { size: A4; margin: 10px; }
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            .header { text-align: center; margin-bottom: 20px; }
            .section { margin-bottom: 30px; }
            .section-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
            .ingredient-row { display: flex; justify-content: space-between; padding: 5px 0; }
            .total-row { font-weight: bold; border-top: 2px solid #000; padding-top: 10px; }
            .allergens { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
            .allergen-badge { padding: 4px 8px; border-radius: 4px; background: #f0f0f0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${formData.name || "Recept"}</h1>
          </div>

          <div class="section">
            <div class="section-title">Základní informace</div>
            <table>
              <tr>
                <td>Kategorie:</td>
                <td>${categories.find((c) => c.id === formData.category_id)?.name || "-"}</td>
              </tr>
              <tr>
                <td>Typ:</td>
                <td>${
                  [
                    formData.baker && "Pekař",
                    formData.pastry && "Cukrář",
                    formData.donut && "Donut",
                    formData.store && "Prodejna",
                    formData.test && "Test",
                  ]
                    .filter(Boolean)
                    .join(", ") || "-"
                }</td>
              </tr>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Suroviny</div>
            <table>
              <thead>
                <tr>
                  <th>Surovina</th>
                  <th style="text-align: right;">Množství</th>
                  <th>Jednotka</th>
                  <th style="text-align: right;">Cena</th>
                </tr>
              </thead>
              <tbody>
                ${recipeIngredients
                  .slice()
                  .sort((a, b) => {
                    const ingredientA = ingredients.find(
                      (ing) => ing.id === a.ingredient_id
                    );
                    const ingredientB = ingredients.find(
                      (ing) => ing.id === b.ingredient_id
                    );

                    // Move ingredients with unit "L" or "l" to bottom
                    const isLiterA = ingredientA?.unit?.toLowerCase() === "l";
                    const isLiterB = ingredientB?.unit?.toLowerCase() === "l";

                    if (isLiterA && !isLiterB) return 1;
                    if (!isLiterA && isLiterB) return -1;

                    // Sort by quantity (descending) within the same unit type
                    return b.quantity - a.quantity;
                  })
                  .map((recipeIng) => {
                    const ingredient = ingredients.find(
                      (ing) => ing.id === recipeIng.ingredient_id
                    );
                    if (!ingredient) return "";
                    return `
                    <tr>
                      <td>${ingredient.name}</td>
                      <td style="text-align: right;">${recipeIng.quantity.toFixed(3)}${
                        ingredient.unit === "ks"
                          ? ` (${(recipeIng.quantity * ingredient.kiloPerUnit).toFixed(3)} kg)`
                          : ""
                      }</td>
                      <td>${ingredient.unit}</td>
                      <td style="text-align: right;">${(recipeIng.quantity * (ingredient.price || 0)).toFixed(2)} Kč</td>
                    </tr>
                  `;
                  })
                  .join("")}
                <tr class="total-row">
                  <td>Celkem:</td>
                                     <td style="text-align: right;">${recipeIngredients
                                       .reduce(
                                         (sum, ing) => sum + ing.quantity,
                                         0
                                       )
                                       .toFixed(3)}${
                                       recipeIngredients.some((ing) => {
                                         const ingredient = ingredients.find(
                                           (i) => i.id === ing.ingredient_id
                                         );
                                         return ingredient?.unit === "ks";
                                       })
                                         ? ` (${recipeIngredients
                                             .reduce((sum, ing) => {
                                               const ingredient =
                                                 ingredients.find(
                                                   (i) =>
                                                     i.id === ing.ingredient_id
                                                 );
                                               return (
                                                 sum +
                                                 ing.quantity *
                                                   (ingredient?.kiloPerUnit ||
                                                     0)
                                               );
                                             }, 0)
                                             .toFixed(3)} kg)`
                                         : ""
                                     }</td>
                  <td></td>
                  <td style="text-align: right;">${totalPrice.toFixed(2)} Kč</td>
                </tr>
              </tbody>
            </table>
          </div>



          <div class="section">
            <div class="section-title">Proces</div>
            <table>
              ${formData.baking ? `<tr><td>Pečení:</td><td>${formData.baking}</td></tr>` : ""}
              ${formData.dough ? `<tr><td>Těsto:</td><td>${formData.dough}</td></tr>` : ""}
              ${formData.stir ? `<tr><td>Míchání:</td><td>${formData.stir}</td></tr>` : ""}
              ${formData.water ? `<tr><td>Voda:</td><td>${formData.water}</td></tr>` : ""}
              ${formData.note ? `<tr><td>Poznámka:</td><td>${formData.note}</td></tr>` : ""}
            </table>
          </div>

                     <div style="page-break-before: always;"></div>
           
           <div class="section">
             <div class="section-title">Produkty používající tento recept</div>
             ${
               productsUsingRecipe.length > 0
                 ? `
               <table>
                 <thead>
                   <tr>
                     <th>Název produktu</th>
                     <th>Použité množství</th>
                     <th>Status</th>
                   </tr>
                 </thead>
                 <tbody>
                   ${productsUsingRecipe
                     .map(
                       (product) => `
                     <tr>
                       <td>${product.name}</td>
                       <td>${product.usedQuantity}</td>
                       <td>${product.active ? "Aktivní" : "Neaktivní"}</td>
                     </tr>
                   `
                     )
                     .join("")}
                 </tbody>
               </table>
             `
                 : `
               <p>Žádné produkty nepoužívají tento recept.</p>
             `
             }
           </div>

           <div style="text-align: right; margin-top: 20px; font-size: 12px; color: #666;">
             Vytištěno: ${new Date().toLocaleString()}
           </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let recipeId: number;

      // Calculate totals from ingredients
      const { totalWeight, totalPrice } = calculateTotals();
      const pricePerKilo = totalWeight > 0 ? totalPrice / totalWeight : 0;

      // Clean formData to exclude joined fields and add calculated values
      const { categories, recipe_ingredients, ...cleanFormData } =
        formData as any;

      // Update formData with calculated values
      const recipeDataToSave = {
        ...cleanFormData,
        price: totalPrice,
        pricePerKilo: pricePerKilo,
        quantity: totalWeight,
      };

      if (isEditMode && initialRecipe) {
        await updateRecipeMutation.mutateAsync({
          id: initialRecipe.id,
          updates: recipeDataToSave,
        });
        recipeId = initialRecipe.id;
        toast({ title: "Úspěch", description: "Recept byl upraven." });
      } else {
        // For new recipes, we need to create the recipe first and get its ID
        const newRecipe =
          await createRecipeMutation.mutateAsync(recipeDataToSave);
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

  // Helper function to normalize element text for comparison
  const normalizeElement = (element: string): string => {
    return (
      element
        .trim()
        .toLowerCase()
        // Remove multiple spaces and normalize to single space
        .replace(/\s+/g, " ")
        // Normalize spacing around punctuation
        .replace(/\s*\.\s*/g, ".")
        .replace(/\s*,\s*/g, ",")
        .replace(/\s*;\s*/g, ";")
        .replace(/\s*:\s*/g, ":")
        .replace(/\s*-\s*/g, "-")
        .replace(/\s*\/\s*/g, "/")
        .replace(/\s*\(\s*/g, "(")
        .replace(/\s*\)\s*/g, ")")
        // Remove trailing punctuation that might be inconsistent
        .replace(/[.,;:]+$/, "")
        // Normalize common abbreviations
        .replace(/\bpšen\./g, "pšeničná")
        .replace(/\bžit\./g, "žitná")
        .replace(/\bovoc\./g, "ovocný")
        .replace(/\bzelez\./g, "železitý")
        // Final cleanup
        .trim()
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible print:relative print:!block print:!top-0 print:!translate-y-0 print:m-0 print:rounded-none print:min-h-0 [&_[role='dialog']]:print:!block [&_[role='dialog']]:print:!relative [&_[role='dialog']]:print:!transform-none [&>[data-state]]:print:bg-transparent">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5 print:hidden" />
            <Printer className="h-5 w-5 hidden print:inline" />
            {isEditMode ? "Upravit recept" : "Nový recept"}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="space-y-6 print:!block print:!visible"
        >
          <div className="relative">
            {/* Colored stripes for multiple selections */}
            {getBorderInfo().length > 0 && (
              <div className="absolute left-0 top-0 bottom-0 flex flex-col w-1 z-10 rounded-l">
                {getBorderInfo().map((info, index) => (
                  <div
                    key={index}
                    className={`flex-1 ${index === 0 ? "rounded-tl" : ""} ${
                      index === getBorderInfo().length - 1 ? "rounded-bl" : ""
                    }`}
                    style={{ backgroundColor: info.color }}
                  />
                ))}
              </div>
            )}
            <Card
              className={
                getBorderInfo().length === 1
                  ? `border-l-4 ${getBorderInfo()[0].class}`
                  : getBorderInfo().length > 1
                    ? "ml-1"
                    : ""
              }
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Základní informace</CardTitle>
                  {isEditMode && isAdmin && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={debugRecipe}
                      className="print:hidden text-xs"
                      title="Debug recipe (výstup v konzoli)"
                    >
                      🔍 Debug
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="baker"
                      checked={!!formData.baker}
                      onCheckedChange={(checked) =>
                        handleInputChange("baker", checked)
                      }
                      className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                    />
                    <Label htmlFor="baker">Pekař</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="pastry"
                      checked={!!formData.pastry}
                      onCheckedChange={(checked) =>
                        handleInputChange("pastry", checked)
                      }
                      className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                    />
                    <Label htmlFor="pastry">Cukrář</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="donut"
                      checked={!!formData.donut}
                      onCheckedChange={(checked) =>
                        handleInputChange("donut", checked)
                      }
                      className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                    />
                    <Label htmlFor="donut">Donut</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="store"
                      checked={!!formData.store}
                      onCheckedChange={(checked) =>
                        handleInputChange("store", checked)
                      }
                      className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                    />
                    <Label htmlFor="store">Prodejna</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="test"
                      checked={!!formData.test}
                      onCheckedChange={(checked) =>
                        handleInputChange("test", checked)
                      }
                      className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                    />
                    <Label htmlFor="test">Test</Label>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Název *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        handleInputChange("name", e.target.value)
                      }
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
              </CardContent>
            </Card>
          </div>

          {/* Ingredients Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                Suroviny
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsPickerOpen(true)}
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Plus className="h-4 w-4" />
                  Přidat surovinu
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 bg-orange-50/50 rounded-lg p-4 border border-orange-100">
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
                <div className="overflow-x-auto">
                  <div className="hidden md:grid grid-cols-12 gap-2 px-2 pb-2 text-xs font-semibold text-orange-900/80">
                    <div className="col-span-3">Název suroviny</div>
                    <div className="col-span-2">Množství</div>
                    <div className="col-span-1">Jednotka</div>
                    <div className="col-span-2 text-right">Cena</div>
                    <div className="col-span-3">Alergeny</div>
                    <div className="col-span-1">Akce</div>
                  </div>
                  <div className="space-y-2">
                    {recipeIngredients
                      .slice() // Create a copy to avoid mutating the original array
                      .sort((a, b) => {
                        const ingredientA = ingredients.find(
                          (ing) => ing.id === a.ingredient_id
                        );
                        const ingredientB = ingredients.find(
                          (ing) => ing.id === b.ingredient_id
                        );

                        // Move ingredients with unit "L" or "l" to bottom
                        const isLiterA =
                          ingredientA?.unit?.toLowerCase() === "l";
                        const isLiterB =
                          ingredientB?.unit?.toLowerCase() === "l";

                        if (isLiterA && !isLiterB) return 1;
                        if (!isLiterA && isLiterB) return -1;

                        // Sort by quantity (descending) within the same unit type
                        return b.quantity - a.quantity;
                      })
                      .map((recipeIng) => {
                        const selectedIngredient = ingredients.find(
                          (ing) => ing.id === recipeIng.ingredient_id
                        );
                        const allergens = selectedIngredient
                          ? detectAllergens(selectedIngredient.element)
                          : [];

                        return (
                          <div
                            key={recipeIng.id}
                            className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-white/80 rounded border border-orange-100 px-2 py-2 shadow-sm"
                          >
                            <div className="md:col-span-3 font-medium truncate">
                              {selectedIngredient ? (
                                <div className="flex items-center gap-2">
                                  <span>{selectedIngredient.name}</span>
                                  {selectedIngredient.element &&
                                    selectedIngredient.element.trim() !==
                                      "" && (
                                      <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                    )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">
                                  (neznámá surovina)
                                </span>
                              )}
                            </div>
                            <div className="md:col-span-2 flex items-center gap-2">
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
                                className="mt-1 w-24 appearance-none no-spinner"
                                placeholder="0"
                              />
                            </div>
                            <div className="md:col-span-1 text-sm text-muted-foreground">
                              {selectedIngredient
                                ? selectedIngredient.unit
                                : ""}
                            </div>
                            <div className="md:col-span-2 text-right text-sm text-orange-900/80 font-semibold">
                              {selectedIngredient &&
                              selectedIngredient.price &&
                              recipeIng.quantity > 0
                                ? `${(recipeIng.quantity * selectedIngredient.price).toFixed(2)} Kč`
                                : "0.00 Kč"}
                            </div>
                            <div className="md:col-span-3">
                              {allergens.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {allergens
                                    .slice(0, 2)
                                    .map((allergen, index) => {
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
                                  {allergens.length > 2 && (
                                    <span className="text-xs text-muted-foreground">
                                      +{allergens.length - 2} další
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Bez alergenů
                                </span>
                              )}
                            </div>
                            <div className="md:col-span-1 flex justify-end items-center">
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
                </div>
              )}

              {/* Calculation Summary */}
              {recipeIngredients.length > 0 && (
                <div className="mt-6 p-4 bg-orange-100 border border-orange-200 rounded-md">
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
                    {/* <Button
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
                    </Button> */}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recipe Elements Section */}
          {recipeIngredients.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Složení surovin v receptu
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 bg-green-50/50 rounded-lg p-4 border border-green-100">
                {(() => {
                  // Get all ingredients with elements, sorted by quantity (descending)
                  const ingredientsWithElements = recipeIngredients
                    .map((recipeIng) => {
                      const ingredient = ingredients.find(
                        (ing) => ing.id === recipeIng.ingredient_id
                      );
                      return ingredient &&
                        ingredient.element &&
                        ingredient.element.trim() !== ""
                        ? {
                            ingredient,
                            quantity:
                              recipeIng.quantity * ingredient.kiloPerUnit, // Convert to kg for proper sorting
                          }
                        : null;
                    })
                    .filter(
                      (item): item is { ingredient: any; quantity: number } =>
                        item !== null
                    )
                    .sort((a, b) => b.quantity - a.quantity); // Sort by quantity descending

                  if (ingredientsWithElements.length === 0) {
                    return (
                      <p className="text-muted-foreground text-center py-4">
                        Žádná ze surovin nemá definované složení.
                      </p>
                    );
                  }

                  // Create a map to track unique normalized elements and keep original text
                  const elementMap = new Map<string, string>();

                  ingredientsWithElements.forEach(({ ingredient }) => {
                    const originalElement = ingredient.element.trim();
                    const normalizedElement = normalizeElement(originalElement);

                    // Keep the first occurrence (highest quantity) of each normalized element
                    if (!elementMap.has(normalizedElement)) {
                      elementMap.set(normalizedElement, originalElement);
                    }
                  });

                  // Get unique elements preserving original formatting
                  const uniqueElements = Array.from(elementMap.values());
                  const mergedElements = uniqueElements.join(", ");

                  return (
                    <div className="bg-white/80 rounded border border-green-200 p-4">
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
                              description:
                                "Složení bylo zkopírováno do schránky",
                            });
                          }}
                          className="flex-shrink-0"
                          title="Kopírovat složení"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Energetic Information Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Energetické údaje (na 100g)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 bg-blue-50/50 rounded-lg p-4 border border-blue-100">
              <TooltipProvider>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <span className="text-muted-foreground">
                          Energie na 100g:
                        </span>
                        <div className="font-semibold">
                          {nutritionalTotals.totalWeightKg > 0
                            ? `${((nutritionalTotals.totalKJ / nutritionalTotals.totalWeightKg) * 0.1).toFixed(0)} KJ / ${((nutritionalTotals.totalKcal / nutritionalTotals.totalWeightKg) * 0.1).toFixed(0)} Kcal`
                            : "0 KJ / 0 Kcal"}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-1">
                        <div className="font-semibold text-xs mb-2">
                          Energie podle surovin:
                        </div>
                        {calculateNutritionalBreakdown("energy").length > 0 ? (
                          calculateNutritionalBreakdown("energy").map(
                            (item, index) => (
                              <div
                                key={index}
                                className="text-xs flex justify-between"
                              >
                                <span>{item.name}:</span>
                                <span>
                                  {item.value.toFixed(1)} {item.unit}
                                </span>
                              </div>
                            )
                          )
                        ) : (
                          <div className="text-xs">Žádné údaje o energii</div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <span className="text-muted-foreground">
                          Tuky na 100g:
                        </span>
                        <div className="font-semibold">
                          {nutritionalTotals.totalWeightKg > 0
                            ? `${((nutritionalTotals.totalFat / nutritionalTotals.totalWeightKg) * 0.1).toFixed(1)} g`
                            : "0.0 g"}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-1">
                        <div className="font-semibold text-xs mb-2">
                          Tuky podle surovin:
                        </div>
                        {calculateNutritionalBreakdown("fat").length > 0 ? (
                          calculateNutritionalBreakdown("fat").map(
                            (item, index) => (
                              <div
                                key={index}
                                className="text-xs flex justify-between"
                              >
                                <span>{item.name}:</span>
                                <span>
                                  {item.value.toFixed(1)} {item.unit}
                                </span>
                              </div>
                            )
                          )
                        ) : (
                          <div className="text-xs">Žádné údaje o tucích</div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <span className="text-muted-foreground">
                          Nasycené mastné kyseliny na 100g:
                        </span>
                        <div className="font-semibold">
                          {nutritionalTotals.totalWeightKg > 0
                            ? `${((nutritionalTotals.totalSaturates / nutritionalTotals.totalWeightKg) * 0.1).toFixed(1)} g`
                            : "0.0 g"}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-1">
                        <div className="font-semibold text-xs mb-2">
                          Nasycené mastné kyseliny podle surovin:
                        </div>
                        {calculateNutritionalBreakdown("saturates").length >
                        0 ? (
                          calculateNutritionalBreakdown("saturates").map(
                            (item, index) => (
                              <div
                                key={index}
                                className="text-xs flex justify-between"
                              >
                                <span>{item.name}:</span>
                                <span>
                                  {item.value.toFixed(1)} {item.unit}
                                </span>
                              </div>
                            )
                          )
                        ) : (
                          <div className="text-xs">
                            Žádné údaje o nasycených mastných kyselinách
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <span className="text-muted-foreground">
                          Sacharidy na 100g:
                        </span>
                        <div className="font-semibold">
                          {nutritionalTotals.totalWeightKg > 0
                            ? `${((nutritionalTotals.totalCarbohydrate / nutritionalTotals.totalWeightKg) * 0.1).toFixed(1)} g`
                            : "0.0 g"}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-1">
                        <div className="font-semibold text-xs mb-2">
                          Sacharidy podle surovin:
                        </div>
                        {calculateNutritionalBreakdown("carbohydrate").length >
                        0 ? (
                          calculateNutritionalBreakdown("carbohydrate").map(
                            (item, index) => (
                              <div
                                key={index}
                                className="text-xs flex justify-between"
                              >
                                <span>{item.name}:</span>
                                <span>
                                  {item.value.toFixed(1)} {item.unit}
                                </span>
                              </div>
                            )
                          )
                        ) : (
                          <div className="text-xs">
                            Žádné údaje o sacharidech
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <span className="text-muted-foreground">
                          Cukry na 100g:
                        </span>
                        <div className="font-semibold">
                          {nutritionalTotals.totalWeightKg > 0
                            ? `${((nutritionalTotals.totalSugars / nutritionalTotals.totalWeightKg) * 0.1).toFixed(1)} g`
                            : "0.0 g"}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-1">
                        <div className="font-semibold text-xs mb-2">
                          Cukry podle surovin:
                        </div>
                        {calculateNutritionalBreakdown("sugars").length > 0 ? (
                          calculateNutritionalBreakdown("sugars").map(
                            (item, index) => (
                              <div
                                key={index}
                                className="text-xs flex justify-between"
                              >
                                <span>{item.name}:</span>
                                <span>
                                  {item.value.toFixed(1)} {item.unit}
                                </span>
                              </div>
                            )
                          )
                        ) : (
                          <div className="text-xs">Žádné údaje o cukrech</div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <span className="text-muted-foreground">
                          Bílkoviny na 100g:
                        </span>
                        <div className="font-semibold">
                          {nutritionalTotals.totalWeightKg > 0
                            ? `${((nutritionalTotals.totalProtein / nutritionalTotals.totalWeightKg) * 0.1).toFixed(1)} g`
                            : "0.0 g"}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-1">
                        <div className="font-semibold text-xs mb-2">
                          Bílkoviny podle surovin:
                        </div>
                        {calculateNutritionalBreakdown("protein").length > 0 ? (
                          calculateNutritionalBreakdown("protein").map(
                            (item, index) => (
                              <div
                                key={index}
                                className="text-xs flex justify-between"
                              >
                                <span>{item.name}:</span>
                                <span>
                                  {item.value.toFixed(1)} {item.unit}
                                </span>
                              </div>
                            )
                          )
                        ) : (
                          <div className="text-xs">
                            Žádné údaje o bílkovinách
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <span className="text-muted-foreground">
                          Vláknina na 100g:
                        </span>
                        <div className="font-semibold">
                          {nutritionalTotals.totalWeightKg > 0
                            ? `${((nutritionalTotals.totalFibre / nutritionalTotals.totalWeightKg) * 0.1).toFixed(1)} g`
                            : "0.0 g"}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-1">
                        <div className="font-semibold text-xs mb-2">
                          Vláknina podle surovin:
                        </div>
                        {calculateNutritionalBreakdown("fibre").length > 0 ? (
                          calculateNutritionalBreakdown("fibre").map(
                            (item, index) => (
                              <div
                                key={index}
                                className="text-xs flex justify-between"
                              >
                                <span>{item.name}:</span>
                                <span>
                                  {item.value.toFixed(1)} {item.unit}
                                </span>
                              </div>
                            )
                          )
                        ) : (
                          <div className="text-xs">Žádné údaje o vláknině</div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <span className="text-muted-foreground">
                          Sůl na 100g:
                        </span>
                        <div className="font-semibold">
                          {nutritionalTotals.totalWeightKg > 0
                            ? `${((nutritionalTotals.totalSalt / nutritionalTotals.totalWeightKg) * 0.1).toFixed(1)} g`
                            : "0.0 g"}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-1">
                        <div className="font-semibold text-xs mb-2">
                          Sůl podle surovin:
                        </div>
                        {calculateNutritionalBreakdown("salt").length > 0 ? (
                          calculateNutritionalBreakdown("salt").map(
                            (item, index) => (
                              <div
                                key={index}
                                className="text-xs flex justify-between"
                              >
                                <span>{item.name}:</span>
                                <span>
                                  {item.value.toFixed(1)} {item.unit}
                                </span>
                              </div>
                            )
                          )
                        ) : (
                          <div className="text-xs">Žádné údaje o soli</div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>

                  <div>
                    <span className="text-muted-foreground">
                      Celková hmotnost receptu:
                    </span>
                    <div className="font-semibold">
                      {nutritionalTotals.totalWeightKg.toFixed(3)} kg
                    </div>
                  </div>
                </div>
              </TooltipProvider>
            </CardContent>
          </Card>

          {/* Recipe Allergens Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Alergeny receptu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 bg-red-50/50 rounded-lg p-4 border border-red-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">
                    Celkové alergeny receptu:
                  </span>
                  <div className="font-semibold">{recipeAllergens.length}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Jedinečné alergeny:
                  </span>
                  <div className="font-semibold">
                    {
                      Array.from(
                        new Set(
                          recipeAllergens.map((allergen) => allergen.name)
                        )
                      ).length
                    }
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Alergeny v surovinách:
                  </span>
                  <div className="font-semibold">{recipeAllergens.length}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {recipeAllergens.map((allergen, index) => {
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
            </CardContent>
          </Card>

          {/* Products Using This Recipe Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Produkty využívající tento recept
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 bg-purple-50/50 rounded-lg p-4 border border-purple-100">
              {loadingProducts ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">Načítání produktů...</p>
                </div>
              ) : productsUsingRecipe.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">
                    Nenalezeny žádné produkty, které používají tento recept.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground mb-3">
                    Nalezeno {productsUsingRecipe.length} produkt
                    {productsUsingRecipe.length === 1
                      ? ""
                      : productsUsingRecipe.length < 5
                        ? "y"
                        : "ů"}{" "}
                    používajících tento recept:
                  </div>
                  <div className="grid gap-2">
                    {productsUsingRecipe.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between p-3 bg-white/80 rounded border border-purple-200 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                product.active ? "bg-green-500" : "bg-red-500"
                              }`}
                            />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {product.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              Použité množství:{" "}
                              {product.usedQuantity.toFixed(3)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {product.store && (
                            <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                              Prodejna
                            </span>
                          )}
                          {product.buyer && (
                            <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                              Odběratel
                            </span>
                          )}
                          {!product.active && (
                            <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                              Neaktivní
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
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

          <div className="flex justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrint}
              className="print:hidden"
            >
              <Printer className="h-4 w-4 mr-2" />
              Vytisknout
            </Button>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSaving}
                className="print:hidden"
              >
                <X className="h-4 w-4 mr-2" />
                Zrušit
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-orange-600 hover:bg-orange-700 print:hidden"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving
                  ? "Ukládám..."
                  : isEditMode
                    ? "Uložit změny"
                    : "Vytvořit"}
              </Button>
            </div>
          </div>
        </form>
        <IngredientPickerModal
          open={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          onPick={handleAddIngredient}
          ingredients={ingredients}
        />
      </DialogContent>
    </Dialog>
  );
}
