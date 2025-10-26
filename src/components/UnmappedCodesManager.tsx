import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useUnmappedCodes } from "@/hooks/useUnmappedCodes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { AlertCircle, Check, X, RotateCcw, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UnmappedCodesManagerProps {
  supplierId?: string;
}

interface IngredientWithCode {
  id: number;
  name: string;
  unit: string;
  product_code: string | null;
  all_codes?: string[];
  supplier_ingredient_name: string | null;
}

export function UnmappedCodesManager({
  supplierId,
}: UnmappedCodesManagerProps) {
  const {
    pendingCodes,
    mappedCodes,
    ignoredCodes,
    isLoading,
    mapCode,
    ignoreCode,
    resetCode,
    deleteCode,
  } = useUnmappedCodes(supplierId);

  // Fetch ingredients WITH their supplier codes for this supplier
  const { data: ingredientsWithCodes = [] } = useQuery<IngredientWithCode[]>({
    queryKey: ["ingredients-with-codes", supplierId],
    queryFn: async () => {
      if (!supplierId) return [];

      const { data, error } = await supabase
        .from("ingredient_supplier_codes")
        .select(
          `
          product_code,
          supplier_ingredient_name,
          is_active,
          ingredient:ingredients!ingredient_supplier_codes_ingredient_id_fkey(
            id,
            name,
            unit
          )
        `
        )
        .eq("supplier_id", supplierId)
        .order("is_active", { ascending: false }) // Active first
        .order("product_code", { ascending: true });

      if (error) throw error;

      // Flatten and deduplicate by ingredient ID, keeping ALL codes
      const ingredientCodesMap = new Map<number, string[]>();
      const ingredientDetails = new Map<number, any>();

      data.forEach((item: any) => {
        if (item.ingredient) {
          const ingredientId = item.ingredient.id;

          // Store ingredient details
          if (!ingredientDetails.has(ingredientId)) {
            ingredientDetails.set(ingredientId, {
              id: item.ingredient.id,
              name: item.ingredient.name,
              unit: item.ingredient.unit,
              supplier_ingredient_name: item.supplier_ingredient_name,
            });
          }

          // Collect all product codes
          if (!ingredientCodesMap.has(ingredientId)) {
            ingredientCodesMap.set(ingredientId, []);
          }
          ingredientCodesMap.get(ingredientId)!.push(item.product_code);
        }
      });

      // Merge codes and details
      return Array.from(ingredientDetails.values()).map((ingredient) => ({
        ...ingredient,
        product_code: ingredientCodesMap.get(ingredient.id)![0], // Primary code for sorting
        all_codes: ingredientCodesMap.get(ingredient.id)!, // All codes
      }));
    },
    enabled: !!supplierId,
  });

  // Helper to get product codes for a suggested ingredient
  const getProductCodesForIngredient = (
    ingredientId: number | null
  ): string[] => {
    if (!ingredientId) return [];
    const match = ingredientsWithCodes.find((ing) => ing.id === ingredientId);
    return (
      match?.all_codes || (match?.product_code ? [match.product_code] : [])
    );
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIngredients, setSelectedIngredients] = useState<
    Record<string, string>
  >({});

  const handleMapCode = (codeId: string, ingredientId: string | number) => {
    // Convert string ID to number for database
    const numericIngredientId =
      typeof ingredientId === "string"
        ? parseInt(ingredientId, 10)
        : ingredientId;
    mapCode({ codeId, ingredientId: numericIngredientId, createMapping: true });
    setSelectedIngredients((prev) => {
      const newState = { ...prev };
      delete newState[codeId];
      return newState;
    });
  };

  // Map all codes with suggestions
  const handleMapAllSuggestions = () => {
    const codesToMap = pendingCodes.filter(
      (code) => code.suggested_ingredient_id
    );

    if (codesToMap.length === 0) {
      return;
    }

    if (
      !confirm(
        `Potvrdit ${codesToMap.length} návrhů?\n\nVšechny kódy s návrhy budou automaticky namapovány.`
      )
    ) {
      return;
    }

    // Map all codes sequentially
    codesToMap.forEach((code) => {
      handleMapCode(code.id, code.suggested_ingredient_id!);
    });
  };

  // Regenerate suggestions for existing unmapped codes
  const handleRegenerateSuggestions = async () => {
    if (!supplierId) {
      alert("Vyberte dodavatele");
      return;
    }

    if (
      !confirm(
        `Aktualizovat návrhy pro ${pendingCodes.length} kódů?\n\nSystemově vygeneruje návrhy založené na product_code a názvu.`
      )
    ) {
      return;
    }

    let updatedCount = 0;

    for (const code of pendingCodes) {
      try {
        // Try to find suggestion based on product_code similarity
        const { data: codeMatches } = await supabase
          .from("ingredient_supplier_codes")
          .select(
            `
            ingredient_id,
            product_code,
            ingredients!inner(id, name, unit)
          `
          )
          .eq("supplier_id", supplierId)
          .limit(50);

        let bestMatch = null;
        let bestScore = 0;

        if (codeMatches && codeMatches.length > 0) {
          for (const candidate of codeMatches) {
            const candidateCode = candidate.product_code.toLowerCase();
            const searchCode = code.product_code.toLowerCase();

            let score = 0;

            if (candidateCode === searchCode) {
              score = 1.0;
            } else if (
              candidateCode.startsWith(searchCode) ||
              searchCode.startsWith(candidateCode)
            ) {
              score = 0.8;
            } else if (
              candidateCode.includes(searchCode) ||
              searchCode.includes(candidateCode)
            ) {
              score = 0.6;
            } else if (
              candidateCode.substring(0, 3) === searchCode.substring(0, 3)
            ) {
              score = 0.5;
            }

            if (score > bestScore) {
              bestScore = score;
              bestMatch = candidate;
            }
          }
        }

        // Update with suggestion
        if (bestMatch && bestScore >= 0.5) {
          const ingredient = Array.isArray(bestMatch.ingredients)
            ? bestMatch.ingredients[0]
            : bestMatch.ingredients;

          await supabase
            .from("unmapped_product_codes")
            .update({
              suggested_ingredient_id: ingredient.id,
              suggestion_confidence: bestScore,
            })
            .eq("id", code.id);
          updatedCount++;
        }
      } catch (error) {
        console.error(
          `Failed to update suggestions for code ${code.product_code}:`,
          error
        );
      }
    }

    alert(
      `✅ Hotovo!\n\nAktualizováno návrhů: ${updatedCount}/${pendingCodes.length}`
    );

    // Refresh the data
    window.location.reload();
  };

  // Smart filter and sort ingredients by similarity to unmapped code
  const getFilteredIngredients = (
    searchQuery: string,
    unmappedCode?: string
  ) => {
    let filtered = ingredientsWithCodes;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (ing) =>
          ing.name.toLowerCase().includes(query) ||
          ing.product_code?.toLowerCase().includes(query) ||
          ing.all_codes?.some((code: string) =>
            code.toLowerCase().includes(query)
          ) ||
          ing.supplier_ingredient_name?.toLowerCase().includes(query)
      );
    }

    // Sort by similarity to unmapped code
    if (unmappedCode) {
      const code = unmappedCode.toLowerCase();
      filtered = [...filtered].sort((a, b) => {
        // Check all codes for matches
        const aExactMatch = a.all_codes?.some(
          (c: string) => c.toLowerCase() === code
        )
          ? 1000
          : 0;
        const bExactMatch = b.all_codes?.some(
          (c: string) => c.toLowerCase() === code
        )
          ? 1000
          : 0;

        const aPartialMatch = a.all_codes?.some((c: string) =>
          c.toLowerCase().includes(code)
        )
          ? 100
          : 0;
        const bPartialMatch = b.all_codes?.some((c: string) =>
          c.toLowerCase().includes(code)
        )
          ? 100
          : 0;

        // Name similarity
        const aNameMatch = a.name.toLowerCase().includes(code) ? 10 : 0;
        const bNameMatch = b.name.toLowerCase().includes(code) ? 10 : 0;

        const aScore = aExactMatch + aPartialMatch + aNameMatch;
        const bScore = bExactMatch + bPartialMatch + bNameMatch;

        return bScore - aScore;
      });
    }

    return filtered;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("cs-CZ");
  };

  const formatPrice = (price: number | null) => {
    if (!price) return "-";
    return new Intl.NumberFormat("cs-CZ", {
      style: "currency",
      currency: "CZK",
    }).format(price);
  };

  if (isLoading) {
    return <div className="p-4">Načítání...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nenamapované kódy produktů</CardTitle>
        <CardDescription>
          Kódy nalezené ve fakturách, které nemají přiřazenou surovinu
        </CardDescription>
        {pendingCodes.length > 0 && (
          <Alert className="mt-4 bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm">
              <strong>💡 Tip:</strong> Dropdown zobrazuje{" "}
              <strong>product_code → název suroviny</strong>. Seznam je
              automaticky seřazen podle podobnosti s kódem na faktuře.
              <br />
              <strong>Vyberte správnou surovinu</strong> a klikněte na ✓ pro
              namapování.
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>
      <CardContent>
        {pendingCodes.length === 0 &&
        mappedCodes.length === 0 &&
        ignoredCodes.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Žádné nenamapované kódy nenalezeny. Všechny kódy z faktur mají
              přiřazenou surovinu.
            </AlertDescription>
          </Alert>
        ) : (
          <Tabs defaultValue="pending">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">
                Čekající ({pendingCodes.length})
              </TabsTrigger>
              <TabsTrigger value="mapped">
                Namapované ({mappedCodes.length})
              </TabsTrigger>
              <TabsTrigger value="ignored">
                Ignorované ({ignoredCodes.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              {pendingCodes.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Žádné čekající kódy k namapování.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-end gap-2">
                    {pendingCodes.length > 0 && (
                      <Button
                        onClick={handleRegenerateSuggestions}
                        size="sm"
                        variant="outline"
                        className="gap-2"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Aktualizovat návrhy
                      </Button>
                    )}
                    {pendingCodes.some(
                      (code) => code.suggested_ingredient_id
                    ) && (
                      <Button
                        onClick={handleMapAllSuggestions}
                        size="sm"
                        className="gap-2"
                      >
                        <Check className="h-4 w-4" />
                        Potvrdit všechny návrhy (
                        {
                          pendingCodes.filter(
                            (code) => code.suggested_ingredient_id
                          ).length
                        }
                        )
                      </Button>
                    )}
                  </div>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Kód</TableHead>
                          <TableHead>Popis</TableHead>
                          <TableHead className="text-right">Výskytů</TableHead>
                          <TableHead className="text-right">
                            Posl. cena
                          </TableHead>
                          <TableHead className="text-right">
                            Posl. množství
                          </TableHead>
                          <TableHead>Návrh</TableHead>
                          <TableHead>Přiřadit surovinu</TableHead>
                          <TableHead className="text-right">Akce</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingCodes.map((code) => (
                          <TableRow key={code.id}>
                            <TableCell className="font-mono font-semibold">
                              {code.product_code}
                            </TableCell>
                            <TableCell>{code.description || "-"}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">
                                {code.occurrence_count}×
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPrice(code.last_seen_price)}
                            </TableCell>
                            <TableCell className="text-right">
                              {code.last_seen_quantity
                                ? `${code.last_seen_quantity} ${code.unit_of_measure || ""}`
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {code.suggested_ingredient ? (
                                <div className="flex items-center gap-2">
                                  {(() => {
                                    const productCodes =
                                      getProductCodesForIngredient(
                                        code.suggested_ingredient_id
                                      );
                                    return (
                                      <span className="text-sm">
                                        {productCodes.length > 0 && (
                                          <>
                                            <span className="font-mono font-semibold text-blue-600">
                                              {productCodes.join(", ")}
                                            </span>
                                            <span className="text-muted-foreground mx-1">
                                              →
                                            </span>
                                          </>
                                        )}
                                        <span className="font-medium">
                                          {code.suggested_ingredient.name}
                                        </span>
                                      </span>
                                    );
                                  })()}
                                  <Badge variant="outline">
                                    {Math.round(
                                      (code.suggestion_confidence || 0) * 100
                                    )}
                                    %
                                  </Badge>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">
                                  Žádný návrh
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={selectedIngredients[code.id] || ""}
                                onValueChange={(value) =>
                                  setSelectedIngredients((prev) => ({
                                    ...prev,
                                    [code.id]: value,
                                  }))
                                }
                              >
                                <SelectTrigger className="w-[280px]">
                                  <SelectValue placeholder="Vyberte surovinu" />
                                </SelectTrigger>
                                <SelectContent>
                                  <div className="p-2 sticky top-0 bg-white z-10">
                                    <Input
                                      placeholder="Hledat kód nebo název..."
                                      onChange={(e) =>
                                        setSearchTerm(e.target.value)
                                      }
                                      className="mb-2"
                                    />
                                  </div>
                                  {getFilteredIngredients(
                                    searchTerm,
                                    code.product_code
                                  ).map((ingredient) => (
                                    <SelectItem
                                      key={ingredient.id}
                                      value={ingredient.id.toString()}
                                    >
                                      <span className="font-mono font-semibold text-blue-600">
                                        {ingredient.all_codes &&
                                        ingredient.all_codes.length > 1
                                          ? ingredient.all_codes.join(", ")
                                          : ingredient.product_code || "???"}
                                      </span>
                                      {" → "}
                                      <span className="font-medium">
                                        {ingredient.name}
                                      </span>
                                      <span className="text-muted-foreground text-xs ml-1">
                                        ({ingredient.unit})
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const ingredientId =
                                      selectedIngredients[code.id] ||
                                      (code.suggested_ingredient_id?.toString() ??
                                        null);
                                    if (ingredientId) {
                                      handleMapCode(code.id, ingredientId);
                                    }
                                  }}
                                  disabled={
                                    !selectedIngredients[code.id] &&
                                    !code.suggested_ingredient_id
                                  }
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => ignoreCode(code.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="mapped">
              {mappedCodes.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Žádné namapované kódy.</AlertDescription>
                </Alert>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kód</TableHead>
                        <TableHead>Popis</TableHead>
                        <TableHead>Namapováno na</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead className="text-right">Akce</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappedCodes.map((code) => (
                        <TableRow key={code.id}>
                          <TableCell className="font-mono">
                            {code.product_code}
                          </TableCell>
                          <TableCell>{code.description || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="default">
                              {code.mapped_ingredient?.name ||
                                "Neznámá surovina"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {code.mapped_at ? formatDate(code.mapped_at) : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resetCode(code.id)}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteCode(code.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="ignored">
              {ignoredCodes.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Žádné ignorované kódy.</AlertDescription>
                </Alert>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kód</TableHead>
                        <TableHead>Popis</TableHead>
                        <TableHead className="text-right">Výskytů</TableHead>
                        <TableHead className="text-right">Akce</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ignoredCodes.map((code) => (
                        <TableRow key={code.id}>
                          <TableCell className="font-mono">
                            {code.product_code}
                          </TableCell>
                          <TableCell>{code.description || "-"}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">
                              {code.occurrence_count}×
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resetCode(code.id)}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteCode(code.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
