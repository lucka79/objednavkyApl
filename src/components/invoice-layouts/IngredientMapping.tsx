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
import { X, Check, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface IngredientMappingProps {
  itemId: string;
  productCode: string;
  description: string;
  unitPrice?: number;
  supplierId?: string;
  supplierIngredients?: any[];

  // Already mapped ingredient info
  ingredientId?: number;
  ingredientName?: string;
  suggestedName?: string;
  confidence?: number;

  // Callbacks
  onUnmap?: (itemId: string) => void;
  onItemMapped?: (itemId: string, ingredientId: number) => void;
}

export function IngredientMapping({
  itemId,
  productCode,
  description,
  unitPrice,
  supplierId,
  supplierIngredients,
  ingredientId,
  ingredientName,
  suggestedName,
  confidence,
  onUnmap,
  onItemMapped,
}: IngredientMappingProps) {
  const { toast } = useToast();
  const [selectedIngredient, setSelectedIngredient] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isMappingInProgress, setIsMappingInProgress] = useState(false);
  const [forceShowDropdown, setForceShowDropdown] = useState(false);

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
  const getFilteredIngredients = () => {
    let filtered = [...(supplierIngredients || [])];

    // Filter by supplier if provided
    if (supplierId) {
      filtered = filtered.filter((ing: any) => {
        return !ing.supplier_id || ing.supplier_id === supplierId;
      });
    }

    if (searchTerm) {
      // User is searching - filter by search term
      const query = removeDiacritics(searchTerm.toLowerCase());
      filtered = filtered.filter((ing: any) =>
        removeDiacritics(ing.name.toLowerCase()).includes(query)
      );
    } else if (description || productCode) {
      // No search term - show suggestions based on item description/code
      const scored = filtered.map((ing: any) => {
        // Check for exact product code match
        const hasExactCode = ing.ingredient_supplier_codes?.some(
          (code: any) =>
            code.product_code?.toLowerCase() === productCode?.toLowerCase()
        );

        // Calculate description similarity
        const descSimilarity = description
          ? calculateSimilarity(description, ing.name)
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
        filtered = scored;
      }
    }

    // Limit to top 50 results
    return filtered.slice(0, 50);
  };

  // Handle mapping an item to an ingredient
  const handleMapIngredient = async () => {
    if (!supplierId || !selectedIngredient) return;

    setIsMappingInProgress(true);

    try {
      const numericIngredientId = parseInt(selectedIngredient, 10);
      const codeToUse = productCode || description;

      console.log("📝 Mapping ingredient:", {
        itemId,
        ingredientId: numericIngredientId,
        productCode,
        description,
        unitPrice,
        supplierId,
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

      if (existing) {
        // Update existing mapping with latest price
        console.log("🔄 Updating existing mapping");
        const { error: updateError } = await supabase
          .from("ingredient_supplier_codes")
          .update({
            price: unitPrice || 0,
          })
          .eq("id", existing.id);

        if (updateError) throw updateError;
      } else {
        // Insert new mapping
        console.log("➕ Inserting new mapping");
        const { error: insertError } = await supabase
          .from("ingredient_supplier_codes")
          .insert({
            ingredient_id: numericIngredientId,
            supplier_id: supplierId,
            product_code: codeToUse,
            price: unitPrice || 0,
          });

        if (insertError) throw insertError;
      }

      // Find ingredient name
      const ingredient = supplierIngredients?.find(
        (ing: any) => ing.id === numericIngredientId
      );

      toast({
        title: "✅ Mapování uloženo",
        description: `${productCode || description} → ${ingredient?.name}`,
      });

      // Notify parent component
      if (onItemMapped) {
        console.log("📢 Calling onItemMapped callback");
        onItemMapped(itemId, numericIngredientId);
      }

      // Clear selection and reset dropdown state
      setSelectedIngredient("");
      setSearchTerm("");
      setForceShowDropdown(false);
    } catch (error) {
      console.error("❌ Error mapping ingredient:", error);
      toast({
        title: "❌ Chyba při ukládání",
        description: `Nepodařilo se uložit mapování: ${(error as any)?.message || "Neznámá chyba"}`,
        variant: "destructive",
      });
    } finally {
      setIsMappingInProgress(false);
    }
  };

  const confidencePercent =
    confidence && confidence <= 1 ? confidence * 100 : confidence || 100;
  const isLowConfidence = confidencePercent < 100;

  // If already mapped but user clicked X, show dropdown immediately
  if (ingredientId && !forceShowDropdown) {
    return (
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
              className={`h-5 w-5 p-0 ${
                isLowConfidence
                  ? "text-orange-600 hover:text-orange-800 hover:bg-orange-100 ring-2 ring-orange-300"
                  : "text-red-600 hover:text-red-800 hover:bg-red-50"
              }`}
              onClick={() => {
                console.log("🗑️ Unmapping item:", {
                  itemId,
                  productCode,
                  description,
                  ingredientId,
                  ingredientName,
                  confidence: confidencePercent,
                });
                setForceShowDropdown(true);
                onUnmap(itemId);
              }}
              title={
                isLowConfidence
                  ? `Nízká shoda (${confidencePercent.toFixed(0)}%) - klikněte pro změnu`
                  : "Odebrat mapování"
              }
            >
              <X className={isLowConfidence ? "h-3.5 w-3.5" : "h-3 w-3"} />
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
    );
  }

  // If not mapped (or user just clicked unmap) and we have supplier ingredients, show mapping UI
  if (supplierId && supplierIngredients && (forceShowDropdown || !ingredientId)) {
    const filteredList = getFilteredIngredients();

    return (
      <div className="flex items-center gap-2">
        <Select
          value={selectedIngredient}
          onValueChange={setSelectedIngredient}
        >
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue placeholder="💡 Návrhy suroviny..." />
          </SelectTrigger>
          <SelectContent>
            <div className="p-2 sticky top-0 bg-white z-10">
              <Input
                placeholder="Hledat..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            {filteredList.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                {supplierIngredients.length === 0
                  ? "Načítání surovin..."
                  : searchTerm
                    ? `Žádná surovina nenalezena pro "${searchTerm}"`
                    : "Žádná surovina nenalezena"}
              </div>
            ) : (
              filteredList.map((ingredient: any, idx: number) => {
                const similarity = ingredient.similarity || 0;
                const isTopMatch = idx === 0 && similarity > 0.5;
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
                      <span className="text-green-600 mr-1">✓</span>
                    )}
                    {!hasExactCode && isTopMatch && (
                      <span className="text-blue-600 mr-1">⭐</span>
                    )}
                    {ingredient.name}
                    {similarity > 0.5 && !hasExactCode && (
                      <span className="ml-2 text-xs text-blue-600">
                        {Math.round(similarity * 100)}%
                      </span>
                    )}
                  </SelectItem>
                );
              })
            )}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={handleMapIngredient}
          disabled={!selectedIngredient || isMappingInProgress}
          className="h-8 w-8 p-0"
        >
          {isMappingInProgress ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  // Fallback: show suggested name or unmapped status
  if (suggestedName) {
    return (
      <div className="flex items-center gap-1 text-orange-600">
        <span className="text-sm">⚠</span>
        {suggestedName}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-red-600">
      <span className="text-sm">✗</span>
      Nenamapováno
    </div>
  );
}
