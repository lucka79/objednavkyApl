import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, AlertTriangle, Pencil, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface DekosInvoiceLayoutProps {
  items: any[];
  supplierId?: string;
  onUnmap?: (itemId: string) => void;
  onItemMapped?: (itemId: string, ingredientId: number) => void;
  supplierIngredients?: any[];
  editedUnitPrices?: { [key: string]: number };
  setEditedUnitPrices?: (value: { [key: string]: number }) => void;
  editingItemId?: string | null;
  setEditingItemId?: (id: string | null) => void;
  editingField?: string | null;
  setEditingField?: (field: string | null) => void;
}

// Helper function to convert unit of measure to multiplier
const getUnitMultiplier = (unitOfMeasure: string): number => {
  if (!unitOfMeasure) return 1;

  const unit = unitOfMeasure.toLowerCase().trim();

  // Thousands (tisíce)
  if (unit === "tis" || unit === "tisíce") return 1000;

  // Hundreds (stovky)
  if (unit === "100" || unit === "sto") return 100;

  // Dozens (tucty)
  if (unit === "12" || unit === "tuc") return 12;

  // Pieces (kusy)
  if (unit === "1ks" || unit === "ks" || unit === "kus" || unit === "kusy")
    return 1;

  // Packages (balení)
  if (unit === "bal" || unit === "balení") return 1;

  // Try to parse as number (e.g., "50", "100")
  const numericUnit = parseInt(unit);
  if (!isNaN(numericUnit)) return numericUnit;

  // Default to 1 for unknown units
  return 1;
};

