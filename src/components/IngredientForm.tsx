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
import { X, Save, Plus, Type } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface IngredientFormData {
  name: string;
  category_id: number | null;
  unit: string;
  kiloPerUnit: number;
  price: number | null;
  package: number | null;
  vat: number | null;
  ean: string | null;
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
}

const initialFormData: IngredientFormData = {
  name: "",
  category_id: null,
  unit: "",
  kiloPerUnit: 1,
  price: null,
  package: null,
  vat: null,
  ean: null,
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
};

const COMMON_UNITS = ["kg", "l", "ks"];

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

  // Load categories on mount
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Reset form when opening/closing
  useEffect(() => {
    if (isFormOpen) {
      if (isEditMode && selectedIngredient) {
        setFormData({
          name: selectedIngredient.name,
          category_id: selectedIngredient.category_id,
          unit: selectedIngredient.unit,
          kiloPerUnit: selectedIngredient.kiloPerUnit,
          price: selectedIngredient.price,
          package: selectedIngredient.package,
          vat: selectedIngredient.vat,
          ean: selectedIngredient.ean,
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
        });
      } else {
        setFormData(initialFormData);
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

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Název je povinný";
    }

    if (!formData.unit.trim()) {
      errors.unit = "Jednotka je povinná";
    }

    if (formData.kiloPerUnit <= 0) {
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

    try {
      if (isEditMode && selectedIngredient) {
        await updateIngredient(selectedIngredient.id, formData);
        toast({
          title: "Úspěch",
          description: "Ingredience byla úspěšně upravena",
        });
      } else {
        await createIngredient(formData);
        toast({
          title: "Úspěch",
          description: "Ingredience byla úspěšně vytvořena",
        });
      }
    } catch (error) {
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

  return (
    <Dialog open={isFormOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <Save className="h-5 w-5" />
                Upravit surovinu
              </>
            ) : (
              <>
                <Plus className="h-5 w-5" />
                Nová surovina
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
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
                  <Label htmlFor="kiloPerUnit">kg/Jednotka *</Label>
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
                  {validationErrors.kiloPerUnit && (
                    <p className="text-sm text-red-500">
                      {validationErrors.kiloPerUnit}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="package">Balení</Label>
                  <Input
                    id="package"
                    type="number"
                    value={formData.package || ""}
                    onChange={(e) =>
                      handleInputChange(
                        "package",
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    placeholder="např. 25"
                    className={`[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${validationErrors.package ? "border-red-500" : ""}`}
                  />
                  {validationErrors.package && (
                    <p className="text-sm text-red-500">
                      {validationErrors.package}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cenové informace</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Cena (Kč)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price || ""}
                    onChange={(e) =>
                      handleInputChange(
                        "price",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    placeholder="0.00"
                    className={`[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${validationErrors.price ? "border-red-500" : ""}`}
                  />
                  {validationErrors.price && (
                    <p className="text-sm text-red-500">
                      {validationErrors.price}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vat">DPH (%)</Label>
                  <Input
                    id="vat"
                    type="number"
                    step="0.1"
                    value={formData.vat || ""}
                    onChange={(e) =>
                      handleInputChange(
                        "vat",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    placeholder="21"
                    className={`[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${validationErrors.vat ? "border-red-500" : ""}`}
                  />
                  {validationErrors.vat && (
                    <p className="text-sm text-red-500">
                      {validationErrors.vat}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ean">EAN kód</Label>
                <Input
                  id="ean"
                  value={formData.ean || ""}
                  onChange={(e) =>
                    handleInputChange("ean", e.target.value || null)
                  }
                  placeholder="1234567890123"
                />
              </div>
            </CardContent>
          </Card>

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

          {/* Form Actions */}
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
        </form>
      </DialogContent>
    </Dialog>
  );
}
