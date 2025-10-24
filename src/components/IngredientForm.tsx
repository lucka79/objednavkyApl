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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIngredientStore } from "@/stores/ingredientStore";
// import { IngredientWithCategory } from "@/hooks/useIngredients";
import { detectAllergens } from "@/utils/allergenDetection";
import {
  X,
  Save,
  Plus,
  Type,
  Trash2,
  Star,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSupplierUsers } from "@/hooks/useProfiles";
import { supabase } from "@/lib/supabase";

interface SupplierCode {
  id?: number;
  supplier_id: string;
  product_code: string;
  supplier_ingredient_name: string | null;
  price: number;
  package: number | null;
  is_active: boolean;
}

interface IngredientFormData {
  name: string;
  category_id: number | null;
  unit: string;
  kiloPerUnit: number;
  price: number | null;
  package: number | null;
  vat: number | null;
  ean: string | null;
  product_code: string | null;
  active: boolean;
  storeOnly: boolean;
  // Nutritional fields
  kJ: number;
  kcal: number;
  fat: number;
  saturates: number;
  carbohydrate: number;
  sugars: number;
  protein: number;
  fibre: number;
  salt: number;
  element: string | null;
  supplier_id: string | null;
  // Multiple supplier codes
  supplier_codes: SupplierCode[];
}

const initialFormData: IngredientFormData = {
  name: "",
  category_id: null,
  unit: "kg",
  kiloPerUnit: 1,
  price: null,
  package: null,
  vat: 12,
  ean: null,
  product_code: null,
  active: true,
  storeOnly: false,
  kJ: 0,
  kcal: 0,
  fat: 0,
  saturates: 0,
  carbohydrate: 0,
  sugars: 0,
  protein: 0,
  fibre: 0,
  salt: 0,
  element: null,
  supplier_id: null,
  supplier_codes: [],
};

const COMMON_UNITS = ["kg", "l", "ks", "kr"];

