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
import { Plus, Trash2, Save, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useRecipes } from "@/hooks/useRecipes";
import { useIngredients } from "@/hooks/useIngredients";
import { fetchAllProducts } from "@/hooks/useProducts";
import { useQueryClient } from "@tanstack/react-query";

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
      return ingredient?.unit || "";
    }
    return "ks";
  };

  const getPartPrice = (part: ProductPart) => {
    if (part.ingredient_id) {
      const ingredient = ingredients.find((i) => i.id === part.ingredient_id);
      return ingredient?.price ? ingredient.price * part.quantity : 0;
    }
    if (part.recipe_id) {
      const recipe = recipes.find((r) => r.id === part.recipe_id);
      return recipe?.price ? recipe.price * part.quantity : 0;
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
