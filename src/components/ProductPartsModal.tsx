import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Trash2,
  Save,
  Package,
  List,
  Copy,
  AlertTriangle,
  BookOpen,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useRecipes } from "@/hooks/useRecipes";
import { useIngredients } from "@/hooks/useIngredients";
import { fetchAllProducts } from "@/hooks/useProducts";
import { useQueryClient } from "@tanstack/react-query";
import { detectAllergens } from "@/utils/allergenDetection";
import { useProductPartsCount } from "@/hooks/useProductParts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { removeDiacritics } from "@/utils/removeDiacritics";

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
  const [calculatedWeights, setCalculatedWeights] = useState<
    Map<number, number>
  >(new Map());
  const [calculatedEnergeticValues, setCalculatedEnergeticValues] = useState<
    Map<
      number,
      {
        kJ: number;
        kcal: number;
        fat: number;
        saturates: number;
        carbohydrate: number;
        sugars: number;
        protein: number;
        fibre: number;
        salt: number;
      }
    >
  >(new Map());
  // Search states for each row - Map<rowIndex, searchText>
  // const [recipeSearches, setRecipeSearches] = useState<Map<number, string>>(
  //   new Map()
  // );
  // const [productSearches, setProductSearches] = useState<Map<number, string>>(
  //   new Map()
  // );
  // const [ingredientSearches, setIngredientSearches] = useState<
  //   Map<number, string>
  // >(new Map());
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Product diversification flags state
  const [productDiversification, setProductDiversification] = useState({
    baker_recipe: false,
    pastry_recipe: false,
    donut_recipe: false,
    store_recipe: false,
    non_recipe: false,
  });

  // Fetch data for dropdowns
  const { data: recipesData } = useRecipes();
  const { data: ingredientsData } = useIngredients();
  const { data: productsData } = fetchAllProducts();
  const { data: productPartsCount } = useProductPartsCount();

  const recipes = recipesData?.recipes || [];
  const ingredients = ingredientsData?.ingredients || [];
  const products = productsData || [];

  // Create a lookup map for products with parts
  const productPartsMap = useMemo(() => {
    const map = new Map<number, boolean>();
    productPartsCount?.forEach((pc) => {
      map.set(pc.product_id, true);
    });
    return map;
  }, [productPartsCount]);

  // Helper function to calculate actual weight from recipe ingredients
  const calculateProductWeightFromRecipe = async (
    productId: number
  ): Promise<number | null> => {
    try {
      // Fetch product parts for this product
      const { data: productParts, error } = await supabase
        .from("product_parts")
        .select(
          `
          *,
          recipes(name, recipe_ingredients(quantity, ingredient:ingredients(kiloPerUnit))),
          ingredients(kiloPerUnit)
        `
        )
        .eq("product_id", productId)
        .eq("productOnly", false); // Only non-productOnly parts contribute to weight

      if (error) throw error;

      if (!productParts || productParts.length === 0) {
        return null; // No parts found
      }

      let totalWeightKg = 0;

      productParts.forEach((part: any) => {
        // Handle recipe parts
        if (part.recipe_id && part.recipes && part.recipes.recipe_ingredients) {
          let recipeWeightKg = 0;
          part.recipes.recipe_ingredients.forEach((recipeIng: any) => {
            if (recipeIng.ingredient && recipeIng.ingredient.kiloPerUnit) {
              const weightInKg =
                recipeIng.quantity * recipeIng.ingredient.kiloPerUnit;
              recipeWeightKg += weightInKg;
            }
          });
          // Use the actual weight being used from this recipe part
          totalWeightKg += part.quantity;
        }

        // Handle ingredient parts
        if (
          part.ingredient_id &&
          part.ingredients &&
          part.ingredients.kiloPerUnit
        ) {
          const weightInKg = part.quantity * part.ingredients.kiloPerUnit;
          totalWeightKg += weightInKg;
        }

        // Note: pastry_id parts would need recursive calculation, skip for now
      });

      return totalWeightKg > 0 ? totalWeightKg : null;
    } catch (error) {
      console.error("Error calculating product weight from recipe:", error);
      return null;
    }
  };

  // Load existing product parts and diversification flags
  useEffect(() => {
    if (open && productId) {
      loadProductParts();
      loadProductDiversification();
    }
  }, [open, productId]);

  // Auto-save composition when product parts change
  useEffect(() => {
    if (open && productParts.length >= 0) {
      calculateAndSaveComposition();
    }
  }, [productParts, open]);

  // Calculate weights for product parts
  useEffect(() => {
    const calculateWeights = async () => {
      const weights = new Map<number, number>();
      const energeticValues = new Map<
        number,
        {
          kJ: number;
          kcal: number;
          fat: number;
          saturates: number;
          carbohydrate: number;
          sugars: number;
          protein: number;
          fibre: number;
          salt: number;
        }
      >();

      const productIds = productParts
        .filter((part) => part.pastry_id)
        .map((part) => part.pastry_id!)
        .filter((id, index, arr) => arr.indexOf(id) === index); // unique IDs

      for (const productId of productIds) {
        const weight = await calculateProductWeightFromRecipe(productId);
        if (weight && weight > 0) {
          weights.set(productId, weight);
        }

        // Calculate energetic values from recipe
        try {
          const { data: productRecipeParts, error: recipeError } =
            await supabase
              .from("product_parts")
              .select(
                `
              *,
              recipes(name, recipe_ingredients(quantity, ingredient:ingredients(kiloPerUnit, kJ, kcal, fat, saturates, carbohydrate, sugars, protein, fibre, salt)))
            `
              )
              .eq("product_id", productId)
              .eq("productOnly", false);

          if (
            !recipeError &&
            productRecipeParts &&
            productRecipeParts.length > 0
          ) {
            let totalKJ = 0;
            let totalKcal = 0;
            let totalFat = 0;
            let totalSaturates = 0;
            let totalCarbohydrate = 0;
            let totalSugars = 0;
            let totalProtein = 0;
            let totalFibre = 0;
            let totalSalt = 0;

            productRecipeParts.forEach((recipePart: any) => {
              if (
                recipePart.recipe_id &&
                recipePart.recipes &&
                recipePart.recipes.recipe_ingredients
              ) {
                // Calculate total recipe weight first
                let recipeWeightKg = 0;
                recipePart.recipes.recipe_ingredients.forEach(
                  (recipeIng: any) => {
                    if (recipeIng.ingredient) {
                      const ingredient = recipeIng.ingredient;
                      const weightInKg =
                        recipeIng.quantity * ingredient.kiloPerUnit;
                      recipeWeightKg += weightInKg;
                    }
                  }
                );

                // Calculate energetic values for the full recipe, then scale to product weight
                let recipeKJ = 0;
                let recipeKcal = 0;
                let recipeFat = 0;
                let recipeSaturates = 0;
                let recipeCarbohydrate = 0;
                let recipeSugars = 0;
                let recipeProtein = 0;
                let recipeFibre = 0;
                let recipeSalt = 0;

                recipePart.recipes.recipe_ingredients.forEach(
                  (recipeIng: any) => {
                    if (recipeIng.ingredient) {
                      const ingredient = recipeIng.ingredient;
                      const weightInKg =
                        recipeIng.quantity * ingredient.kiloPerUnit;
                      const factor = weightInKg * 10; // Convert kg to 100g units

                      recipeKJ += ingredient.kJ * factor;
                      recipeKcal += ingredient.kcal * factor;
                      recipeFat += ingredient.fat * factor;
                      recipeSaturates += ingredient.saturates * factor;
                      recipeCarbohydrate += ingredient.carbohydrate * factor;
                      recipeSugars += ingredient.sugars * factor;
                      recipeProtein += ingredient.protein * factor;
                      recipeFibre += ingredient.fibre * factor;
                      recipeSalt += ingredient.salt * factor;
                    }
                  }
                );

                // Scale to the actual product weight (e.g., 0.113kg for Bageta)
                const productWeight = weight || 0.113; // Use calculated weight or fallback
                const scaleFactor = productWeight / recipeWeightKg;

                totalKJ += recipeKJ * scaleFactor;
                totalKcal += recipeKcal * scaleFactor;
                totalFat += recipeFat * scaleFactor;
                totalSaturates += recipeSaturates * scaleFactor;
                totalCarbohydrate += recipeCarbohydrate * scaleFactor;
                totalSugars += recipeSugars * scaleFactor;
                totalProtein += recipeProtein * scaleFactor;
                totalFibre += recipeFibre * scaleFactor;
                totalSalt += recipeSalt * scaleFactor;

                console.log(
                  `Product ${productId} - Recipe weight: ${recipeWeightKg}kg, Product weight: ${productWeight}kg, Scale factor: ${scaleFactor}`
                );
              }
            });

            energeticValues.set(productId, {
              kJ: totalKJ,
              kcal: totalKcal,
              fat: totalFat,
              saturates: totalSaturates,
              carbohydrate: totalCarbohydrate,
              sugars: totalSugars,
              protein: totalProtein,
              fibre: totalFibre,
              salt: totalSalt,
            });
          }
        } catch (error) {
          console.error(
            "Error calculating energetic values for product",
            productId,
            error
          );
        }
      }

      setCalculatedWeights(weights);
      setCalculatedEnergeticValues(energeticValues);
    };

    if (productParts.length > 0) {
      calculateWeights();
    }
  }, [productParts]);

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

  const loadProductDiversification = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select(
          "baker_recipe, pastry_recipe, donut_recipe, store_recipe, non_recipe"
        )
        .eq("id", productId)
        .single();

      if (error) throw error;

      if (data) {
        setProductDiversification({
          baker_recipe: data.baker_recipe || false,
          pastry_recipe: data.pastry_recipe || false,
          donut_recipe: data.donut_recipe || false,
          store_recipe: data.store_recipe || false,
          non_recipe: data.non_recipe || false,
        });
      }
    } catch (error) {
      console.error("Error loading product diversification:", error);
    }
  };

  const addNewPart = () => {
    setIsPickerOpen(true);
  };

  const handleAddPart = (
    type: "recipe" | "product" | "ingredient",
    id: number,
    quantity: number
  ) => {
    const newPart: ProductPart = {
      product_id: productId,
      recipe_id: type === "recipe" ? id : null,
      pastry_id: type === "product" ? id : null,
      ingredient_id: type === "ingredient" ? id : null,
      quantity: quantity,
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

      // Update product diversification flags
      const { error: diversificationError } = await supabase
        .from("products")
        .update({
          baker_recipe: productDiversification.baker_recipe,
          pastry_recipe: productDiversification.pastry_recipe,
          donut_recipe: productDiversification.donut_recipe,
          store_recipe: productDiversification.store_recipe,
          non_recipe: productDiversification.non_recipe,
        })
        .eq("id", productId);

      if (diversificationError) throw diversificationError;

      // Calculate composition and allergens for the product
      const ingredientsWithElements: Array<{
        ingredient: any;
        quantity: number;
      }> = [];

      // Collect ingredients from all parts (excluding productOnly parts)
      for (const part of validParts) {
        if (part.productOnly) continue;

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
                const usedQuantity = recipeIng.quantity * part.quantity;
                ingredientsWithElements.push({
                  ingredient: recipeIng.ingredient,
                  quantity: usedQuantity,
                });
              }
            });
          }
        }

        // Handle ingredients from product parts (pastry_id)
        if (part.pastry_id) {
          try {
            // Fetch the actual product parts for this product
            const { data: subProductParts, error: subError } = await supabase
              .from("product_parts")
              .select(
                `
                *,
                recipes(name, recipe_ingredients(quantity, ingredient:ingredients(*))),
                ingredients(name, unit, element, kJ, kcal, fat, saturates, carbohydrate, sugars, protein, fibre, salt, kiloPerUnit, price)
              `
              )
              .eq("product_id", part.pastry_id);

            if (subError) throw subError;

            if (subProductParts) {
              subProductParts.forEach((subPart: any) => {
                if (subPart.productOnly) return;

                // Handle direct ingredients from sub-product
                if (subPart.ingredient_id && subPart.ingredients) {
                  const ingredient = subPart.ingredients;
                  if (
                    ingredient &&
                    ingredient.element &&
                    ingredient.element.trim() !== ""
                  ) {
                    ingredientsWithElements.push({
                      ingredient,
                      quantity: subPart.quantity * part.quantity,
                    });
                  }
                }

                // Handle recipe ingredients from sub-product
                if (
                  subPart.recipe_id &&
                  subPart.recipes &&
                  subPart.recipes.recipe_ingredients
                ) {
                  subPart.recipes.recipe_ingredients.forEach(
                    (recipeIng: any) => {
                      if (
                        recipeIng.ingredient &&
                        recipeIng.ingredient.element &&
                        recipeIng.ingredient.element.trim() !== ""
                      ) {
                        const usedQuantity =
                          recipeIng.quantity * subPart.quantity * part.quantity;
                        ingredientsWithElements.push({
                          ingredient: recipeIng.ingredient,
                          quantity: usedQuantity,
                        });
                      }
                    }
                  );
                }
              });
            }
          } catch (error) {
            console.error(
              `Error getting product parts for product ${part.pastry_id}:`,
              error
            );
          }
        }
      }

      // Process ingredients and create composition
      let compositionText = "";
      let allergensArray: string[] = [];

      if (ingredientsWithElements.length > 0) {
        // Group ingredients by name and sum quantities
        const groupedIngredients = new Map<
          string,
          { ingredient: any; quantity: number }
        >();
        ingredientsWithElements.forEach(({ ingredient, quantity }) => {
          if (groupedIngredients.has(ingredient.name)) {
            const existing = groupedIngredients.get(ingredient.name)!;
            existing.quantity += quantity;
          } else {
            groupedIngredients.set(ingredient.name, { ingredient, quantity });
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
              // Normalize common abbreviations and variations
              .replace(/\bpšen\./g, "pšeničná")
              .replace(/\bpšen\s+mouka/g, "pšeničná mouka")
              .replace(/\bpšen\.\s*mouka/g, "pšeničná mouka")
              .replace(/\bžit\./g, "žitná")
              .replace(/\bovoc\./g, "ovocný")
              .replace(/\bzelez\./g, "železitý")
              .replace(/\bkvasinky/g, "kvasinky")
              .replace(/\bbakterie/g, "bakterie")
              .replace(/\bvoda/g, "voda")
              .replace(/\bsůl/g, "sůl")
              .replace(/\bdroždí/g, "droždí")
              .replace(/\blepek/g, "lepek")
              .replace(/\bdextróza/g, "dextróza")
              .replace(/\bsyrovátka/g, "syrovátka")
              // Final cleanup
              .trim()
          );
        };

        // Deduplicate elements using normalization while preserving quantity order
        const getDeduplicatedElements = (
          ingredients: Array<{ ingredient: any; quantity: number }>
        ) => {
          // Create a map to track unique normalized elements and keep original text
          const elementMap = new Map<string, string>();
          const elementCounts = new Map<string, number>();
          const elementTotalQuantities = new Map<string, number>();

          ingredients.forEach(({ ingredient, quantity }) => {
            const originalElement = ingredient.element.trim();
            const normalizedElement = normalizeElement(originalElement);

            // Sum quantities for each normalized element
            elementTotalQuantities.set(
              normalizedElement,
              (elementTotalQuantities.get(normalizedElement) || 0) + quantity
            );

            // Count occurrences of each normalized element
            elementCounts.set(
              normalizedElement,
              (elementCounts.get(normalizedElement) || 0) + 1
            );

            // Keep the first occurrence of each normalized element
            if (!elementMap.has(normalizedElement)) {
              elementMap.set(normalizedElement, originalElement);
            }
          });

          // Get unique elements preserving original formatting
          const uniqueElements = Array.from(elementMap.values());

          // Sort elements by total quantity (descending) and then alphabetically
          const sortedElements = uniqueElements.sort((a, b) => {
            const aNormalized = normalizeElement(a);
            const bNormalized = normalizeElement(b);
            const aQuantity = elementTotalQuantities.get(aNormalized) || 0;
            const bQuantity = elementTotalQuantities.get(bNormalized) || 0;

            // First sort by total quantity (descending)
            if (aQuantity !== bQuantity) {
              return bQuantity - aQuantity;
            }

            // Then sort alphabetically
            return aNormalized.localeCompare(bNormalized);
          });

          return sortedElements.join(", ");
        };

        const mergedElements = getDeduplicatedElements(sortedIngredients);
        compositionText = mergedElements;

        // Detect allergens
        const detectedAllergens = detectAllergens(mergedElements);
        allergensArray = detectedAllergens.map((allergen) => allergen.name);
      }

      // Update the product with composition and allergens
      const { error: updateError } = await supabase
        .from("products")
        .update({
          parts: compositionText || null,
          allergens: allergensArray.length > 0 ? allergensArray : null,
        })
        .eq("id", productId);

      if (updateError) throw updateError;

      toast({
        title: "Úspěch",
        description: `Části produktu byly uloženy a složení bylo aktualizováno${compositionText ? " (" + ingredientsWithElements.length + " surovin)" : " (žádné složení)"}`,
      });

      // Invalidate product parts count query and products query
      queryClient.invalidateQueries({ queryKey: ["productPartsCount"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });

      await loadProductParts(); // Reload to get IDs

      // Close modal after successful save
      onClose();
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

  const calculateAndSaveComposition = async () => {
    if (!open || !productId) return;

    try {
      const ingredientsWithElements: Array<{
        ingredient: any;
        quantity: number;
      }> = [];

      // Collect ingredients from all parts (excluding productOnly parts)
      for (const part of productParts) {
        if (part.productOnly) continue;

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
                const usedQuantity = recipeIng.quantity * part.quantity;
                ingredientsWithElements.push({
                  ingredient: recipeIng.ingredient,
                  quantity: usedQuantity,
                });
              }
            });
          }
        }

        // Handle product parts - find the recipe used for the product
        if (part.pastry_id) {
          const product = products.find((p) => p.id === part.pastry_id);
          if (product) {
            // Find recipes that match this product's name or find the main recipe for this product
            const productRecipe = recipes.find(
              (recipe) =>
                recipe.name
                  .toLowerCase()
                  .includes(product.name.toLowerCase().split(" ")[0]) ||
                product.name
                  .toLowerCase()
                  .includes(recipe.name.toLowerCase().split(" ")[0])
            );

            if (productRecipe && productRecipe.recipe_ingredients) {
              // Use the recipe's ingredients proportionally based on the product quantity
              const recipeQuantityRatio = product.koef || 1; // Use product's koef if available
              productRecipe.recipe_ingredients.forEach((recipeIng: any) => {
                if (
                  recipeIng.ingredient &&
                  recipeIng.ingredient.element &&
                  recipeIng.ingredient.element.trim() !== ""
                ) {
                  const usedQuantity =
                    (recipeIng.quantity * part.quantity * recipeQuantityRatio) /
                    (productRecipe.quantity || 1);
                  ingredientsWithElements.push({
                    ingredient: recipeIng.ingredient,
                    quantity: usedQuantity,
                  });
                }
              });
            }
          }
        }
      }

      // Process ingredients and create composition
      let compositionText = "";
      let allergensArray: string[] = [];

      if (ingredientsWithElements.length > 0) {
        // Group ingredients by name and sum quantities
        const groupedIngredients = new Map<
          string,
          { ingredient: any; quantity: number }
        >();
        ingredientsWithElements.forEach(({ ingredient, quantity }) => {
          if (groupedIngredients.has(ingredient.name)) {
            const existing = groupedIngredients.get(ingredient.name)!;
            existing.quantity += quantity;
          } else {
            groupedIngredients.set(ingredient.name, { ingredient, quantity });
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
              // Normalize common abbreviations and variations
              .replace(/\bpšen\./g, "pšeničná")
              .replace(/\bpšen\s+mouka/g, "pšeničná mouka")
              .replace(/\bpšen\.\s*mouka/g, "pšeničná mouka")
              .replace(/\bžit\./g, "žitná")
              .replace(/\bovoc\./g, "ovocný")
              .replace(/\bzelez\./g, "železitý")
              .replace(/\bkvasinky/g, "kvasinky")
              .replace(/\bbakterie/g, "bakterie")
              .replace(/\bvoda/g, "voda")
              .replace(/\bsůl/g, "sůl")
              .replace(/\bdroždí/g, "droždí")
              .replace(/\blepek/g, "lepek")
              .replace(/\bdextróza/g, "dextróza")
              .replace(/\bsyrovátka/g, "syrovátka")
              // Final cleanup
              .trim()
          );
        };

        // Deduplicate elements using normalization while preserving quantity order
        const getDeduplicatedElements = (
          ingredients: Array<{ ingredient: any; quantity: number }>
        ) => {
          // Create a map to track unique normalized elements and keep original text
          const elementMap = new Map<string, string>();
          const elementCounts = new Map<string, number>();
          const elementTotalQuantities = new Map<string, number>();

          ingredients.forEach(({ ingredient, quantity }) => {
            const originalElement = ingredient.element.trim();
            const normalizedElement = normalizeElement(originalElement);

            // Sum quantities for each normalized element
            elementTotalQuantities.set(
              normalizedElement,
              (elementTotalQuantities.get(normalizedElement) || 0) + quantity
            );

            // Count occurrences of each normalized element
            elementCounts.set(
              normalizedElement,
              (elementCounts.get(normalizedElement) || 0) + 1
            );

            // Keep the first occurrence of each normalized element
            if (!elementMap.has(normalizedElement)) {
              elementMap.set(normalizedElement, originalElement);
            }
          });

          // Get unique elements preserving original formatting
          const uniqueElements = Array.from(elementMap.values());

          // Sort elements by total quantity (descending) and then alphabetically
          const sortedElements = uniqueElements.sort((a, b) => {
            const aNormalized = normalizeElement(a);
            const bNormalized = normalizeElement(b);
            const aQuantity = elementTotalQuantities.get(aNormalized) || 0;
            const bQuantity = elementTotalQuantities.get(bNormalized) || 0;

            // First sort by total quantity (descending)
            if (aQuantity !== bQuantity) {
              return bQuantity - aQuantity;
            }

            // Then sort alphabetically
            return aNormalized.localeCompare(bNormalized);
          });

          return sortedElements.join(", ");
        };

        const mergedElements = getDeduplicatedElements(sortedIngredients);
        compositionText = mergedElements;

        // Detect allergens
        const detectedAllergens = detectAllergens(mergedElements);
        allergensArray = detectedAllergens.map((allergen) => allergen.name);
      }

      // Update the product with composition and allergens
      const { error: updateError } = await supabase
        .from("products")
        .update({
          parts: compositionText || null,
          allergens: allergensArray.length > 0 ? allergensArray : null,
        })
        .eq("id", productId);

      if (updateError) throw updateError;

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["productPartsCount"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (error) {
      console.error("Error calculating and saving composition:", error);
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
      if (recipe && recipe.price) {
        // Calculate recipe price per kg by dividing total price by total weight
        let recipePricePerKg = 0;

        // Calculate total weight and price from recipe ingredients
        let totalRecipeWeight = 0;
        let totalRecipePrice = 0;

        // Get recipe ingredients from the recipes data
        const recipeIngredients = recipe.recipe_ingredients || [];
        recipeIngredients.forEach((recipeIng: any) => {
          if (recipeIng.ingredient_id && recipeIng.quantity > 0) {
            const ingredient = ingredients.find(
              (i) => i.id === recipeIng.ingredient_id
            );
            if (ingredient) {
              const weightInKg = recipeIng.quantity * ingredient.kiloPerUnit;
              totalRecipeWeight += weightInKg;

              if (ingredient.price) {
                totalRecipePrice += weightInKg * ingredient.price;
              }
            }
          }
        });

        // Calculate price per kg
        if (totalRecipeWeight > 0) {
          recipePricePerKg = totalRecipePrice / totalRecipeWeight;
        } else {
          // Fallback to stored recipe price if no ingredients found
          recipePricePerKg = recipe.price;
        }

        console.log(`=== RECIPE PART PRICE CALCULATION ===`);
        console.log(`Recipe name: ${recipe.name}`);
        console.log(`Total recipe price: ${totalRecipePrice} Kč`);
        console.log(`Total recipe weight: ${totalRecipeWeight} kg`);
        console.log(`Recipe price per kg: ${recipePricePerKg} Kč/kg`);
        console.log(`Part quantity: ${part.quantity} kg`);
        console.log(
          `Calculation: ${recipePricePerKg} Kč/kg × ${part.quantity} kg = ${recipePricePerKg * part.quantity} Kč`
        );
        console.log(`Final price: ${recipePricePerKg * part.quantity} Kč`);
        console.log(`=== END RECIPE PART PRICE CALCULATION ===`);

        return recipePricePerKg * part.quantity;
      }
      return 0;
    }
    if (part.pastry_id) {
      const product = products.find((p) => p.id === part.pastry_id);
      return product?.priceBuyer ? product.priceBuyer * part.quantity : 0;
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

  // Handle product diversification checkbox changes
  const handleDiversificationChange = (
    field: keyof typeof productDiversification,
    checked: boolean
  ) => {
    setProductDiversification((prev) => {
      if (field === "non_recipe" && checked) {
        // When non_recipe is checked, uncheck all others
        return {
          baker_recipe: false,
          pastry_recipe: false,
          donut_recipe: false,
          store_recipe: false,
          non_recipe: true,
        };
      } else if (field === "non_recipe" && !checked) {
        // When non_recipe is unchecked, just update it
        return {
          ...prev,
          non_recipe: false,
        };
      } else if (checked) {
        // When any other checkbox is checked, uncheck non_recipe
        return {
          ...prev,
          [field]: true,
          non_recipe: false,
        };
      } else {
        // When any other checkbox is unchecked, just update it
        return {
          ...prev,
          [field]: false,
        };
      }
    });
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

        {/* Product Diversification Section */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-md">Zobrazení v receptech</CardTitle>
            <CardDescription>
              Označte typy receptů pro tento produkt
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="baker_recipe"
                  checked={productDiversification.baker_recipe}
                  onCheckedChange={(checked) =>
                    handleDiversificationChange(
                      "baker_recipe",
                      checked as boolean
                    )
                  }
                />
                <Label htmlFor="baker_recipe" className="text-sm">
                  Pekaři
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pastry_recipe"
                  checked={productDiversification.pastry_recipe}
                  onCheckedChange={(checked) =>
                    handleDiversificationChange(
                      "pastry_recipe",
                      checked as boolean
                    )
                  }
                />
                <Label htmlFor="pastry_recipe" className="text-sm">
                  Cukráři
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="donut_recipe"
                  checked={productDiversification.donut_recipe}
                  onCheckedChange={(checked) =>
                    handleDiversificationChange(
                      "donut_recipe",
                      checked as boolean
                    )
                  }
                />
                <Label htmlFor="donut_recipe" className="text-sm">
                  Koblihy
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="store_recipe"
                  checked={productDiversification.store_recipe}
                  onCheckedChange={(checked) =>
                    handleDiversificationChange(
                      "store_recipe",
                      checked as boolean
                    )
                  }
                />
                <Label htmlFor="store_recipe" className="text-sm">
                  Prodejny
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="non_recipe"
                  checked={productDiversification.non_recipe}
                  onCheckedChange={(checked) =>
                    handleDiversificationChange(
                      "non_recipe",
                      checked as boolean
                    )
                  }
                />
                <Label htmlFor="non_recipe" className="text-sm">
                  Bez receptu
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

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
                      <TableHead>Název</TableHead>
                      <TableHead className="text-right">Množství</TableHead>
                      <TableHead>Jedn.</TableHead>
                      <TableHead className="w-[120px] text-right">
                        Cena
                      </TableHead>
                      <TableHead className="w-[100px] text-center">
                        Produkt prodejny
                      </TableHead>
                      <TableHead className="text-right">Akce</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productParts.map((part, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {part.recipe_id && (
                              <>
                                <span className="font-medium">
                                  {recipes.find((r) => r.id === part.recipe_id)
                                    ?.name || "Neznámý recept"}
                                </span>
                                <span className="text-xs text-muted-foreground bg-blue-100 px-2 py-1 rounded">
                                  Recept
                                </span>
                              </>
                            )}
                            {part.pastry_id && (
                              <>
                                <span className="font-medium">
                                  {products.find((p) => p.id === part.pastry_id)
                                    ?.name || "Neznámý produkt"}
                                </span>
                                <span className="text-xs text-muted-foreground bg-green-100 px-2 py-1 rounded">
                                  Produkt
                                </span>
                              </>
                            )}
                            {part.ingredient_id && (
                              <>
                                <span className="font-medium">
                                  {ingredients.find(
                                    (i) => i.id === part.ingredient_id
                                  )?.name || "Neznámá surovina"}
                                </span>
                                <span className="text-xs text-muted-foreground bg-orange-100 px-2 py-1 rounded">
                                  Surovina
                                </span>
                              </>
                            )}
                            {!part.recipe_id &&
                              !part.pastry_id &&
                              !part.ingredient_id && (
                                <span className="text-muted-foreground">
                                  Vyberte typ a položku
                                </span>
                              )}
                          </div>
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
                        <TableCell className="text-center">
                          {(part.pastry_id || part.recipe_id) && (
                            <input
                              type="checkbox"
                              checked={part.productOnly || false}
                              onChange={(e) =>
                                updatePart(
                                  index,
                                  "productOnly",
                                  e.target.checked
                                )
                              }
                              className="rounded"
                            />
                          )}
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <List className="h-5 w-5" />
                  Složení všech surovin produktu
                </CardTitle>
              </div>
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

                  // Handle elements from product parts
                  if (part.pastry_id) {
                    const product = products.find(
                      (p) => p.id === part.pastry_id
                    );
                    if (
                      product &&
                      product.parts &&
                      product.parts.trim() !== ""
                    ) {
                      // Split the stored composition into individual elements
                      const elements = product.parts
                        .split(",")
                        .map((el: string) => el.trim());
                      elements.forEach((element: string) => {
                        if (element && element.trim() !== "") {
                          // Create a pseudo-ingredient object for the element
                          const pseudoIngredient = {
                            name: element,
                            element: element,
                          };
                          ingredientsWithElements.push({
                            ingredient: pseudoIngredient,
                            quantity: part.quantity, // Use the product quantity
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
                      // Normalize common abbreviations and variations
                      .replace(/\bpšen\./g, "pšeničná")
                      .replace(/\bpšen\s+mouka/g, "pšeničná mouka")
                      .replace(/\bpšen\.\s*mouka/g, "pšeničná mouka")
                      .replace(/\bžit\./g, "žitná")
                      .replace(/\bovoc\./g, "ovocný")
                      .replace(/\bzelez\./g, "železitý")
                      .replace(/\bkvasinky/g, "kvasinky")
                      .replace(/\bbakterie/g, "bakterie")
                      .replace(/\bvoda/g, "voda")
                      .replace(/\bsůl/g, "sůl")
                      .replace(/\bdroždí/g, "droždí")
                      .replace(/\blepek/g, "lepek")
                      .replace(/\bdextróza/g, "dextróza")
                      .replace(/\bsyrovátka/g, "syrovátka")
                      // Final cleanup
                      .trim()
                  );
                };

                // Deduplicate elements using normalization while preserving quantity order
                const getDeduplicatedElements = (
                  ingredients: Array<{ ingredient: any; quantity: number }>
                ) => {
                  // Create a map to track unique normalized elements and keep original text
                  const elementMap = new Map<string, string>();
                  const elementCounts = new Map<string, number>();
                  const elementTotalQuantities = new Map<string, number>();

                  ingredients.forEach(({ ingredient, quantity }) => {
                    const originalElement = ingredient.element.trim();
                    const normalizedElement = normalizeElement(originalElement);

                    // Sum quantities for each normalized element
                    elementTotalQuantities.set(
                      normalizedElement,
                      (elementTotalQuantities.get(normalizedElement) || 0) +
                        quantity
                    );

                    // Count occurrences of each normalized element
                    elementCounts.set(
                      normalizedElement,
                      (elementCounts.get(normalizedElement) || 0) + 1
                    );

                    // Keep the first occurrence of each normalized element
                    if (!elementMap.has(normalizedElement)) {
                      elementMap.set(normalizedElement, originalElement);
                    }
                  });

                  // Get unique elements preserving original formatting
                  const uniqueElements = Array.from(elementMap.values());

                  // Sort elements by total quantity (descending) and then alphabetically
                  const sortedElements = uniqueElements.sort((a, b) => {
                    const aNormalized = normalizeElement(a);
                    const bNormalized = normalizeElement(b);
                    const aQuantity =
                      elementTotalQuantities.get(aNormalized) || 0;
                    const bQuantity =
                      elementTotalQuantities.get(bNormalized) || 0;

                    // First sort by total quantity (descending)
                    if (aQuantity !== bQuantity) {
                      return bQuantity - aQuantity;
                    }

                    // Then sort alphabetically
                    return aNormalized.localeCompare(bNormalized);
                  });

                  return sortedElements.join(", ");
                };

                const mergedElements =
                  getDeduplicatedElements(sortedIngredients);

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
                    {detectAllergens(mergedElements).length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-semibold text-red-800 mb-2 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Detekované alergeny:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {detectAllergens(mergedElements).map(
                            (allergen, index) => {
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
                            }
                          )}
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
                // Check if any ingredients are missing energetic values
                const missingEnergeticValues = productParts
                  .filter((part) => part.ingredient_id && !part.productOnly)
                  .map((part) => {
                    const ingredient = ingredients.find(
                      (i) => i.id === part.ingredient_id
                    );
                    return ingredient &&
                      (ingredient.kJ === 0 || ingredient.kcal === 0)
                      ? ingredient.name
                      : null;
                  })
                  .filter(Boolean);

                // Check if any products are missing energetic values and elements
                const missingProductData = productParts
                  .filter((part) => part.pastry_id && !part.productOnly)
                  .map((part) => {
                    const product = products.find(
                      (p) => p.id === part.pastry_id
                    );
                    const hasEnergeticValues = calculatedEnergeticValues.has(
                      product?.id || 0
                    );
                    const hasElements =
                      product && product.parts && product.parts.trim() !== "";
                    return product && (!hasEnergeticValues || !hasElements)
                      ? {
                          name: product.name,
                          missingEnergetic: !hasEnergeticValues,
                          missingElements: !hasElements,
                        }
                      : null;
                  })
                  .filter(Boolean);

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

                // Array to store nutritional breakdown for each part (for tooltips)
                const partBreakdown: Array<{
                  name: string;
                  type: string;
                  quantity: number;
                  unit: string;
                  weightKg: number;
                  kJ: number;
                  kcal: number;
                  fat: number;
                  saturates: number;
                  carbohydrate: number;
                  sugars: number;
                  protein: number;
                  fibre: number;
                  salt: number;
                }> = [];

                // Calculate nutritional values from all parts (excluding productOnly)
                productParts.forEach((part) => {
                  if (part.productOnly) return; // Skip productOnly parts

                  partsCount++;

                  // Handle recipe parts
                  if (part.recipe_id) {
                    const recipe = recipes.find((r) => r.id === part.recipe_id);
                    if (recipe && recipe.recipe_ingredients) {
                      console.log("=== RECIPE PART ===");
                      console.log("Recipe name:", recipe.name);
                      console.log("Part quantity:", part.quantity, "kg");

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
                        const partWeightKg = part.quantity;
                        const partKJ = recipeKJ * proportion;
                        const partKcal = recipeKcal * proportion;
                        const partFat = recipeFat * proportion;
                        const partSaturates = recipeSaturates * proportion;
                        const partCarbohydrate =
                          recipeCarbohydrate * proportion;
                        const partSugars = recipeSugars * proportion;
                        const partProtein = recipeProtein * proportion;
                        const partFibre = recipeFibre * proportion;
                        const partSalt = recipeSalt * proportion;

                        console.log("Recipe energetic contribution:", {
                          weight: partWeightKg,
                          kJ: partKJ,
                          kcal: partKcal,
                          fat: partFat,
                          protein: partProtein,
                          proportion: proportion,
                        });

                        // Add to totals
                        totalWeightKg += partWeightKg;
                        totalKJ += partKJ;
                        totalKcal += partKcal;
                        totalFat += partFat;
                        totalSaturates += partSaturates;
                        totalCarbohydrate += partCarbohydrate;
                        totalSugars += partSugars;
                        totalProtein += partProtein;
                        totalFibre += partFibre;
                        totalSalt += partSalt;

                        // Store for tooltip
                        partBreakdown.push({
                          name: recipe.name,
                          type: "Recept",
                          quantity: part.quantity,
                          unit: "kg",
                          weightKg: partWeightKg,
                          kJ: partKJ,
                          kcal: partKcal,
                          fat: partFat,
                          saturates: partSaturates,
                          carbohydrate: partCarbohydrate,
                          sugars: partSugars,
                          protein: partProtein,
                          fibre: partFibre,
                          salt: partSalt,
                        });
                      }
                      console.log("===================");
                    }
                  }

                  // Handle ingredient parts
                  if (part.ingredient_id) {
                    const ingredient = ingredients.find(
                      (i) => i.id === part.ingredient_id
                    );
                    if (ingredient) {
                      console.log("=== INGREDIENT PART ===");
                      console.log("Ingredient name:", ingredient.name);
                      console.log(
                        "Part quantity:",
                        part.quantity,
                        ingredient.unit
                      );

                      const weightInKg = part.quantity * ingredient.kiloPerUnit;
                      const factor = weightInKg * 10; // Convert kg to 100g units
                      const partKJ = ingredient.kJ * factor;
                      const partKcal = ingredient.kcal * factor;
                      const partFat = ingredient.fat * factor;
                      const partSaturates = ingredient.saturates * factor;
                      const partCarbohydrate = ingredient.carbohydrate * factor;
                      const partSugars = ingredient.sugars * factor;
                      const partProtein = ingredient.protein * factor;
                      const partFibre = ingredient.fibre * factor;
                      const partSalt = ingredient.salt * factor;

                      console.log("Ingredient energetic contribution:", {
                        weight: weightInKg,
                        kJ: partKJ,
                        kcal: partKcal,
                        fat: partFat,
                        protein: partProtein,
                        kiloPerUnit: ingredient.kiloPerUnit,
                      });

                      // Add to totals
                      totalWeightKg += weightInKg;
                      totalKJ += partKJ;
                      totalKcal += partKcal;
                      totalFat += partFat;
                      totalSaturates += partSaturates;
                      totalCarbohydrate += partCarbohydrate;
                      totalSugars += partSugars;
                      totalProtein += partProtein;
                      totalFibre += partFibre;
                      totalSalt += partSalt;

                      // Store for tooltip
                      partBreakdown.push({
                        name: ingredient.name,
                        type: "Surovina",
                        quantity: part.quantity,
                        unit: ingredient.unit,
                        weightKg: weightInKg,
                        kJ: partKJ,
                        kcal: partKcal,
                        fat: partFat,
                        saturates: partSaturates,
                        carbohydrate: partCarbohydrate,
                        sugars: partSugars,
                        protein: partProtein,
                        fibre: partFibre,
                        salt: partSalt,
                      });
                      console.log("=======================");
                    }
                  }

                  // Handle pastry/product parts - use actual product data
                  if (part.pastry_id) {
                    const product = products.find(
                      (p) => p.id === part.pastry_id
                    );
                    console.log("=== PRODUCT PART ===");
                    console.log("Product name:", product?.name);
                    console.log("Part quantity:", part.quantity, "ks");

                    if (product) {
                      console.log("Product details:", {
                        id: product.id,
                        name: product.name,
                        koef: product.koef,
                        price: product.price,
                        priceBuyer: product.priceBuyer,
                        category_id: product.category_id,
                        parts: product.parts,
                        allergens: product.allergens,
                        active: product.active,
                      });
                      console.log("=== PRODUCT PART DEBUG ===");
                      console.log("Product:", product.name);
                      console.log("Product koef:", product.koef);
                      console.log("Part quantity:", part.quantity);

                      // Use realistic weight per piece for products (not 1kg per piece!)
                      // Most bakery products weigh between 50g-300g per piece
                      let weightPerPiece = 0.15; // Default 150g per piece

                      // First priority: Use calculated weight from recipe ingredients
                      const calculatedWeight = calculatedWeights.get(
                        product.id
                      );
                      if (calculatedWeight && calculatedWeight > 0) {
                        weightPerPiece = calculatedWeight;
                        console.log(
                          "Using calculated weight from recipe:",
                          weightPerPiece,
                          "kg"
                        );
                      } else {
                        // Second priority: Extract weight from product name (e.g., "Bageta 110g" -> 0.11kg)
                        const weightMatch = product.name.match(/(\d+)\s*g/i);
                        if (weightMatch) {
                          const weightInGrams = parseInt(weightMatch[1]);
                          weightPerPiece = weightInGrams / 1000; // Convert grams to kg
                          console.log(
                            "Extracted weight from name:",
                            weightPerPiece,
                            "kg"
                          );
                        }
                        // Third priority: Use product's koef if it represents realistic weight
                        else if (
                          product.koef &&
                          product.koef > 0 &&
                          product.koef < 1
                        ) {
                          weightPerPiece = product.koef; // koef represents weight in kg
                          console.log("Using koef as weight:", weightPerPiece);
                        } else {
                          // Fourth priority: Estimate weight based on product name
                          const productName = product.name.toLowerCase();
                          console.log("Product name (lowercase):", productName);

                          if (
                            productName.includes("bageta") ||
                            productName.includes("chléb")
                          ) {
                            weightPerPiece = 0.25; // 250g for bread/bageta
                            console.log("Detected product type: BAGETA/CHLÉB");
                          } else if (
                            productName.includes("rohlík") ||
                            productName.includes("houska")
                          ) {
                            weightPerPiece = 0.06; // 60g for rolls
                            console.log("Detected product type: ROHLÍK/HOUSKA");
                          } else if (
                            productName.includes("koláč") ||
                            productName.includes("dort")
                          ) {
                            weightPerPiece = 0.4; // 400g for cakes
                            console.log("Detected product type: KOLÁČ/DORT");
                          } else if (
                            productName.includes("buchta") ||
                            productName.includes("závin")
                          ) {
                            weightPerPiece = 0.3; // 300g for pastries
                            console.log("Detected product type: BUCHTA/ZÁVIN");
                          } else if (
                            productName.includes("keks") ||
                            productName.includes("sušenka")
                          ) {
                            weightPerPiece = 0.02; // 20g for cookies
                            console.log("Detected product type: KEKS/SUŠENKA");
                          } else if (
                            productName.includes("croissant") ||
                            productName.includes("donut")
                          ) {
                            weightPerPiece = 0.08; // 80g for croissants/donuts
                            console.log(
                              "Detected product type: CROISSANT/DONUT"
                            );
                          } else {
                            console.log(
                              "Detected product type: DEFAULT (150g)"
                            );
                          }
                          console.log(
                            "Estimated weight per piece:",
                            weightPerPiece
                          );
                        }
                      }

                      const partWeightKg = part.quantity * weightPerPiece;
                      console.log("Calculated part weight (kg):", partWeightKg);
                      console.log("Product composition:", product.parts);
                      console.log("==============================");

                      // Calculate energetic values from product's recipe ingredients
                      let partKJ = 0;
                      let partKcal = 0;
                      let partFat = 0;
                      let partSaturates = 0;
                      let partCarbohydrate = 0;
                      let partSugars = 0;
                      let partProtein = 0;
                      let partFibre = 0;
                      let partSalt = 0;

                      // Use calculated energetic values from recipe if available
                      const calculatedEnergetic = calculatedEnergeticValues.get(
                        product.id
                      );
                      if (calculatedEnergetic) {
                        console.log(
                          "Using calculated energetic values from recipe for product:",
                          product.name
                        );

                        // Find the recipe part for this product to get the actual quantity used
                        const recipePart = productParts.find(
                          (p) => p.pastry_id === product.id
                        );
                        if (recipePart) {
                          // Scale the already calculated energetic values based on the quantity being used
                          // calculatedEnergetic values are already per piece (e.g., per 0.113kg bageta)
                          // recipePart.quantity is how many pieces we're using
                          const quantityMultiplier = recipePart.quantity; // e.g., 2 pieces = multiply by 2

                          partKJ = calculatedEnergetic.kJ * quantityMultiplier;
                          partKcal =
                            calculatedEnergetic.kcal * quantityMultiplier;
                          partFat =
                            calculatedEnergetic.fat * quantityMultiplier;
                          partSaturates =
                            calculatedEnergetic.saturates * quantityMultiplier;
                          partCarbohydrate =
                            calculatedEnergetic.carbohydrate *
                            quantityMultiplier;
                          partSugars =
                            calculatedEnergetic.sugars * quantityMultiplier;
                          partProtein =
                            calculatedEnergetic.protein * quantityMultiplier;
                          partFibre =
                            calculatedEnergetic.fibre * quantityMultiplier;
                          partSalt =
                            calculatedEnergetic.salt * quantityMultiplier;

                          console.log(
                            "Using calculated energetic values from recipe directly:",
                            {
                              kJ: partKJ,
                              kcal: partKcal,
                              fat: partFat,
                              protein: partProtein,
                              productWeight: partWeightKg,
                              quantity: recipePart.quantity,
                              quantityMultiplier,
                            }
                          );

                          console.log("Product energetic contribution:", {
                            weight: partWeightKg,
                            kJ: partKJ,
                            kcal: partKcal,
                            fat: partFat,
                            protein: partProtein,
                            quantity: recipePart.quantity,
                          });
                        } else {
                          // Fallback if recipe part not found
                          const factor = partWeightKg * 10;
                          partKJ = (1200 * factor) / 10;
                          partKcal = (280 * factor) / 10;
                          partFat = (3 * factor) / 10;
                          partSaturates = (1 * factor) / 10;
                          partCarbohydrate = (55 * factor) / 10;
                          partSugars = (3 * factor) / 10;
                          partProtein = (9 * factor) / 10;
                          partFibre = (3 * factor) / 10;
                          partSalt = (1 * factor) / 10;
                        }
                      } else {
                        console.log("No recipe found, using estimated values");
                        // Fallback to estimated values if no recipe found
                        const factor = partWeightKg * 10; // Convert kg to 100g units
                        partKJ = (1200 * factor) / 10; // Default bread values
                        partKcal = (280 * factor) / 10;
                        partFat = (3 * factor) / 10;
                        partSaturates = (1 * factor) / 10;
                        partCarbohydrate = (55 * factor) / 10;
                        partSugars = (3 * factor) / 10;
                        partProtein = (9 * factor) / 10;
                        partFibre = (3 * factor) / 10;
                        partSalt = (1 * factor) / 10;
                      }

                      // Add to totals
                      totalWeightKg += partWeightKg;
                      totalKJ += partKJ;
                      totalKcal += partKcal;
                      totalFat += partFat;
                      totalSaturates += partSaturates;
                      totalCarbohydrate += partCarbohydrate;
                      totalSugars += partSugars;
                      totalProtein += partProtein;
                      totalFibre += partFibre;
                      totalSalt += partSalt;

                      // Store for tooltip
                      partBreakdown.push({
                        name: product.name,
                        type: "Produkt",
                        quantity: part.quantity,
                        unit: "ks",
                        weightKg: partWeightKg,
                        kJ: partKJ,
                        kcal: partKcal,
                        fat: partFat,
                        saturates: partSaturates,
                        carbohydrate: partCarbohydrate,
                        sugars: partSugars,
                        protein: partProtein,
                        fibre: partFibre,
                        salt: partSalt,
                      });
                      console.log("====================");
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

                // Helper function to create tooltip content
                const createNutrientTooltip = (
                  nutrientName: string,
                  getValue: (part: any) => number
                ) => {
                  return (
                    <div className="space-y-1 text-xs">
                      <div className="font-semibold border-b pb-1">
                        {nutrientName} - Rozložení podle částí:
                      </div>
                      {partBreakdown.map((part, index) => {
                        const value = getValue(part);
                        const per100g =
                          part.weightKg > 0 ? (value / part.weightKg) * 0.1 : 0;
                        return (
                          <div
                            key={index}
                            className="flex justify-between items-center"
                          >
                            <span className="text-gray-600">
                              {part.name} ({part.type})
                            </span>
                            <span className="font-medium">
                              {per100g.toFixed(1)}/100g ({value.toFixed(1)}{" "}
                              celkem)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                };

                return (
                  <TooltipProvider>
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
                            {(() => {
                              // Reference intake values

                              const referenceKcal = 2000;

                              // Calculate percentage of reference intake
                              const percentageKcal =
                                (totalKcal / referenceKcal) * 100;

                              // Determine color based on percentage
                              const getEnergyColor = (percentage: number) => {
                                if (percentage >= 50) return "text-red-600"; // High energy (>50% of daily intake)
                                if (percentage >= 25) return "text-orange-600"; // Medium energy (25-50% of daily intake)
                                return "text-green-600"; // Low energy (<25% of daily intake)
                              };

                              const energyColor =
                                getEnergyColor(percentageKcal);

                              return (
                                <div className="flex items-center gap-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        className={`font-semibold cursor-help underline decoration-dotted ${energyColor}`}
                                      >
                                        {totalKJ.toFixed(0)} KJ /{" "}
                                        {totalKcal.toFixed(0)} Kcal
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {createNutrientTooltip(
                                        "Energie",
                                        (part) => part.kcal
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                  <span
                                    className={`text-xs px-2 py-1 rounded-full ${energyColor.replace("text-", "bg-").replace("-600", "-100")} ${energyColor}`}
                                  >
                                    {percentageKcal.toFixed(0)}% RI
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Energie na 100g:
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="font-semibold text-green-800 cursor-help underline decoration-dotted">
                                  {energyPer100gKJ.toFixed(0)} KJ /{" "}
                                  {energyPer100gKcal.toFixed(0)} Kcal
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {createNutrientTooltip(
                                  "Energie na 100g",
                                  (part) => part.kcal
                                )}
                              </TooltipContent>
                            </Tooltip>
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
                                  thresholds[
                                    nutrient as keyof typeof thresholds
                                  ];
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
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        className={`p-3 rounded-lg cursor-help ${getTrafficLightColor("fat", fatPer100g)}`}
                                      >
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="font-medium">
                                            Tuky
                                          </span>
                                          <span className="text-xs opacity-90">
                                            {getRIPercentage("fat", fatPer100g)}
                                            % RI*
                                          </span>
                                        </div>
                                        <div className="font-bold">
                                          {fatPer100g.toFixed(1)}g
                                        </div>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {createNutrientTooltip(
                                        "Tuky",
                                        (part) => part.fat
                                      )}
                                    </TooltipContent>
                                  </Tooltip>

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
                                        {getRIPercentage(
                                          "sugars",
                                          sugarsPer100g
                                        )}
                                        % RI*
                                      </span>
                                    </div>
                                    <div className="font-bold">
                                      {sugarsPer100g.toFixed(1)}g
                                    </div>
                                  </div>

                                  {/* Protein */}
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        className={`p-3 rounded-lg cursor-help ${getTrafficLightColor("protein", proteinPer100g)}`}
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
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {createNutrientTooltip(
                                        "Bílkoviny",
                                        (part) => part.protein
                                      )}
                                    </TooltipContent>
                                  </Tooltip>

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
                                *RI = Referenční příjem průměrného dospělého
                                (8400 kJ/2000 kcal)
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

                                  navigator.clipboard.writeText(
                                    nutritionalText
                                  );
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
                        Vypočítáno z {partsCount} částí produktu (včetně receptů
                        a částí produktů, bez produktů označených pouze pro
                        prodejnu)
                      </div>

                      {/* Warning for missing energetic values */}
                      {missingEnergeticValues.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-orange-200">
                          <div className="text-xs font-semibold text-orange-800 mb-2 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Chybí výživové hodnoty pro některé suroviny:
                          </div>
                          <div className="text-xs text-orange-700">
                            {missingEnergeticValues.join(", ")}
                          </div>
                          <div className="text-xs text-orange-500 mt-1">
                            Výživové hodnoty mohou být nepřesné kvůli chybějícím
                            údajům.
                          </div>
                        </div>
                      )}
                      {missingProductData.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-orange-200">
                          <div className="text-xs font-semibold text-orange-800 mb-2 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Chybí výživové hodnoty nebo složení pro některé
                            produkty:
                          </div>
                          <div className="text-xs text-orange-700 space-y-1">
                            {missingProductData.map((product) => (
                              <div
                                key={product?.name}
                                className="flex items-center gap-2"
                              >
                                <span>• {product?.name}</span>
                                <span className="text-orange-500">
                                  {product?.missingEnergetic &&
                                  product?.missingElements
                                    ? "(chybí výživové hodnoty i složení)"
                                    : product?.missingEnergetic
                                      ? "(chybí výživové hodnoty)"
                                      : "(chybí složení)"}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="text-xs text-orange-500 mt-1">
                            Výživové hodnoty mohou být nepřesné kvůli chybějícím
                            údajům.
                          </div>
                        </div>
                      )}
                    </div>
                  </TooltipProvider>
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
      <PartPickerModal
        open={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onPick={handleAddPart}
        recipes={recipes}
        products={products}
        ingredients={ingredients}
        productPartsMap={productPartsMap}
      />
    </Dialog>
  );
}

// New modal component for picking parts (recipes, products, ingredients)
function PartPickerModal({
  open,
  onClose,
  onPick,
  recipes,
  products,
  ingredients,
  productPartsMap,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (
    type: "recipe" | "product" | "ingredient",
    id: number,
    quantity: number
  ) => void;
  recipes: any[];
  products: any[];
  ingredients: any[];
  productPartsMap: Map<number, boolean>;
}) {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<
    "recipe" | "product" | "ingredient" | null
  >(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter items based on search and selected type
  const filteredItems = useMemo(() => {
    if (!selectedType) return [];

    const searchLower = removeDiacritics(search.toLowerCase());

    switch (selectedType) {
      case "recipe":
        return recipes.filter((recipe) => {
          const nameMatch = removeDiacritics(
            recipe.name.toLowerCase()
          ).includes(searchLower);
          const noteMatch = recipe.note
            ? removeDiacritics(recipe.note.toLowerCase()).includes(searchLower)
            : false;
          return nameMatch || noteMatch;
        });
      case "product":
        return products.filter((product) => {
          const nameMatch = removeDiacritics(
            product.name?.toLowerCase() || ""
          ).includes(searchLower);
          const nameViMatch = removeDiacritics(
            product.nameVi?.toLowerCase() || ""
          ).includes(searchLower);
          const descriptionMatch = removeDiacritics(
            product.description?.toLowerCase() || ""
          ).includes(searchLower);
          const idMatch = product.id?.toString().includes(search);
          const printIdMatch = product.printId?.toString().includes(search);
          return (
            nameMatch ||
            nameViMatch ||
            descriptionMatch ||
            idMatch ||
            printIdMatch
          );
        });
      case "ingredient":
        return ingredients.filter((ingredient) => {
          const nameMatch = removeDiacritics(
            ingredient.name.toLowerCase()
          ).includes(searchLower);
          const unitMatch = removeDiacritics(
            ingredient.unit?.toLowerCase() || ""
          ).includes(searchLower);
          return nameMatch || unitMatch;
        });
      default:
        return [];
    }
  }, [search, selectedType, recipes, products, ingredients]);

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedType(null);
      setSelectedId(null);
      setQuantity(1);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleTypeSelect = (type: "recipe" | "product" | "ingredient") => {
    setSelectedType(type);
    setSelectedId(null);
    setSearch("");
  };

  const handleItemSelect = (id: number) => {
    setSelectedId(id);
  };

  const handleAdd = () => {
    if (selectedType && selectedId && quantity > 0) {
      onPick(selectedType, selectedId, quantity);
      onClose();
    }
  };

  const getItemName = (item: any) => {
    switch (selectedType) {
      case "recipe":
        return item.name;
      case "product":
        return item.name;
      case "ingredient":
        return item.name;
      default:
        return "";
    }
  };

  const getItemUnit = (item: any) => {
    switch (selectedType) {
      case "recipe":
        return "kg";
      case "product":
        return "ks";
      case "ingredient":
        return item.unit;
      default:
        return "";
    }
  };

  const getItemWarning = (item: any) => {
    switch (selectedType) {
      case "recipe":
        if (!item.recipe_ingredients || item.recipe_ingredients.length === 0) {
          return { type: "error", message: "Recept nemá suroviny" };
        }
        const missingElements = item.recipe_ingredients.some(
          (recipeIng: any) =>
            !recipeIng.ingredient?.element ||
            recipeIng.ingredient.element.trim() === ""
        );
        const missingEnergetic = item.recipe_ingredients.some(
          (recipeIng: any) =>
            !recipeIng.ingredient?.kJ || recipeIng.ingredient.kJ <= 0
        );
        if (missingElements)
          return { type: "warning", message: "Chybí složení" };
        if (missingEnergetic)
          return { type: "error", message: "Chybí výživové hodnoty" };
        return null;
      case "product":
        const hasProductParts = productPartsMap.get(item.id) || false;
        if (!hasProductParts)
          return { type: "warning", message: "Nemá definované části" };
        if (!item.parts || item.parts.trim() === "")
          return { type: "warning", message: "Chybí složení" };
        return null;
      case "ingredient":
        if (!item.element || item.element.trim() === "")
          return { type: "warning", message: "Chybí složení" };
        if (!item.kJ || item.kJ <= 0)
          return { type: "error", message: "Chybí výživové hodnoty" };
        return null;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Přidat část produktu</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Type Selection */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={selectedType === "recipe" ? "default" : "outline"}
              onClick={() => handleTypeSelect("recipe")}
              className="flex-1"
            >
              Recept
            </Button>
            <Button
              type="button"
              variant={selectedType === "product" ? "default" : "outline"}
              onClick={() => handleTypeSelect("product")}
              className="flex-1"
            >
              Produkt
            </Button>
            <Button
              type="button"
              variant={selectedType === "ingredient" ? "default" : "outline"}
              onClick={() => handleTypeSelect("ingredient")}
              className="flex-1"
            >
              Surovina
            </Button>
          </div>

          {/* Search and Selection */}
          {selectedType && (
            <>
              <Input
                ref={inputRef}
                placeholder={`Hledat ${selectedType === "recipe" ? "recept" : selectedType === "product" ? "produkt" : "surovinu"}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <div className="max-h-60 overflow-y-auto border rounded">
                {filteredItems.length === 0 ? (
                  <div className="p-4 text-muted-foreground text-center">
                    Nenalezeno
                  </div>
                ) : (
                  <ul>
                    {filteredItems.map((item) => {
                      const warning = getItemWarning(item);
                      return (
                        <li
                          key={item.id}
                          className={`px-3 py-2 cursor-pointer hover:bg-orange-50 rounded flex items-center gap-2 ${selectedId === item.id ? "bg-orange-100" : ""}`}
                          onClick={() => handleItemSelect(item.id)}
                        >
                          <div className="flex-1">
                            <div className="font-medium">
                              {getItemName(item)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Jednotka: {getItemUnit(item)}
                            </div>
                          </div>
                          {warning && (
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                warning.type === "error"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-orange-100 text-orange-700"
                              }`}
                              title={warning.message}
                            >
                              {warning.type === "error" ? (
                                <TriangleAlert className="h-3 w-3" />
                              ) : (
                                <ShieldAlert className="h-3 w-3" />
                              )}
                            </span>
                          )}
                          {selectedType === "product" &&
                            productPartsMap.get(item.id) && (
                              <span
                                className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded"
                                title="Produkt má definované části"
                              >
                                <BookOpen className="h-3 w-3" />
                              </span>
                            )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Quantity Input and Add Button */}
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
                <span className="text-sm text-muted-foreground">
                  {selectedId
                    ? getItemUnit(
                        filteredItems.find((item) => item.id === selectedId)
                      )
                    : ""}
                </span>
                <Button
                  type="button"
                  onClick={handleAdd}
                  disabled={!selectedId || quantity <= 0}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Přidat
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Zrušit
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
