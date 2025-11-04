import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { X, Check, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface AlbertInvoiceLayoutProps {
  items: any[];
  onUnmap?: (itemId: string) => void;
  supplierId?: string;
  onItemMapped?: (
    itemId: string,
    ingredientId: number,
    ingredientName: string
  ) => void;
}

/**
 * Albert Invoice Layout
 * Special layout for Albert supermarket invoices that don't have product codes
 * Only shows: Name, Quantity, Unit, Price, Total, and mapping status
 */
export function AlbertInvoiceLayout({
  items,
  onUnmap,
  supplierId,
  onItemMapped,
}: AlbertInvoiceLayoutProps) {
  const { toast } = useToast();
  const [selectedIngredients, setSelectedIngredients] = useState<
    Record<string, string>
  >({});
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [mappingIds, setMappingIds] = useState<Set<string>>(new Set());

  // Fetch ingredients for this supplier
  const { data: ingredients = [] } = useQuery({
    queryKey: ["ingredients-for-mapping", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingredients")
        .select("id, name, unit")
        .order("name");

      if (error) throw error;
      return data || [];
    },
    enabled: !!supplierId,
  });

  // Remove diacritics for better matching
  const removeDiacritics = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  // Calculate similarity score between two strings
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = removeDiacritics(str1.toLowerCase());
    const s2 = removeDiacritics(str2.toLowerCase());

    // Check for exact match
    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;

    // Check word overlap
    const words1 = s1.split(/\s+/).filter((w) => w.length > 2);
    const words2 = s2.split(/\s+/).filter((w) => w.length > 2);

    if (words1.length === 0 || words2.length === 0) return 0;

    let matchingWords = 0;
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1.includes(word2) || word2.includes(word1)) {
          matchingWords++;
          break;
        }
      }
    }

    return matchingWords / Math.max(words1.length, words2.length);
  };

  // Filter and sort ingredients based on search term or item description
  const getFilteredIngredients = (
    searchTerm: string,
    itemDescription: string
  ) => {
    let filtered = [...ingredients];

    if (searchTerm) {
      // User is searching - filter by search term
      const query = removeDiacritics(searchTerm.toLowerCase());
      filtered = filtered.filter((ing) =>
        removeDiacritics(ing.name.toLowerCase()).includes(query)
      );
    } else if (itemDescription) {
      // No search term - show suggestions based on item description
      // Calculate similarity for each ingredient
      const scored = filtered.map((ing) => ({
        ...ing,
        similarity: calculateSimilarity(itemDescription, ing.name),
      }));

      // Sort by similarity
      scored.sort((a, b) => b.similarity - a.similarity);

      // If we have good matches (> 20%), show only those
      const goodMatches = scored.filter((item) => item.similarity > 0.2);

      if (goodMatches.length > 0) {
        filtered = goodMatches;
      } else {
        // No good matches - show all ingredients sorted by name
        filtered = scored;
      }
    }

    // Limit to top 50 results
    return filtered.slice(0, 50);
  };

  // Handle mapping an item to an ingredient
  const handleMapIngredient = async (
    itemId: string,
    ingredientId: string,
    productCode: string,
    description: string,
    pricePerKg: number | null
  ) => {
    if (!supplierId || !ingredientId) return;

    setMappingIds((prev) => new Set(prev).add(itemId));

    try {
      const numericIngredientId = parseInt(ingredientId, 10);
      const codeToUse = productCode || description;

      // For Albert, save price per kg (without VAT) as the price
      const priceToSave = pricePerKg || 0;

      // First check if this mapping already exists
      const { data: existing } = await supabase
        .from("ingredient_supplier_codes")
        .select("id")
        .eq("ingredient_id", numericIngredientId)
        .eq("supplier_id", supplierId)
        .eq("product_code", codeToUse)
        .maybeSingle();

      if (existing) {
        // Update existing mapping
        const { error } = await supabase
          .from("ingredient_supplier_codes")
          .update({
            price: priceToSave,
            is_active: true,
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Insert new mapping
        const { error } = await supabase
          .from("ingredient_supplier_codes")
          .insert({
            ingredient_id: numericIngredientId,
            supplier_id: supplierId,
            product_code: codeToUse,
            price: priceToSave,
            is_active: true,
          });

        if (error) throw error;
      }

      // Find ingredient name
      const ingredient = ingredients.find(
        (ing) => ing.id === numericIngredientId
      );

      toast({
        title: "✅ Mapování uloženo",
        description: `${description} → ${ingredient?.name} (${priceToSave.toFixed(2)} Kč/kg)`,
      });

      // Notify parent component
      console.log("🔔 Calling onItemMapped callback:", {
        itemId,
        ingredientId: numericIngredientId,
        ingredientName: ingredient?.name,
        hasCallback: !!onItemMapped,
      });

      if (onItemMapped && ingredient) {
        onItemMapped(itemId, numericIngredientId, ingredient.name);
      } else {
        console.warn(
          "⚠️ onItemMapped callback not available or ingredient not found"
        );
      }

      // Clear selection
      setSelectedIngredients((prev) => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });
    } catch (error) {
      console.error("Error mapping ingredient:", error);
      toast({
        title: "❌ Chyba při ukládání",
        description: "Nepodařilo se uložit mapování",
        variant: "destructive",
      });
    } finally {
      setMappingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  return (
    <div className="overflow-x-auto border border-gray-300 rounded-lg">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-blue-50 border-b-2 border-blue-300">
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Název položky
            </th>
            <th className="text-center px-3 py-2 text-xs font-semibold text-blue-700 border-r border-gray-200">
              Hmotnost
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Množství
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-green-700 border-r border-gray-200 bg-green-50/50">
              Jedn. cena bez DPH
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-purple-700 border-r border-gray-200 bg-purple-50/50">
              Cena/kg bez DPH
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Jedn. cena s DPH
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Celkem bez DPH
            </th>
            <th className="text-center px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              DPH
            </th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">
              Namapováno
            </th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {items?.map((item: any, idx: number) => {
            // Support both field name formats (from upload dialog and from templates)
            // For Albert: product_code should be null/empty, description has the name
            // But handle old incorrect format where product_code had the name
            const description =
              item.description ||
              item.name ||
              (item.product_code && !item.product_code.match(/^\d/)
                ? item.product_code
                : null);
            const itemWeight = item.item_weight || item.weight || "-";
            const quantity = item.quantity || 1;
            const unitOfMeasure = item.unit_of_measure || item.unit || "ks";
            const unitPrice = item.unit_price || item.price || 0;
            const lineTotal = item.line_total || item.total || 0;
            const vatRate = item.vat_rate;

            const priceTotal =
              lineTotal || (quantity && unitPrice ? quantity * unitPrice : 0);

            // Calculate unit price without VAT
            // Formula: price_without_vat = price_with_vat / (1 + vat_rate/100)
            const unitPriceWithoutVat = vatRate
              ? unitPrice / (1 + vatRate / 100)
              : unitPrice;

            // Calculate price per kilogram without VAT
            // Extract weight from itemWeight (e.g., "125g" -> 0.125 kg, "2,5kg" -> 2.5 kg)
            const extractWeightInKg = (weightStr: string): number | null => {
              if (!weightStr || weightStr === "-") return null;

              // Pattern: number followed by unit (g, kg, ml, l)
              const match = weightStr.match(/^([\d,\.]+)\s*(kg|g|ml|l)$/i);
              if (!match) return null;

              const value = parseFloat(match[1].replace(",", "."));
              const unit = match[2].toLowerCase();

              // Convert to kg
              if (unit === "g" || unit === "ml") {
                return value / 1000;
              } else if (unit === "kg" || unit === "l") {
                return value;
              }
              return null;
            };

            const weightInKg = extractWeightInKg(itemWeight);
            const pricePerKgWithoutVat =
              weightInKg && weightInKg > 0
                ? unitPriceWithoutVat / weightInKg
                : null;

            // Support both matching status formats
            const ingredientId =
              item.matched_ingredient_id || item.ingredientId;
            const ingredientName =
              item.matched_ingredient_name || item.ingredientName;
            const suggestedName = item.suggested_ingredient_name;

            // Debug log for first 3 items
            if (idx < 3) {
              console.log(`🎨 AlbertLayout Item ${idx}:`, {
                description: item.description,
                matched_ingredient_id: item.matched_ingredient_id,
                ingredientId: item.ingredientId,
                resolvedIngredientId: ingredientId,
                ingredientName,
                willShowGreenCheck: !!ingredientId,
              });
            }

            return (
              <tr
                key={idx}
                className={`border-b border-gray-200 hover:bg-blue-50/30 ${
                  ingredientId
                    ? ""
                    : suggestedName
                      ? "bg-orange-50/30"
                      : "bg-red-50/30"
                }`}
              >
                <td className="px-3 py-2 text-sm text-gray-900 border-r border-gray-200 font-medium">
                  {description || "-"}
                </td>
                <td className="px-3 py-2 text-center text-sm text-blue-700 border-r border-gray-200 bg-blue-50/50 font-semibold">
                  {itemWeight}
                </td>
                <td className="px-3 py-2 text-right text-sm text-gray-900 border-r border-gray-200">
                  <span className="font-semibold">
                    {quantity?.toLocaleString("cs-CZ")}
                  </span>{" "}
                  <span className="text-gray-500 text-xs">{unitOfMeasure}</span>
                </td>
                <td className="px-3 py-2 text-right text-sm text-green-700 border-r border-gray-200 bg-green-50/30 font-semibold">
                  {unitPriceWithoutVat?.toLocaleString("cs-CZ", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  Kč
                </td>
                <td className="px-3 py-2 text-right text-sm text-purple-700 border-r border-gray-200 bg-purple-50/30 font-bold">
                  {pricePerKgWithoutVat
                    ? `${pricePerKgWithoutVat.toLocaleString("cs-CZ", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} Kč/kg`
                    : "-"}
                </td>
                <td className="px-3 py-2 text-right text-sm text-gray-700 border-r border-gray-200">
                  {unitPrice?.toLocaleString("cs-CZ", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  Kč
                </td>
                <td className="px-3 py-2 text-right text-sm font-medium text-gray-900 border-r border-gray-200">
                  {priceTotal.toLocaleString("cs-CZ", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  Kč
                </td>
                <td className="px-3 py-2 text-center text-sm text-gray-700 border-r border-gray-200">
                  <Badge variant="outline" className="text-xs">
                    {vatRate ? `${vatRate}%` : "-"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-sm">
                  {ingredientId ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 text-green-700">
                        <span className="text-sm">✓</span>
                        {ingredientName}
                      </div>
                      {onUnmap && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                          onClick={() => onUnmap(item.id)}
                          title="Odebrat mapování"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ) : supplierId ? (
                    <div className="flex items-center gap-2">
                      <Select
                        value={selectedIngredients[`item-${idx}`] || ""}
                        onValueChange={(value) =>
                          setSelectedIngredients((prev) => ({
                            ...prev,
                            [`item-${idx}`]: value,
                          }))
                        }
                      >
                        <SelectTrigger className="w-[200px] h-8 text-xs">
                          <SelectValue placeholder="💡 Návrhy suroviny..." />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="p-2 sticky top-0 bg-white z-10">
                            <Input
                              placeholder="Hledat..."
                              value={searchTerms[`item-${idx}`] || ""}
                              onChange={(e) =>
                                setSearchTerms((prev) => ({
                                  ...prev,
                                  [`item-${idx}`]: e.target.value,
                                }))
                              }
                              className="h-8 text-xs"
                            />
                          </div>
                          {(() => {
                            const filteredList = getFilteredIngredients(
                              searchTerms[`item-${idx}`] || "",
                              description
                            );

                            if (filteredList.length === 0) {
                              return (
                                <div className="p-4 text-center text-xs text-muted-foreground">
                                  {ingredients.length === 0
                                    ? "Načítání surovin..."
                                    : searchTerms[`item-${idx}`]
                                      ? `Žádná surovina nenalezena pro "${searchTerms[`item-${idx}`]}"`
                                      : "Žádná surovina nenalezena"}
                                </div>
                              );
                            }

                            return filteredList.map(
                              (ingredient: any, ingIdx: number) => {
                                const similarity = ingredient.similarity || 0;
                                const isTopMatch =
                                  ingIdx === 0 && similarity > 0.5;

                                return (
                                  <SelectItem
                                    key={ingredient.id}
                                    value={ingredient.id.toString()}
                                    className={`text-xs ${
                                      isTopMatch
                                        ? "bg-green-50 font-semibold"
                                        : ""
                                    }`}
                                  >
                                    {isTopMatch && (
                                      <span className="text-green-600 mr-1">
                                        ⭐
                                      </span>
                                    )}
                                    {ingredient.name}{" "}
                                    <span className="text-muted-foreground">
                                      ({ingredient.unit})
                                    </span>
                                    {similarity > 0.5 && (
                                      <span className="ml-2 text-xs text-green-600">
                                        {Math.round(similarity * 100)}%
                                      </span>
                                    )}
                                  </SelectItem>
                                );
                              }
                            );
                          })()}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={() =>
                          handleMapIngredient(
                            `item-${idx}`,
                            selectedIngredients[`item-${idx}`],
                            item.product_code || "",
                            description,
                            pricePerKgWithoutVat
                          )
                        }
                        disabled={
                          !selectedIngredients[`item-${idx}`] ||
                          mappingIds.has(`item-${idx}`)
                        }
                        className="h-8 w-8 p-0"
                      >
                        {mappingIds.has(`item-${idx}`) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ) : suggestedName ? (
                    <div className="flex items-center gap-1 text-orange-600">
                      <span className="text-sm">⚠</span>
                      {suggestedName}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-red-600">
                      <span className="text-sm">✗</span>
                      Nenamapováno
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {items && items.length > 0 && (
        <div className="px-3 py-2 bg-gray-50 border-t border-gray-300 text-xs text-gray-600">
          <p className="mb-1">
            <strong>ℹ️ Albert formát:</strong> Položky nemají kódy dodavatele -
            mapování pouze podle názvu
          </p>
          {supplierId ? (
            <p className="text-xs text-gray-500">
              💡 Namapujte suroviny přímo v tabulce - vyberte surovinu a
              klikněte na ✓
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              Pro namapování přejděte do{" "}
              <strong>Admin → Suroviny → Kódy dodavatelů</strong> a přidejte
              mapování podle názvu (např. "RYBÍZ ČERVENÝ" → surovina)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