export function IngredientForm() {
  const {
    isFormOpen,
    isEditMode,
    selectedIngredient,
    categories,
    isLoading,
    error,
    createIngredient,
    updateIngredient,
    closeForm,
    clearError,
    fetchCategories,
  } = useIngredientStore();

  const { toast } = useToast();
  const [formData, setFormData] = useState<IngredientFormData>(initialFormData);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [customUnit, setCustomUnit] = useState("");
  const { data: supplierUsers } = useSupplierUsers();
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [recipesUsingIngredient, setRecipesUsingIngredient] = useState<
    Array<{
      id: number;
      name: string;
      quantity: number;
      baker: boolean;
      pastry: boolean;
      donut: boolean;
      store: boolean;
      test: boolean;
      category_id: number;
    }>
  >([]);
  const [isRecipesSectionOpen, setIsRecipesSectionOpen] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsUsingIngredient, setProductsUsingIngredient] = useState<
    Array<{
      id: number;
      name: string;
      quantity: number;
      category_id: number;
    }>
  >([]);
  const [isProductsSectionOpen, setIsProductsSectionOpen] = useState(false);

  // Load categories on mount
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Load products that use this ingredient
  const loadProductsUsingIngredient = async (
    ingredientId: number,
    ingredientName?: string,
    ingredientUnit?: string
  ) => {
    console.log("=== DEBUG: LOADING PRODUCTS FOR INGREDIENT ===");
    console.log("Ingredient ID:", ingredientId);
    console.log("Ingredient Name:", ingredientName || formData.name || "N/A");
    console.log("Ingredient Unit:", ingredientUnit || formData.unit || "N/A");

    if (!ingredientId) {
      console.error("=== DEBUG: INVALID INGREDIENT ID ===");
      console.error("Ingredient ID is null, undefined, or 0");
      toast({
        title: "Chyba",
        description: "Neplatné ID suroviny",
        variant: "destructive",
      });
      return;
    }

    setLoadingProducts(true);
    try {
      console.log("=== DEBUG: STARTING DATABASE QUERY FOR PRODUCTS ===");
      console.log("Query params:", {
        table: "product_parts",
        ingredient_id: ingredientId,
      });

      const { data: productParts, error } = await supabase
        .from("product_parts")
        .select(
          `
          product_id,
          quantity,
          products!product_parts_product_id_fkey (
            id,
            name,
            category_id
          )
        `
        )
        .eq("ingredient_id", ingredientId)
        .not("products", "is", null);

      console.log("=== DEBUG: QUERY COMPLETE ===");
      console.log("Error:", error);
      console.log("Data:", productParts);

      if (error) {
        console.error("=== DEBUG: DATABASE ERROR DETECTED ===");
        console.error("Error object:", error);
        console.error("Error message:", error.message);
        throw error;
      }

      console.log("=== DEBUG: RAW PRODUCT PARTS DATA ===");
      console.log(
        "Total product_parts records found:",
        productParts?.length || 0
      );
      console.log("Raw data:", productParts);

      if (productParts && productParts.length > 0) {
        console.log("=== DEBUG: PROCESSING PRODUCT PARTS ===");

        const productsWithQuantity = productParts
          .map((pp) => {
            const product = pp.products as any;
            const processed = {
              id: product.id,
              name: product.name,
              quantity: pp.quantity,
              category_id: product.category_id,
            };

            console.log("Processed product:", processed);
            return processed;
          })
          .filter((product) => product !== null && "name" in product)
          .sort((a, b) => a.name.localeCompare(b.name, "cs"));

        console.log("=== DEBUG: FINAL PRODUCTS LIST ===");
        console.log(
          "Total products after processing:",
          productsWithQuantity.length
        );
        console.log("Sorted products:", productsWithQuantity);

        setProductsUsingIngredient(productsWithQuantity);
        console.log("=== DEBUG: PRODUCTS STATE UPDATED ===");
      } else {
        console.log("=== DEBUG: NO PRODUCTS FOUND ===");
        console.log("This ingredient is not used in any products");
        setProductsUsingIngredient([]);
      }

      console.log("=== DEBUG: END LOADING PRODUCTS ===");
    } catch (error: any) {
      console.error("=== DEBUG: CATCH BLOCK ERROR ===");
      console.error("Error:", error);
      console.error("Error message:", error?.message);

      toast({
        title: "Chyba",
        description: `Nepodařilo se načíst produkty používající tuto surovinu: ${error?.message || "Neznámá chyba"}`,
        variant: "destructive",
      });
    } finally {
      setLoadingProducts(false);
      console.log("=== DEBUG: LOADING COMPLETE ===");
    }
  };

  // Load recipes that use this ingredient
  const loadRecipesUsingIngredient = async (
    ingredientId: number,
    ingredientName?: string,
    ingredientUnit?: string
  ) => {
    console.log("=== DEBUG: LOADING RECIPES FOR INGREDIENT ===");
    console.log("Ingredient ID:", ingredientId);
    console.log("Ingredient Name:", ingredientName || formData.name || "N/A");
    console.log("Ingredient Unit:", ingredientUnit || formData.unit || "N/A");

    if (!ingredientId) {
      console.error("=== DEBUG: INVALID INGREDIENT ID ===");
      console.error("Ingredient ID is null, undefined, or 0");
      toast({
        title: "Chyba",
        description: "Neplatné ID suroviny",
        variant: "destructive",
      });
      return;
    }

    setLoadingRecipes(true);
    try {
      console.log("=== DEBUG: STARTING DATABASE QUERY ===");
      console.log("Query params:", {
        table: "recipe_ingredients",
        ingredient_id: ingredientId,
      });

      const { data: recipeIngredients, error } = await supabase
        .from("recipe_ingredients")
        .select(
          `
          recipe_id,
          quantity,
          recipes (
            id,
            name,
            baker,
            pastry,
            donut,
            store,
            test,
            category_id
          )
        `
        )
        .eq("ingredient_id", ingredientId)
        .not("recipes", "is", null);

      console.log("=== DEBUG: QUERY COMPLETE ===");
      console.log("Error:", error);
      console.log("Data:", recipeIngredients);

      if (error) {
        console.error("=== DEBUG: DATABASE ERROR DETECTED ===");
        console.error("Error object:", error);
        console.error("Error message:", error.message);
        console.error("Error details:", error.details);
        console.error("Error hint:", error.hint);
        console.error("Error code:", error.code);
        throw error;
      }

      console.log("=== DEBUG: RAW RECIPE INGREDIENTS DATA ===");
      console.log(
        "Total recipe_ingredients records found:",
        recipeIngredients?.length || 0
      );
      console.log("Raw data:", recipeIngredients);

      if (recipeIngredients && recipeIngredients.length > 0) {
        console.log("=== DEBUG: PROCESSING RECIPE INGREDIENTS ===");

        recipeIngredients.forEach((ri, index) => {
          console.log(`Recipe Ingredient ${index + 1}:`, {
            recipe_id: ri.recipe_id,
            quantity: ri.quantity,
            recipe: ri.recipes,
          });
        });

        const recipesWithQuantity = recipeIngredients
          .map((ri) => {
            const recipe = ri.recipes as any;
            const processed = {
              id: recipe.id,
              name: recipe.name,
              quantity: ri.quantity,
              baker: recipe.baker,
              pastry: recipe.pastry,
              donut: recipe.donut,
              store: recipe.store,
              test: recipe.test,
              category_id: recipe.category_id,
            };

            console.log("Processed recipe:", processed);
            return processed;
          })
          .filter((recipe) => recipe !== null && "name" in recipe)
          .sort((a, b) => a.name.localeCompare(b.name, "cs"));

        console.log("=== DEBUG: FINAL RECIPES LIST ===");
        console.log(
          "Total recipes after processing:",
          recipesWithQuantity.length
        );
        console.log("Sorted recipes:", recipesWithQuantity);

        recipesWithQuantity.forEach((recipe, index) => {
          const unit = ingredientUnit || formData.unit || "jednotka";
          console.log(`Recipe ${index + 1}:`, {
            id: recipe.id,
            name: recipe.name,
            quantity: `${recipe.quantity} ${unit}`,
            types: [
              recipe.baker && "Pekař",
              recipe.pastry && "Cukrář",
              recipe.donut && "Donut",
              recipe.store && "Prodejna",
              recipe.test && "Test",
            ]
              .filter(Boolean)
              .join(", "),
          });
        });

        setRecipesUsingIngredient(recipesWithQuantity);
        console.log("=== DEBUG: RECIPES STATE UPDATED ===");
      } else {
        console.log("=== DEBUG: NO RECIPES FOUND ===");
        console.log("This ingredient is not used in any recipes");
        setRecipesUsingIngredient([]);
      }

      console.log("=== DEBUG: END LOADING RECIPES ===");
    } catch (error: any) {
      console.error("=== DEBUG: CATCH BLOCK ERROR ===");
      console.error("Error type:", typeof error);
      console.error("Error:", error);
      console.error("Error name:", error?.name);
      console.error("Error message:", error?.message);
      console.error("Error stack:", error?.stack);
      console.error("Full error object:", JSON.stringify(error, null, 2));

      toast({
        title: "Chyba",
        description: `Nepodařilo se načíst recepty používající tuto surovinu: ${error?.message || "Neznámá chyba"}`,
        variant: "destructive",
      });
    } finally {
      setLoadingRecipes(false);
      console.log("=== DEBUG: LOADING COMPLETE ===");
    }
  };

  // Reset form when opening/closing
  useEffect(() => {
    if (isFormOpen) {
      if (isEditMode && selectedIngredient) {
        console.log("Loading ingredient for edit:", selectedIngredient);
        console.log(
          "Supplier codes from ingredient:",
          selectedIngredient.ingredient_supplier_codes
        );

        // Debug supplier code prices vs main price
        if (
          selectedIngredient.ingredient_supplier_codes &&
          selectedIngredient.ingredient_supplier_codes.length > 0
        ) {
          console.log("=== PRICE COMPARISON ===");
          console.log(
            "Main ingredient price:",
            selectedIngredient.price,
            "Kč per",
            selectedIngredient.unit
          );
          console.log("Unit:", selectedIngredient.unit);
          console.log("Kilo per unit:", selectedIngredient.kiloPerUnit);
          selectedIngredient.ingredient_supplier_codes.forEach(
            (code: any, index: number) => {
              console.log(`Supplier code #${index + 1}:`, {
                supplier_id: code.supplier_id,
                price: code.price,
                is_active: code.is_active,
                product_code: code.product_code,
              });
            }
          );
          console.log("=== END PRICE COMPARISON ===");
        }

        setFormData({
          name: selectedIngredient.name,
          category_id: selectedIngredient.category_id,
          unit: selectedIngredient.unit,
          kiloPerUnit: selectedIngredient.kiloPerUnit,
          price: selectedIngredient.price,
          package: selectedIngredient.package,
          vat: selectedIngredient.vat,
          ean: selectedIngredient.ean,
          product_code: selectedIngredient.product_code,
          active: selectedIngredient.active,
          storeOnly: selectedIngredient.storeOnly,
          kJ: selectedIngredient.kJ,
          kcal: selectedIngredient.kcal,
          fat: selectedIngredient.fat,
          saturates: selectedIngredient.saturates,
          carbohydrate: selectedIngredient.carbohydrate,
          sugars: selectedIngredient.sugars,
          protein: selectedIngredient.protein,
          fibre: selectedIngredient.fibre,
          salt: selectedIngredient.salt,
          element: selectedIngredient.element,
          supplier_id: selectedIngredient.supplier_id || null,
          supplier_codes: (
            selectedIngredient.ingredient_supplier_codes || []
          ).map((code) => ({
            id: code.id,
            supplier_id: code.supplier_id,
            product_code: code.product_code,
            supplier_ingredient_name:
              (code as any).supplier_ingredient_name || null,
            price: code.price,
            package: (code as any).package || null,
            is_active: code.is_active,
          })),
        });
        // Load recipes and products that use this ingredient (pass ingredient data directly since state hasn't updated yet)
        loadRecipesUsingIngredient(
          selectedIngredient.id,
          selectedIngredient.name,
          selectedIngredient.unit
        );
        loadProductsUsingIngredient(
          selectedIngredient.id,
          selectedIngredient.name,
          selectedIngredient.unit
        );
      } else {
        setFormData(initialFormData);
        setRecipesUsingIngredient([]);
        setProductsUsingIngredient([]);
      }
      setValidationErrors({});
    }
  }, [isFormOpen, isEditMode, selectedIngredient]);

  // Clear error when form closes
  useEffect(() => {
    if (!isFormOpen) {
      clearError();
    }
  }, [isFormOpen, clearError]);

  // Auto-set kiloPerUnit to 1 when unit is kg or l
  useEffect(() => {
    if (formData.unit === "kg" || formData.unit === "l") {
      if (formData.kiloPerUnit !== 1) {
        handleInputChange("kiloPerUnit", 1);
      }
    }
  }, [formData.unit]);

  // Auto-add main supplier to supplier_codes only when form opens or supplier changes
  useEffect(() => {
    if (
      formData.supplier_id &&
      supplierUsers &&
      formData.supplier_codes.length === 0
    ) {
      // Only add main supplier if no supplier codes exist yet
      const mainSupplier = supplierUsers.find(
        (u) => u.id === formData.supplier_id
      );

      if (mainSupplier) {
        const newCodes = [
          {
            supplier_id: formData.supplier_id,
            product_code: "",
            supplier_ingredient_name: null,
            price: formData.price || 0,
            package: formData.package,
            is_active: true, // Main supplier is always active
          },
        ];
        handleInputChange("supplier_codes", newCodes);
      }
    }
  }, [formData.supplier_id, supplierUsers]);

  // Removed auto-sync effects to prevent infinite loops
  // Price and supplier codes are now managed independently through the UI

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Název je povinný";
    }

    if (!formData.unit.trim()) {
      errors.unit = "Jednotka je povinná";
    }

    if (
      formData.unit !== "kg" &&
      formData.unit !== "l" &&
      formData.kiloPerUnit <= 0
    ) {
      errors.kiloPerUnit = "kg/Jednotka musí být větší než 0";
    }

    if (formData.price !== null && formData.price < 0) {
      errors.price = "Cena nemůže být záporná";
    }

    if (formData.package !== null && formData.package <= 0) {
      errors.package = "Balení musí být větší než 0";
    }

    if (formData.vat !== null && (formData.vat < 0 || formData.vat > 100)) {
      errors.vat = "DPH musí být mezi 0 a 100%";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    console.log("=== DEBUG: SAVING INGREDIENT ===");
    console.log("Form data:", formData);
    console.log("Supplier codes:", formData.supplier_codes);
    formData.supplier_codes.forEach((code, index) => {
      console.log(`Supplier code ${index}:`, {
        supplier_id: code.supplier_id,
        product_code: code.product_code,
        supplier_ingredient_name: code.supplier_ingredient_name,
        price: code.price,
        package: code.package,
        is_active: code.is_active,
      });
    });

    try {
      // Find the active supplier to sync main ingredient data
      const activeSupplier = formData.supplier_codes.find(
        (code) => code.is_active
      );

      // Prepare the data to save
      let dataToSave = { ...formData };

      // If there's an active supplier, update main ingredient data to match
      if (activeSupplier) {
        console.log("=== DEBUG: SYNCING WITH ACTIVE SUPPLIER ===");
        console.log("Active supplier:", activeSupplier);

        dataToSave.supplier_id = activeSupplier.supplier_id;
        dataToSave.price = activeSupplier.price;

        // Update package if supplier has one
        if (activeSupplier.package !== null) {
          dataToSave.package = activeSupplier.package;
        }

        // Update name if supplier has a specific name
        if (activeSupplier.supplier_ingredient_name) {
          dataToSave.name = activeSupplier.supplier_ingredient_name;
        }

        console.log("Updated main ingredient data:", {
          supplier_id: dataToSave.supplier_id,
          price: dataToSave.price,
          package: dataToSave.package,
          name: dataToSave.name,
        });
      }

      if (isEditMode && selectedIngredient) {
        console.log("Updating ingredient ID:", selectedIngredient.id);
        await updateIngredient(selectedIngredient.id, dataToSave);
        toast({
          title: "Úspěch",
          description: "Ingredience byla úspěšně upravena",
        });
      } else {
        console.log("Creating new ingredient");
        await createIngredient(dataToSave);
        toast({
          title: "Úspěch",
          description: "Ingredience byla úspěšně vytvořena",
        });
      }
      console.log("=== DEBUG: SAVE COMPLETE ===");
    } catch (error) {
      console.error("=== DEBUG: SAVE FAILED ===", error);
      toast({
        title: "Chyba",
        description:
          error instanceof Error
            ? error.message
            : "Nepodařilo se uložit ingredienci",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: keyof IngredientFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleClose = () => {
    closeForm();
  };

  const formatText = () => {
    if (!formData.element) return;

    let formatted = formData.element
      // Remove extra spaces
      .replace(/\s+/g, " ")
      // Remove spaces before punctuation
      .replace(/\s+([,.;:])/g, "$1")
      // Add space after punctuation if missing
      .replace(/([,.;:])([^\s])/g, "$1 $2")
      // Remove spaces at beginning and end
      .trim()
      // Normalize multiple punctuation
      .replace(/[,]+/g, ",")
      .replace(/[.]+/g, ".")
      // Remove trailing punctuation duplicates
      .replace(/([,.;:])\s*([,.;:])/g, "$1");

    handleInputChange("element", formatted);
  };

  const allergens = detectAllergens(formData.element);

  // Helper function to get price from active supplier codes
  const getPriceFromActiveSupplier = (): number | null => {
    const activeSupplier = formData.supplier_codes.find(
      (code) => code.is_active
    );
    return activeSupplier ? activeSupplier.price : null;
  };

  return (
    <Dialog open={isFormOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isEditMode ? (
                <>
                  <Save className="h-5 w-5" />
                  {formData.name || "Upravit surovinu"}
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  Nová surovina
                </>
              )}
            </div>
            {/* <div className="text-xs text-muted-foreground font-normal flex items-center gap-1">
              <Save className="h-3 w-3" />
              Tlačítko uložit je dole
            </div> */}
          </DialogTitle>
        </DialogHeader>

        <form
          id="ingredient-form"
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Základní informace</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6 pb-4 border-b">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) =>
                      handleInputChange("active", checked)
                    }
                    className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  />
                  <Label htmlFor="active">Aktivní</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="storeOnly"
                    checked={formData.storeOnly}
                    onCheckedChange={(checked) =>
                      handleInputChange("storeOnly", checked)
                    }
                    className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  />
                  <Label htmlFor="storeOnly">Pouze pro prodejnu</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Název *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Název ingredience"
                    className={validationErrors.name ? "border-red-500" : ""}
                  />
                  {validationErrors.name && (
                    <p className="text-sm text-red-500">
                      {validationErrors.name}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Kategorie</Label>
                  <Select
                    value={
                      formData.category_id
                        ? formData.category_id.toString()
                        : "none"
                    }
                    onValueChange={(value) =>
                      handleInputChange(
                        "category_id",
                        value === "none" ? null : parseInt(value)
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte kategorii" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="none">Bez kategorie</SelectItem>
                      {categories.map((category) => (
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit">Jednotka *</Label>
                  <Select
                    value={
                      COMMON_UNITS.includes(formData.unit)
                        ? formData.unit
                        : "jiná..."
                    }
                    onValueChange={(value) => {
                      if (value === "jiná...") {
                        setCustomUnit(
                          formData.unit && !COMMON_UNITS.includes(formData.unit)
                            ? formData.unit
                            : ""
                        );
                        handleInputChange("unit", "");
                      } else {
                        handleInputChange("unit", value);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte jednotku" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {((formData.unit === "" && customUnit !== "") ||
                    (!COMMON_UNITS.includes(formData.unit) &&
                      formData.unit !== "")) && (
                    <Input
                      id="unit-custom"
                      value={customUnit}
                      onChange={(e) => {
                        setCustomUnit(e.target.value);
                        handleInputChange("unit", e.target.value);
                      }}
                      placeholder="Zadejte vlastní jednotku"
                      className={
                        validationErrors.unit ? "border-red-500 mt-2" : "mt-2"
                      }
                    />
                  )}
                  {validationErrors.unit && (
                    <p className="text-sm text-red-500">
                      {validationErrors.unit}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kiloPerUnit">
                    Jednotka{" => "}kg{" "}
                    {formData.unit === "kg" || formData.unit === "l" ? "" : "*"}
                  </Label>
                  {formData.unit === "kg" || formData.unit === "l" ? (
                    <div className="p-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
                      (1 {formData.unit} = 1 kg)
                    </div>
                  ) : (
                    <Input
                      id="kiloPerUnit"
                      type="number"
                      step="0.001"
                      value={formData.kiloPerUnit}
                      onChange={(e) =>
                        handleInputChange(
                          "kiloPerUnit",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      placeholder="1.000"
                      className={`[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                        validationErrors.kiloPerUnit ? "border-red-500" : ""
                      }`}
                    />
                  )}
                  {validationErrors.kiloPerUnit && (
                    <p className="text-sm text-red-500">
                      {validationErrors.kiloPerUnit}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Balení</Label>
                  <div className="p-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
                    {(() => {
                      // Get package from active supplier first, then fallback to ingredient package
                      const activeSupplier = formData.supplier_codes.find(
                        (code) => code.is_active
                      );
                      const packageValue =
                        activeSupplier?.package || formData.package;
                      return packageValue
                        ? `${packageValue}`
                        : "Není nastaveno";
                    })()}
                  </div>
                </div>
              </div>

              {/* DPH Selection */}
              <div className="flex items-center justify-between">
                <Label htmlFor="vat">DPH</Label>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="vat-12"
                      name="vat"
                      value="12"
                      checked={formData.vat === 12}
                      onChange={() => handleInputChange("vat", 12)}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <Label htmlFor="vat-12" className="text-sm">
                      12%
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="vat-21"
                      name="vat"
                      value="21"
                      checked={formData.vat === 21}
                      onChange={() => handleInputChange("vat", 21)}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <Label htmlFor="vat-21" className="text-sm">
                      21%
                    </Label>
                  </div>
                </div>
              </div>

              {/* Price Calculations */}
              {(() => {
                const activePrice =
                  getPriceFromActiveSupplier() || formData.price;
                return activePrice && formData.kiloPerUnit > 0 ? (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="text-sm font-medium text-green-800 mb-2">
                      Kalkulace cen
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-green-700">
                          Cena za kg
                        </Label>
                        <div className="text-lg font-semibold text-green-900">
                          {(activePrice / formData.kiloPerUnit).toFixed(2)}{" "}
                          Kč/kg
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-green-700">
                          Cena za jednotku
                        </Label>
                        <div className="text-lg font-semibold text-green-900">
                          {activePrice.toFixed(2)} Kč/{formData.unit}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-green-600 mt-2">
                      💡 Cena se počítá z aktivního dodavatele v sekci
                      "Dodavatelé a ceny". Hlavní údaje ingredience se
                      automaticky synchronizují s aktivním dodavatelem.
                    </p>
                  </div>
                ) : null;
              })()}
            </CardContent>
          </Card>

          {/* Supplier Codes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Dodavatelé a ceny
                {formData.supplier_codes.length > 0 && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    {formData.supplier_codes.length} dodavatel
                    {formData.supplier_codes.length > 1 ? "ů" : ""}
                  </span>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Nastavte hlavního dodavatele a přidejte alternativní dodavatele
                s různými cenami. Aktivní dodavatel se používá pro výpočet cen v
                receptech. Hlavní údaje ingredience (cena, balení, název) se
                automaticky synchronizují s aktivním dodavatelem. Všechny změny
                se uloží kliknutím na tlačítko "Uložit změny" dole.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Main Supplier Selection - Merged with supplier codes */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-blue-600" />
                    <Label className="text-sm font-medium text-blue-800">
                      Hlavní dodavatel
                    </Label>
                    {formData.supplier_id && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        {supplierUsers?.find(
                          (u) => u.id === formData.supplier_id
                        )?.full_name || "Neznámý dodavatel"}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Dodavatel</Label>
                    <Select
                      value={formData.supplier_id || "none"}
                      onValueChange={(value) => {
                        const newSupplierId = value === "none" ? null : value;
                        handleInputChange("supplier_id", newSupplierId);

                        // If we have supplier codes, update the active one
                        if (formData.supplier_codes.length > 0) {
                          const newCodes = formData.supplier_codes.map(
                            (code) => ({
                              ...code,
                              is_active: code.supplier_id === newSupplierId,
                            })
                          );
                          handleInputChange("supplier_codes", newCodes);

                          // Update the main ingredient data to match the active supplier
                          const activeSupplier = newCodes.find(
                            (code) => code.is_active
                          );
                          if (activeSupplier) {
                            // Update price
                            handleInputChange("price", activeSupplier.price);
                            // Update package if supplier has one
                            if (activeSupplier.package !== null) {
                              handleInputChange(
                                "package",
                                activeSupplier.package
                              );
                            }
                            // Update name if supplier has a specific name
                            if (activeSupplier.supplier_ingredient_name) {
                              handleInputChange(
                                "name",
                                activeSupplier.supplier_ingredient_name
                              );
                            }
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Vyberte hlavního dodavatele" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="none">Bez dodavatele</SelectItem>
                        {(supplierUsers || []).map((u: any) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Main supplier codes section */}
                  {formData.supplier_id &&
                    (() => {
                      const mainSupplierCodes = formData.supplier_codes.filter(
                        (code) => code.supplier_id === formData.supplier_id
                      );

                      if (mainSupplierCodes.length > 0) {
                        return (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium">
                                Kódy hlavního dodavatele
                              </Label>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newCodes = [
                                    ...formData.supplier_codes,
                                    {
                                      supplier_id: formData.supplier_id,
                                      product_code: "",
                                      supplier_ingredient_name: null,
                                      price: 0,
                                      package: null,
                                      is_active: false,
                                    },
                                  ];
                                  handleInputChange("supplier_codes", newCodes);
                                }}
                                className="text-xs"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Přidat další kód
                              </Button>
                            </div>

                            {mainSupplierCodes.map((supplierCode) => {
                              const originalIndex =
                                formData.supplier_codes.findIndex(
                                  (code) => code === supplierCode
                                );

                              return (
                                <div
                                  key={originalIndex}
                                  className="p-3 bg-white border rounded-md space-y-3"
                                >
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                      <Label>Kód produktu</Label>
                                      <Input
                                        value={supplierCode.product_code}
                                        onChange={(e) => {
                                          const newCodes = [
                                            ...formData.supplier_codes,
                                          ];
                                          newCodes[originalIndex].product_code =
                                            e.target.value;
                                          handleInputChange(
                                            "supplier_codes",
                                            newCodes
                                          );
                                        }}
                                        className="font-mono"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label>Cena (Kč)</Label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={supplierCode.price}
                                        onChange={(e) => {
                                          const newCodes = [
                                            ...formData.supplier_codes,
                                          ];
                                          newCodes[originalIndex].price =
                                            parseFloat(e.target.value) || 0;
                                          handleInputChange(
                                            "supplier_codes",
                                            newCodes
                                          );
                                        }}
                                        placeholder="0.00"
                                        className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none no-spinner"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label>Balení</Label>
                                      <Input
                                        type="number"
                                        step="0.1"
                                        value={supplierCode.package || ""}
                                        onChange={(e) => {
                                          const newCodes = [
                                            ...formData.supplier_codes,
                                          ];
                                          newCodes[originalIndex].package = e
                                            .target.value
                                            ? parseFloat(e.target.value)
                                            : null;
                                          handleInputChange(
                                            "supplier_codes",
                                            newCodes
                                          );
                                        }}
                                        className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none no-spinner"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label>Status</Label>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          type="button"
                                          variant={
                                            supplierCode.is_active
                                              ? "default"
                                              : "outline"
                                          }
                                          size="sm"
                                          onClick={() => {
                                            const newCodes =
                                              formData.supplier_codes.map(
                                                (code, i) => ({
                                                  ...code,
                                                  is_active:
                                                    i === originalIndex,
                                                })
                                              );
                                            handleInputChange(
                                              "supplier_codes",
                                              newCodes
                                            );

                                            // Update main ingredient data to match the new active supplier
                                            const activeSupplier =
                                              newCodes.find(
                                                (code) => code.is_active
                                              );
                                            if (activeSupplier) {
                                              // Update supplier_id
                                              handleInputChange(
                                                "supplier_id",
                                                activeSupplier.supplier_id
                                              );
                                              // Update price
                                              handleInputChange(
                                                "price",
                                                activeSupplier.price
                                              );
                                              // Update package if supplier has one
                                              if (
                                                activeSupplier.package !== null
                                              ) {
                                                handleInputChange(
                                                  "package",
                                                  activeSupplier.package
                                                );
                                              }
                                              // Update name if supplier has a specific name
                                              if (
                                                activeSupplier.supplier_ingredient_name
                                              ) {
                                                handleInputChange(
                                                  "name",
                                                  activeSupplier.supplier_ingredient_name
                                                );
                                              }
                                            }
                                          }}
                                          className="text-xs"
                                        >
                                          <Star className="h-3 w-3 mr-1" />
                                          {supplierCode.is_active
                                            ? "Aktivní"
                                            : "Nastavit"}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <Label>Název u dodavatele</Label>
                                    <Input
                                      value={
                                        supplierCode.supplier_ingredient_name ||
                                        ""
                                      }
                                      onChange={(e) => {
                                        const newCodes = [
                                          ...formData.supplier_codes,
                                        ];
                                        newCodes[
                                          originalIndex
                                        ].supplier_ingredient_name =
                                          e.target.value || null;
                                        handleInputChange(
                                          "supplier_codes",
                                          newCodes
                                        );
                                      }}
                                      placeholder="Název suroviny u dodavatele"
                                    />
                                  </div>

                                  {/* <div className="space-y-2">
                                    <Label>Akce</Label>
                                    <div className="flex items-center gap-2">
                                      {mainSupplierCodes.length > 1 && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const newCodes =
                                              formData.supplier_codes.filter(
                                                (_, i) => i !== originalIndex
                                              );
                                            handleInputChange(
                                              "supplier_codes",
                                              newCodes
                                            );
                                          }}
                                          className="text-red-600 hover:text-red-800"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </div> */}
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                      return null;
                    })()}

                  {formData.supplier_codes.length > 0 && (
                    <div className="p-2 bg-green-50 border border-green-200 rounded-md">
                      <p className="text-xs text-green-700">
                        ⭐ Aktivní dodavatel:{" "}
                        {formData.supplier_codes.find((code) => code.is_active)
                          ?.supplier_id
                          ? supplierUsers?.find(
                              (u) =>
                                u.id ===
                                formData.supplier_codes.find(
                                  (code) => code.is_active
                                )?.supplier_id
                            )?.full_name
                          : "Není nastaven"}{" "}
                        - Cena:{" "}
                        {getPriceFromActiveSupplier()
                          ? `${getPriceFromActiveSupplier()} Kč`
                          : "Není nastavena"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {(() => {
                  // Group supplier codes by supplier_id
                  const groupedCodes = formData.supplier_codes.reduce(
                    (acc, code, index) => {
                      const supplierId = code.supplier_id;
                      if (!acc[supplierId]) {
                        acc[supplierId] = {
                          supplier: supplierUsers?.find(
                            (u) => u.id === supplierId
                          ),
                          codes: [],
                        };
                      }
                      acc[supplierId].codes.push({
                        ...code,
                        originalIndex: index,
                      });
                      return acc;
                    },
                    {} as Record<
                      string,
                      {
                        supplier: any;
                        codes: ((typeof formData.supplier_codes)[0] & {
                          originalIndex: number;
                        })[];
                      }
                    >
                  );

                  return Object.entries(groupedCodes)
                    .filter(
                      ([supplierId]) => supplierId !== formData.supplier_id
                    ) // Exclude main supplier
                    .map(([supplierId, { supplier, codes }]) => {
                      const supplierName =
                        supplier?.full_name || "Neznámý dodavatel";

                      return (
                        <div
                          key={supplierId}
                          className="p-4 border rounded-lg bg-gray-50"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Star
                                className={`h-4 w-4 ${codes.some((c) => c.is_active) ? "text-yellow-500 fill-current" : "text-gray-400"}`}
                              />
                              <span className="font-medium">
                                Alternativní dodavatel
                              </span>
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                {supplierName}
                              </span>
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                {codes.length} kód{codes.length > 1 ? "ů" : ""}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newCodes = formData.supplier_codes.filter(
                                  (_, i) =>
                                    !codes.some((c) => c.originalIndex === i)
                                );
                                handleInputChange("supplier_codes", newCodes);
                              }}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="space-y-3">
                            {codes.map((supplierCode) => (
                              <div
                                key={supplierCode.originalIndex}
                                className="p-3 bg-white border rounded-md space-y-3"
                              >
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                  <div className="space-y-2">
                                    <Label>Kód produktu</Label>
                                    <Input
                                      value={supplierCode.product_code}
                                      onChange={(e) => {
                                        const newCodes = [
                                          ...formData.supplier_codes,
                                        ];
                                        newCodes[
                                          supplierCode.originalIndex
                                        ].product_code = e.target.value;
                                        handleInputChange(
                                          "supplier_codes",
                                          newCodes
                                        );
                                      }}
                                      className="font-mono"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label>Cena (Kč)</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={supplierCode.price}
                                      onChange={(e) => {
                                        const newCodes = [
                                          ...formData.supplier_codes,
                                        ];
                                        newCodes[
                                          supplierCode.originalIndex
                                        ].price =
                                          parseFloat(e.target.value) || 0;
                                        handleInputChange(
                                          "supplier_codes",
                                          newCodes
                                        );
                                      }}
                                      placeholder="0.00"
                                      className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none no-spinner"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label>Balení</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={supplierCode.package || ""}
                                      onChange={(e) => {
                                        const newCodes = [
                                          ...formData.supplier_codes,
                                        ];
                                        newCodes[
                                          supplierCode.originalIndex
                                        ].package = e.target.value
                                          ? parseFloat(e.target.value)
                                          : null;
                                        handleInputChange(
                                          "supplier_codes",
                                          newCodes
                                        );
                                      }}
                                      className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none no-spinner"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label>Status</Label>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        type="button"
                                        variant={
                                          supplierCode.is_active
                                            ? "default"
                                            : "outline"
                                        }
                                        size="sm"
                                        onClick={() => {
                                          const newCodes =
                                            formData.supplier_codes.map(
                                              (code, i) => ({
                                                ...code,
                                                is_active:
                                                  i ===
                                                  supplierCode.originalIndex,
                                              })
                                            );
                                          handleInputChange(
                                            "supplier_codes",
                                            newCodes
                                          );

                                          // Update main ingredient data to match the new active supplier
                                          const activeSupplier = newCodes.find(
                                            (code) => code.is_active
                                          );
                                          if (activeSupplier) {
                                            // Update supplier_id
                                            handleInputChange(
                                              "supplier_id",
                                              activeSupplier.supplier_id
                                            );
                                            // Update price
                                            handleInputChange(
                                              "price",
                                              activeSupplier.price
                                            );
                                            // Update package if supplier has one
                                            if (
                                              activeSupplier.package !== null
                                            ) {
                                              handleInputChange(
                                                "package",
                                                activeSupplier.package
                                              );
                                            }
                                            // Update name if supplier has a specific name
                                            if (
                                              activeSupplier.supplier_ingredient_name
                                            ) {
                                              handleInputChange(
                                                "name",
                                                activeSupplier.supplier_ingredient_name
                                              );
                                            }
                                          }
                                        }}
                                        className="text-xs"
                                      >
                                        <Star className="h-3 w-3 mr-1" />
                                        {supplierCode.is_active
                                          ? "Aktivní"
                                          : "Nastavit"}
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <Label>Akce</Label>
                                    <div className="flex items-center gap-2">
                                      {codes.length > 1 && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const newCodes =
                                              formData.supplier_codes.filter(
                                                (_, i) =>
                                                  i !==
                                                  supplierCode.originalIndex
                                              );
                                            handleInputChange(
                                              "supplier_codes",
                                              newCodes
                                            );
                                          }}
                                          className="text-red-600 hover:text-red-800"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label>Název u dodavatele</Label>
                                  <Input
                                    value={
                                      supplierCode.supplier_ingredient_name ||
                                      ""
                                    }
                                    onChange={(e) => {
                                      const newCodes = [
                                        ...formData.supplier_codes,
                                      ];
                                      newCodes[
                                        supplierCode.originalIndex
                                      ].supplier_ingredient_name =
                                        e.target.value || null;
                                      handleInputChange(
                                        "supplier_codes",
                                        newCodes
                                      );
                                    }}
                                    placeholder="Název suroviny u dodavatele"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newCodes = [
                                  ...formData.supplier_codes,
                                  {
                                    supplier_id: supplierId,
                                    product_code: "",
                                    supplier_ingredient_name: null,
                                    price: 0,
                                    package: null,
                                    is_active: false,
                                  },
                                ];
                                handleInputChange("supplier_codes", newCodes);
                              }}
                              className="text-xs"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Přidat další kód
                            </Button>
                          </div>
                        </div>
                      );
                    });
                })()}

                <div className="space-y-2">
                  <Label>Přidat nového dodavatele</Label>
                  <div className="flex gap-2">
                    <Select
                      value=""
                      onValueChange={(supplierId) => {
                        if (supplierId) {
                          const newCodes = [
                            ...formData.supplier_codes,
                            {
                              supplier_id: supplierId,
                              product_code: "",
                              supplier_ingredient_name: null,
                              price: 0,
                              package: null,
                              is_active: false,
                            },
                          ];
                          handleInputChange("supplier_codes", newCodes);
                        }
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Vyberte dodavatele" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {(supplierUsers || [])
                          .filter(
                            (supplier: any) =>
                              !formData.supplier_codes.some(
                                (code) => code.supplier_id === supplier.id
                              )
                          )
                          .map((supplier: any) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.full_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(() => {
                    const availableSuppliers = (supplierUsers || []).filter(
                      (supplier: any) =>
                        !formData.supplier_codes.some(
                          (code) => code.supplier_id === supplier.id
                        )
                    );

                    if (availableSuppliers.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground">
                          Všichni dostupní dodavatelé jsou již přidáni.
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>

                {formData.supplier_codes.length === 0 &&
                  formData.supplier_id && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800">
                        💡 Hlavní dodavatel z "Cenových informací" se
                        automaticky přidá do této sekce.
                      </p>
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>

          {/* Products Using This Ingredient Section */}
          {isEditMode && (
            <Card>
              <CardHeader
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setIsProductsSectionOpen(!isProductsSectionOpen)}
              >
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Produkty využívající tuto surovinu
                    {productsUsingIngredient.length > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">
                        ({productsUsingIngredient.length})
                      </span>
                    )}
                  </div>
                  {isProductsSectionOpen ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
              {isProductsSectionOpen && (
                <CardContent className="space-y-4 bg-green-50/50 rounded-lg p-4 border border-green-100">
                  {loadingProducts ? (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">
                        Načítání produktů...
                      </p>
                    </div>
                  ) : productsUsingIngredient.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">
                        Nenalezeny žádné produkty, které používají tuto
                        surovinu.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground mb-3">
                        Nalezeno {productsUsingIngredient.length} produkt
                        {productsUsingIngredient.length === 1
                          ? ""
                          : productsUsingIngredient.length < 5
                            ? "y"
                            : "ů"}{" "}
                        používajících tuto surovinu:
                      </div>
                      <div className="grid gap-2">
                        {productsUsingIngredient.map((product) => {
                          return (
                            <div
                              key={product.id}
                              className="flex items-center justify-between p-3 bg-white/80 rounded border border-green-200 shadow-sm"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {product.name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    Použité množství:{" "}
                                    {product.quantity.toFixed(3)}{" "}
                                    {formData.unit}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          {/* Recipes Using This Ingredient Section */}
          {isEditMode && (
            <Card>
              <CardHeader
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setIsRecipesSectionOpen(!isRecipesSectionOpen)}
              >
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Recepty využívající tuto surovinu
                    {recipesUsingIngredient.length > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">
                        ({recipesUsingIngredient.length})
                      </span>
                    )}
                  </div>
                  {isRecipesSectionOpen ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
              {isRecipesSectionOpen && (
                <CardContent className="space-y-4 bg-purple-50/50 rounded-lg p-4 border border-purple-100">
                  {loadingRecipes ? (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">
                        Načítání receptů...
                      </p>
                    </div>
                  ) : recipesUsingIngredient.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">
                        Nenalezeny žádné recepty, které používají tuto surovinu.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground mb-3">
                        Nalezeno {recipesUsingIngredient.length} recept
                        {recipesUsingIngredient.length === 1
                          ? ""
                          : recipesUsingIngredient.length < 5
                            ? "y"
                            : "ů"}{" "}
                        používajících tuto surovinu:
                      </div>
                      <div className="grid gap-2">
                        {recipesUsingIngredient.map((recipe) => {
                          // Get recipe types
                          const types = [];
                          if (recipe.baker)
                            types.push({
                              label: "Pekař",
                              color: "bg-blue-100 text-blue-800",
                            });
                          if (recipe.pastry)
                            types.push({
                              label: "Cukrář",
                              color: "bg-pink-100 text-pink-800",
                            });
                          if (recipe.donut)
                            types.push({
                              label: "Donut",
                              color: "bg-purple-100 text-purple-800",
                            });
                          if (recipe.store)
                            types.push({
                              label: "Prodejna",
                              color: "bg-green-100 text-green-800",
                            });
                          if (recipe.test)
                            types.push({
                              label: "Test",
                              color: "bg-yellow-100 text-yellow-800",
                            });

                          return (
                            <div
                              key={recipe.id}
                              className="flex items-center justify-between p-3 bg-white/80 rounded border border-purple-200 shadow-sm"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {recipe.name}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    Použité množství:{" "}
                                    {recipe.quantity.toFixed(3)} {formData.unit}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap justify-end">
                                {types.map((type, index) => (
                                  <span
                                    key={index}
                                    className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${type.color}`}
                                  >
                                    {type.label}
                                  </span>
                                ))}
                                {types.length === 0 && (
                                  <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                                    Bez typu
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          {/* Nutritional Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Výživové údaje (na 100g)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="kJ">Energie (kJ)</Label>
                  <Input
                    id="kJ"
                    type="number"
                    step="0.1"
                    value={formData.kJ}
                    onChange={(e) =>
                      handleInputChange("kJ", parseFloat(e.target.value) || 0)
                    }
                    placeholder="0"
                    className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kcal">Energie (kcal)</Label>
                  <Input
                    id="kcal"
                    type="number"
                    step="0.1"
                    value={formData.kcal}
                    onChange={(e) =>
                      handleInputChange("kcal", parseFloat(e.target.value) || 0)
                    }
                    placeholder="0"
                    className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fat">Tuky (g)</Label>
                  <Input
                    id="fat"
                    type="number"
                    step="0.1"
                    value={formData.fat}
                    onChange={(e) =>
                      handleInputChange("fat", parseFloat(e.target.value) || 0)
                    }
                    placeholder="0"
                    className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="saturates">
                    Nasycené mastné kyseliny (g)
                  </Label>
                  <Input
                    id="saturates"
                    type="number"
                    step="0.1"
                    value={formData.saturates}
                    onChange={(e) =>
                      handleInputChange(
                        "saturates",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    placeholder="0"
                    className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="carbohydrate">Sacharidy (g)</Label>
                  <Input
                    id="carbohydrate"
                    type="number"
                    step="0.1"
                    value={formData.carbohydrate}
                    onChange={(e) =>
                      handleInputChange(
                        "carbohydrate",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    placeholder="0"
                    className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sugars">Z toho cukry (g)</Label>
                  <Input
                    id="sugars"
                    type="number"
                    step="0.1"
                    value={formData.sugars}
                    onChange={(e) =>
                      handleInputChange(
                        "sugars",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    placeholder="0"
                    className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="protein">Bílkoviny (g)</Label>
                  <Input
                    id="protein"
                    type="number"
                    step="0.1"
                    value={formData.protein}
                    onChange={(e) =>
                      handleInputChange(
                        "protein",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    placeholder="0"
                    className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fibre">Vláknina (g)</Label>
                  <Input
                    id="fibre"
                    type="number"
                    step="0.1"
                    value={formData.fibre}
                    onChange={(e) =>
                      handleInputChange(
                        "fibre",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    placeholder="0"
                    className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salt">Sůl (g)</Label>
                  <Input
                    id="salt"
                    type="number"
                    step="0.1"
                    value={formData.salt}
                    onChange={(e) =>
                      handleInputChange("salt", parseFloat(e.target.value) || 0)
                    }
                    placeholder="0"
                    className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              {/* Allergen Section */}
              {formData.element && formData.element.trim() !== "" && (
                <div className="mb-2">
                  <Label className="block mb-1 text-sm font-semibold text-red-700">
                    Alergeny
                  </Label>
                  {allergens.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {allergens.map((allergen, idx) => {
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
                      })}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Žádné alergeny detekovány
                    </span>
                  )}
                </div>
              )}

              {/* Složení ingredience */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="element">Složení ingredience</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={formatText}
                    disabled={
                      !formData.element || formData.element.trim() === ""
                    }
                    className="flex items-center gap-1 text-xs"
                  >
                    <Type className="h-3 w-3" />
                    Formátovat text
                  </Button>
                </div>
                <textarea
                  id="element"
                  value={formData.element || ""}
                  onChange={(e) =>
                    handleInputChange("element", e.target.value || null)
                  }
                  placeholder="Zadejte všechny složky a části ingredience..."
                  className="w-full min-h-[100px] p-3 border border-input bg-background rounded-md text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Spacer for floating buttons */}
          <div className="h-20"></div>
        </form>

        {/* Floating Form Actions */}
        <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-10">
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              <X className="h-4 w-4 mr-2" />
              Zrušit
            </Button>
            <Button
              type="submit"
              form="ingredient-form"
              disabled={isLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Save className="h-4 w-4 mr-2" />
              {isLoading
                ? "Ukládám..."
                : isEditMode
                  ? "Uložit změny"
                  : "Vytvořit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