export function DekosInvoiceLayout({
  items,
  supplierId,
  onUnmap,
  onItemMapped,
  supplierIngredients,
  editedUnitPrices,
  setEditedUnitPrices,
  editingItemId,
  setEditingItemId,
  editingField,
  setEditingField,
}: DekosInvoiceLayoutProps) {
  const { toast } = useToast();
  const [selectedIngredients, setSelectedIngredients] = useState<
    Record<string, string>
  >({});
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [mappingIds, setMappingIds] = useState<Set<string>>(new Set());

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
    itemDescription: string,
    productCode: string
  ) => {
    let filtered = [...(supplierIngredients || [])];

    // Filter by supplier if provided
    if (supplierId) {
      filtered = filtered.filter((ing: any) => {
        // If supplier_id exists, check it matches
        // If no supplier_id, include it (might be available to all)
        return !ing.supplier_id || ing.supplier_id === supplierId;
      });
    }

    if (searchTerm) {
      // User is searching - filter by search term
      const query = removeDiacritics(searchTerm.toLowerCase());
      filtered = filtered.filter((ing: any) =>
        removeDiacritics(ing.name.toLowerCase()).includes(query)
      );
    } else if (itemDescription || productCode) {
      // No search term - show suggestions based on item description/code
      // Calculate similarity for each ingredient
      const scored = filtered.map((ing: any) => {
        // Check for exact product code match
        const hasExactCode = ing.ingredient_supplier_codes?.some(
          (code: any) =>
            code.product_code?.toLowerCase() === productCode?.toLowerCase()
        );

        // Calculate description similarity
        const descSimilarity = itemDescription
          ? calculateSimilarity(itemDescription, ing.name)
          : 0;

        return {
          ...ing,
          hasExactCode,
          similarity: hasExactCode ? 1.0 : descSimilarity,
        };
      });

      // Sort: exact code matches first, then by similarity
      scored.sort((a, b) => {
        if (a.hasExactCode && !b.hasExactCode) return -1;
        if (!a.hasExactCode && b.hasExactCode) return 1;
        return b.similarity - a.similarity;
      });

      // If we have good matches (> 20%), show only those
      const goodMatches = scored.filter((item: any) => item.similarity > 0.2);

      if (goodMatches.length > 0) {
        filtered = goodMatches;
      } else {
        // No good matches - show all ingredients sorted by similarity
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
    unitPrice: number
  ) => {
    console.log("🔧 handleMapIngredient called:", {
      itemId,
      ingredientId,
      productCode,
      description,
      unitPrice,
      supplierId,
    });

    if (!supplierId || !ingredientId) {
      console.warn("⚠️ Missing required fields:", {
        supplierId: !!supplierId,
        ingredientId: !!ingredientId,
      });
      return;
    }

    setMappingIds((prev) => new Set(prev).add(itemId));

    try {
      const numericIngredientId = parseInt(ingredientId, 10);
      const codeToUse = productCode || description;

      console.log("📝 Checking for existing mapping:", {
        numericIngredientId,
        supplierId,
        codeToUse,
      });

      // First check if this mapping already exists
      const { data: existing, error: checkError } = await supabase
        .from("ingredient_supplier_codes")
        .select("id")
        .eq("ingredient_id", numericIngredientId)
        .eq("supplier_id", supplierId)
        .eq("product_code", codeToUse)
        .maybeSingle();

      if (checkError) {
        console.error("❌ Error checking existing mapping:", checkError);
        throw checkError;
      }

      console.log("🔍 Existing mapping check result:", existing);

      if (existing) {
        // Update existing mapping with latest price
        console.log("🔄 Updating existing mapping with new price:", unitPrice);
        const { error: updateError } = await supabase
          .from("ingredient_supplier_codes")
          .update({
            price: unitPrice || 0,
          })
          .eq("id", existing.id);

        if (updateError) {
          console.error("❌ Update error:", {
            error: updateError,
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint,
          });
          throw updateError;
        }

        console.log("✅ Mapping updated successfully");
      } else {
        console.log("➕ Inserting new mapping with price:", unitPrice);
        // Insert new mapping
        const { data: insertData, error: insertError } = await supabase
          .from("ingredient_supplier_codes")
          .insert({
            ingredient_id: numericIngredientId,
            supplier_id: supplierId,
            product_code: codeToUse,
            price: unitPrice || 0,
          })
          .select();

        if (insertError) {
          console.error("❌ Insert error:", {
            error: insertError,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
          });
          throw insertError;
        }

        console.log("✅ Mapping inserted successfully:", insertData);
      }

      // Find ingredient name
      const ingredient = supplierIngredients?.find(
        (ing: any) => ing.id === numericIngredientId
      );

      console.log("🎯 Found ingredient:", ingredient);

      toast({
        title: "✅ Mapování uloženo",
        description: `${productCode || description} → ${ingredient?.name}`,
      });

      // Notify parent component
      if (onItemMapped && ingredient) {
        console.log("📢 Calling onItemMapped callback");
        onItemMapped(itemId, numericIngredientId);
      }

      // Clear selection
      setSelectedIngredients((prev) => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });
      setSearchTerms((prev) => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });
    } catch (error) {
      console.error("❌ Error mapping ingredient:", error);
      console.error("Error details:", {
        message: (error as any)?.message,
        details: (error as any)?.details,
        hint: (error as any)?.hint,
        code: (error as any)?.code,
      });
      toast({
        title: "❌ Chyba při ukládání",
        description: `Nepodařilo se uložit mapování: ${(error as any)?.message || "Neznámá chyba"}`,
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
              Kód
            </th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Název položky
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Množství
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-blue-700 border-r border-gray-200">
              Celk. ks
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              <div className="flex items-center justify-end gap-1">
                Jedn. cena
                <Pencil className="w-3 h-3 text-gray-400" />
              </div>
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-purple-700 border-r border-gray-200">
              Cena/kus
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Celkem bez DPH
            </th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">
              Namapováno
            </th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {items?.map((item: any, idx: number) => {
            // Support both field name formats (from upload dialog and from templates)
            const productCode = item.product_code || item.supplierCode;
            const description = item.description || item.name;
            const quantity = item.quantity;
            const unitOfMeasure = item.unit_of_measure || item.unit;
            const unitPrice = item.unit_price || item.price;
            const lineTotal = item.line_total || item.total;

            // Use edited unit price if available
            const finalUnitPrice = editedUnitPrices?.[item.id] ?? unitPrice;
            const priceTotal =
              lineTotal ||
              (quantity && finalUnitPrice ? quantity * finalUnitPrice : 0);

            // Calculate total quantity in base units (pieces)
            const unitMultiplier = getUnitMultiplier(unitOfMeasure || "");
            const totalQuantity = quantity * unitMultiplier;

            // Calculate price per single item
            // unitPrice is price per unit_of_measure (e.g., per tis, per 100, per 1ks)
            // So to get price per single piece, divide by the multiplier
            const pricePerItem =
              unitMultiplier > 0 ? finalUnitPrice / unitMultiplier : 0;

            // Support both matching status formats
            const ingredientId =
              item.matched_ingredient_id || item.ingredientId;
            const ingredientName =
              item.matched_ingredient_name || item.ingredientName;
            const suggestedName = item.suggested_ingredient_name;

            // Get confidence (could be 0-1 or 0-100 range)
            const confidence =
              item.confidence ||
              item.matching_confidence ||
              item.match_confidence ||
              100;
            const confidencePercent =
              confidence <= 1 ? confidence * 100 : confidence;
            const isLowConfidence = confidencePercent < 100;

            return (
              <tr
                key={idx}
                className={`border-b border-gray-200 hover:bg-blue-50/30 ${
                  isLowConfidence
                    ? "bg-yellow-50/50 border-l-4 border-l-yellow-500"
                    : ingredientId
                      ? ""
                      : suggestedName
                        ? "bg-orange-50/30"
                        : "bg-red-50/30"
                }`}
              >
                <td className="px-3 py-2 border-r border-gray-200">
                  <code className="text-xs bg-blue-100 text-gray-700 px-2 py-0.5 rounded font-mono">
                    {productCode || "???"}
                  </code>
                </td>
                <td className="px-3 py-2 text-sm text-gray-900 border-r border-gray-200">
                  {description || "-"}
                </td>
                <td className="px-3 py-2 text-right text-sm text-gray-900 border-r border-gray-200">
                  <span className="font-semibold">
                    {quantity?.toLocaleString("cs-CZ")}
                  </span>{" "}
                  <span className="text-gray-500 text-xs">{unitOfMeasure}</span>
                </td>
                <td className="px-3 py-2 text-right text-xs font-bold text-blue-700 border-r border-gray-200 bg-blue-50/50">
                  {totalQuantity.toLocaleString("cs-CZ", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}{" "}
                  <span className="text-gray-500">ks</span>
                </td>
                <td className="px-3 py-2 text-right text-sm text-gray-700 border-r border-gray-200">
                  {editingItemId === item.id && editingField === "unitPrice" ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={
                        editedUnitPrices?.[item.id] !== undefined
                          ? editedUnitPrices[item.id].toString()
                          : unitPrice?.toString() || "0"
                      }
                      onChange={(e) => {
                        const value = e.target.value;
                        if (setEditedUnitPrices) {
                          setEditedUnitPrices({
                            ...(editedUnitPrices || {}),
                            [item.id]: parseFloat(value) || 0,
                          });
                        }
                      }}
                      onBlur={() => {
                        if (setEditingItemId) setEditingItemId(null);
                        if (setEditingField) setEditingField(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (setEditingItemId) setEditingItemId(null);
                          if (setEditingField) setEditingField(null);
                        }
                        if (e.key === "Escape") {
                          if (setEditedUnitPrices && editedUnitPrices) {
                            const newState = { ...editedUnitPrices };
                            delete newState[item.id];
                            setEditedUnitPrices(newState);
                          }
                          if (setEditingItemId) setEditingItemId(null);
                          if (setEditingField) setEditingField(null);
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      autoFocus
                      className="h-7 text-sm text-right w-24 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  ) : (
                    <span
                      onClick={() => {
                        if (setEditingItemId && setEditingField) {
                          setEditingItemId(item.id);
                          setEditingField("unitPrice");
                        }
                      }}
                      className="cursor-pointer hover:bg-gray-100 px-1 rounded inline-block"
                      title="Klikněte pro úpravu"
                    >
                      {finalUnitPrice?.toLocaleString("cs-CZ", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      Kč
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-xs font-semibold text-purple-700 border-r border-gray-200 bg-purple-50/50">
                  {pricePerItem.toLocaleString("cs-CZ", {
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 4,
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
                <td className="px-3 py-2 text-sm">
                  {ingredientId ? (
                    <div className="space-y-1">
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
                      {isLowConfidence && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300 flex items-center gap-1 w-fit"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Zkontrolovat ({confidencePercent.toFixed(0)}%)
                        </Badge>
                      )}
                    </div>
                  ) : supplierId && supplierIngredients ? (
                    <div className="flex items-center gap-2">
                      <Select
                        value={selectedIngredients[item.id] || ""}
                        onValueChange={(value) =>
                          setSelectedIngredients((prev) => ({
                            ...prev,
                            [item.id]: value,
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
                              value={searchTerms[item.id] || ""}
                              onChange={(e) =>
                                setSearchTerms((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              className="h-8 text-xs"
                            />
                          </div>
                          {(() => {
                            const filteredList = getFilteredIngredients(
                              searchTerms[item.id] || "",
                              description,
                              productCode
                            );

                            if (filteredList.length === 0) {
                              return (
                                <div className="p-4 text-center text-xs text-muted-foreground">
                                  {supplierIngredients.length === 0
                                    ? "Načítání surovin..."
                                    : searchTerms[item.id]
                                      ? `Žádná surovina nenalezena pro "${searchTerms[item.id]}"`
                                      : "Žádná surovina nenalezena"}
                                </div>
                              );
                            }

                            return filteredList.map(
                              (ingredient: any, ingIdx: number) => {
                                const similarity = ingredient.similarity || 0;
                                const isTopMatch =
                                  ingIdx === 0 && similarity > 0.5;
                                const hasExactCode = ingredient.hasExactCode;

                                return (
                                  <SelectItem
                                    key={ingredient.id}
                                    value={ingredient.id.toString()}
                                    className={`text-xs ${
                                      hasExactCode
                                        ? "bg-green-50 font-semibold"
                                        : isTopMatch
                                          ? "bg-blue-50 font-semibold"
                                          : ""
                                    }`}
                                  >
                                    {hasExactCode && (
                                      <span className="text-green-600 mr-1">
                                        ✓
                                      </span>
                                    )}
                                    {!hasExactCode && isTopMatch && (
                                      <span className="text-blue-600 mr-1">
                                        ⭐
                                      </span>
                                    )}
                                    {ingredient.name}
                                    {similarity > 0.5 && !hasExactCode && (
                                      <span className="ml-2 text-xs text-blue-600">
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
                            item.id,
                            selectedIngredients[item.id],
                            productCode,
                            description,
                            finalUnitPrice
                          )
                        }
                        disabled={
                          !selectedIngredients[item.id] ||
                          mappingIds.has(item.id)
                        }
                        className="h-8 w-8 p-0"
                      >
                        {mappingIds.has(item.id) ? (
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
                      Neznámý kód
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
