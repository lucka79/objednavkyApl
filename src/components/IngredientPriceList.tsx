import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useIngredients } from "@/hooks/useIngredients";
import { useSupplierUsers } from "@/hooks/useProfiles";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Star, Printer, X } from "lucide-react";

interface IngredientSupplierCode {
  id: number;
  ingredient_id?: number;
  supplier_id: string;
  product_code: string;
  supplier_ingredient_name?: string | null;
  price: number;
  package: number | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface IngredientWithSupplierCodes {
  id: number;
  name: string;
  unit: string;
  price?: number | null; // Base ingredient price
  supplier_codes: IngredientSupplierCode[];
}

export function IngredientPriceList() {
  const queryClient = useQueryClient();
  const { data: ingredientsData, isLoading: ingredientsLoading } =
    useIngredients();
  const { data: supplierUsers, isLoading: suppliersLoading } =
    useSupplierUsers();
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const [editedPrices, setEditedPrices] = useState<Record<number, number>>({});
  const [editedCodes, setEditedCodes] = useState<Record<number, string>>({});
  const [editedPackages, setEditedPackages] = useState<
    Record<number, number | null>
  >({});
  const [editedBasePrices, setEditedBasePrices] = useState<
    Record<number, number>
  >({});
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const ingredients = ingredientsData?.ingredients || [];

  // Filter ingredients that have supplier codes
  const ingredientsWithCodes: IngredientWithSupplierCodes[] = ingredients
    .filter(
      (ing) =>
        ing.ingredient_supplier_codes &&
        ing.ingredient_supplier_codes.length > 0
    )
    .map((ing) => ({
      id: ing.id,
      name: ing.name,
      unit: ing.unit,
      price: ing.price,
      supplier_codes: ing.ingredient_supplier_codes as IngredientSupplierCode[],
    }));

  // Filter by selected supplier and search query
  const filteredIngredients =
    selectedSupplier === "all"
      ? ingredientsWithCodes.filter((ing) =>
          searchQuery
            ? ing.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              ing.supplier_codes.some(
                (code) =>
                  code.product_code
                    ?.toLowerCase()
                    .includes(searchQuery.toLowerCase()) ||
                  code.supplier_ingredient_name
                    ?.toLowerCase()
                    .includes(searchQuery.toLowerCase())
              )
            : true
        )
      : ingredientsWithCodes
          .map((ing) => ({
            ...ing,
            supplier_codes: ing.supplier_codes.filter(
              (code) => code.supplier_id === selectedSupplier
            ),
          }))
          .filter((ing) => ing.supplier_codes.length > 0)
          .filter((ing) =>
            searchQuery
              ? ing.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                ing.supplier_codes.some(
                  (code) =>
                    code.product_code
                      ?.toLowerCase()
                      .includes(searchQuery.toLowerCase()) ||
                    code.supplier_ingredient_name
                      ?.toLowerCase()
                      .includes(searchQuery.toLowerCase())
                )
              : true
          );

  // Flatten and sort all rows by ingredient name
  const sortedRows = filteredIngredients
    .flatMap((ingredient) =>
      ingredient.supplier_codes.map((code) => ({
        ingredient,
        code,
      }))
    )
    .sort((a, b) =>
      a.ingredient.name.localeCompare(b.ingredient.name, "cs-CZ")
    );

  const handlePriceChange = (codeId: number, newPrice: string) => {
    const price = parseFloat(newPrice);
    if (!isNaN(price)) {
      setEditedPrices((prev) => ({ ...prev, [codeId]: price }));
    }
  };

  const handleCodeChange = (codeId: number, newCode: string) => {
    setEditedCodes((prev) => ({ ...prev, [codeId]: newCode }));
  };

  const handlePackageChange = (codeId: number, newPackage: string) => {
    const packageValue = newPackage ? parseFloat(newPackage) : null;
    if (newPackage === "" || !isNaN(packageValue as number)) {
      setEditedPackages((prev) => ({ ...prev, [codeId]: packageValue }));
    }
  };

  const handleBasePriceChange = (ingredientId: number, newPrice: string) => {
    const price = parseFloat(newPrice);
    if (!isNaN(price)) {
      setEditedBasePrices((prev) => ({ ...prev, [ingredientId]: price }));
    }
  };

  const handleSaveBasePrice = async (
    ingredientId: number,
    ingredientName: string,
    oldPrice: number | null
  ) => {
    const newPrice = editedBasePrices[ingredientId];
    if (newPrice === undefined || newPrice === oldPrice) {
      return;
    }

    setSavingIds((prev) => new Set(prev).add(ingredientId));

    try {
      const { error } = await supabase
        .from("ingredients")
        .update({ price: newPrice })
        .eq("id", ingredientId);

      if (error) throw error;

      toast({
        title: "Základní cena uložena",
        description: `${ingredientName}: ${newPrice} Kč`,
      });

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ["ingredients"] });

      // Clear the edited value
      setEditedBasePrices((prev) => {
        const newState = { ...prev };
        delete newState[ingredientId];
        return newState;
      });
    } catch (error: any) {
      console.error("Error saving base price:", error);
      toast({
        title: "Chyba",
        description: `Nepodařilo se uložit základní cenu: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setSavingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(ingredientId);
        return newSet;
      });
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const selectedSupplierName =
      selectedSupplier === "all"
        ? "Všichni dodavatelé"
        : supplierUsers?.find((s) => s.id === selectedSupplier)?.full_name ||
          "Neznámý dodavatel";

    const tableContent = sortedRows
      .map(({ ingredient, code }) => {
        const supplier = supplierUsers?.find((s) => s.id === code.supplier_id);
        const currentPrice =
          editedPrices[code.id] !== undefined
            ? editedPrices[code.id]
            : code.price;
        const currentBasePrice =
          editedBasePrices[ingredient.id] !== undefined
            ? editedBasePrices[ingredient.id]
            : (ingredient.price ?? 0);
        const diff = currentPrice - currentBasePrice;
        const diffPercent =
          currentBasePrice > 0
            ? ((diff / currentBasePrice) * 100).toFixed(0)
            : "0";

        return `
          <tr>
            <td>${ingredient.name} (${ingredient.unit})</td>
            <td>${supplier?.full_name || "Neznámý dodavatel"}</td>
            <td>${code.product_code || "-"}</td>
            <td>${code.supplier_ingredient_name || "-"}</td>
            <td style="text-align: right;">${currentPrice.toFixed(2)} Kč/${ingredient.unit}</td>
            <td>
              Základ: ${currentBasePrice.toFixed(2)} Kč<br>
              ${diff > 0 ? "+" : ""}${diff.toFixed(2)} Kč (${diffPercent}%)
            </td>
            <td style="text-align: right;">${code.package || "-"} ${ingredient.unit}</td>
            <td>${
              code.updated_at
                ? `${new Date(code.updated_at).toLocaleDateString("cs-CZ", {
                    day: "numeric",
                    month: "numeric",
                    year: "numeric",
                  })} ${new Date(code.updated_at).toLocaleTimeString("cs-CZ", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "-"
            }</td>
          </tr>
        `;
      })
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ceník surovin podle dodavatelů</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
            }
            h1 {
              margin-bottom: 10px;
            }
            .subtitle {
              color: #666;
              margin-bottom: 20px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            @media print {
              body {
                padding: 10px;
              }
              button {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <h1>Ceník surovin podle dodavatelů</h1>
          <div class="subtitle">Dodavatel: ${selectedSupplierName}</div>
          <table>
            <thead>
              <tr>
                <th>Surovina</th>
                <th>Dodavatel</th>
                <th>Kód produktu</th>
                <th>Název u dodavatele</th>
                <th>Cena</th>
                <th>Rozdíl</th>
                <th>Balení</th>
                <th>Poslední změna</th>
              </tr>
            </thead>
            <tbody>
              ${tableContent}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSaveChanges = async (
    code: IngredientSupplierCode,
    ingredientName: string
  ) => {
    const newPrice = editedPrices[code.id];
    const newCode = editedCodes[code.id];
    const newPackage = editedPackages[code.id];
    const priceChanged = newPrice !== undefined && newPrice !== code.price;
    const codeChanged = newCode !== undefined && newCode !== code.product_code;
    const packageChanged =
      newPackage !== undefined && newPackage !== code.package;

    if (!priceChanged && !codeChanged && !packageChanged) {
      return;
    }

    setSavingIds((prev) => new Set(prev).add(code.id));

    try {
      const updates: any = {
        updated_at: new Date().toISOString(),
      };
      if (priceChanged) updates.price = newPrice;
      if (codeChanged) updates.product_code = newCode;
      if (packageChanged) updates.package = newPackage;

      const { error } = await supabase
        .from("ingredient_supplier_codes")
        .update(updates)
        .eq("id", code.id);

      if (error) throw error;

      const changes = [];
      if (priceChanged) changes.push(`cena: ${newPrice} Kč`);
      if (codeChanged) changes.push(`kód: ${newCode}`);
      if (packageChanged) changes.push(`balení: ${newPackage || "žádné"}`);

      const now = new Date();
      const timestamp = now.toLocaleString("cs-CZ", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      toast({
        title: "Změny uloženy",
        description: `${ingredientName}: ${changes.join(", ")} (${timestamp})`,
      });

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ["ingredients"] });

      // Clear the edited values
      setEditedPrices((prev) => {
        const newState = { ...prev };
        delete newState[code.id];
        return newState;
      });
      setEditedCodes((prev) => {
        const newState = { ...prev };
        delete newState[code.id];
        return newState;
      });
      setEditedPackages((prev) => {
        const newState = { ...prev };
        delete newState[code.id];
        return newState;
      });
    } catch (error: any) {
      console.error("Error saving changes:", error);
      toast({
        title: "Chyba",
        description: `Nepodařilo se uložit změny: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setSavingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(code.id);
        return newSet;
      });
    }
  };

  if (ingredientsLoading || suppliersLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">
              Ceník surovin podle dodavatelů
            </h2>
            {sortedRows.length > 0 && (
              <Badge variant="secondary" className="text-sm">
                {sortedRows.length} položek
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Upravte ceny surovin u jednotlivých dodavatelů
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Input
              type="text"
              placeholder="Hledat suroviny..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-8"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
              >
                <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </Button>
            )}
          </div>
          <div className="w-64">
            <Select
              value={selectedSupplier}
              onValueChange={setSelectedSupplier}
            >
              <SelectTrigger>
                <SelectValue placeholder="Všichni dodavatelé" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všichni dodavatelé</SelectItem>
                {supplierUsers?.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handlePrint} variant="outline" className="gap-2">
            <Printer className="h-4 w-4" />
            Tisknout
          </Button>
        </div>
      </div>

      {filteredIngredients.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              {searchQuery
                ? `Žádné suroviny nenalezeny pro hledaný výraz "${searchQuery}".`
                : "Žádné suroviny nenalezeny pro vybraného dodavatele."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Surovina</TableHead>
                  <TableHead className="w-[150px]">Dodavatel</TableHead>
                  <TableHead className="w-[120px]">Kód produktu</TableHead>
                  <TableHead>Název u dodavatele</TableHead>
                  <TableHead className="w-[150px]">Cena</TableHead>
                  <TableHead className="w-[120px]">Rozdíl</TableHead>
                  <TableHead className="w-[120px]">Balení</TableHead>
                  <TableHead className="w-[120px]">Poslední změna</TableHead>
                  <TableHead className="w-[100px] text-right">Akce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map(({ ingredient, code }) => {
                  const supplier = supplierUsers?.find(
                    (s) => s.id === code.supplier_id
                  );
                  const currentPrice =
                    editedPrices[code.id] !== undefined
                      ? editedPrices[code.id]
                      : code.price;
                  const currentCode =
                    editedCodes[code.id] !== undefined
                      ? editedCodes[code.id]
                      : code.product_code;
                  const currentPackage =
                    editedPackages[code.id] !== undefined
                      ? editedPackages[code.id]
                      : code.package;
                  const priceChanged =
                    editedPrices[code.id] !== undefined &&
                    editedPrices[code.id] !== code.price;
                  const codeChanged =
                    editedCodes[code.id] !== undefined &&
                    editedCodes[code.id] !== code.product_code;
                  const packageChanged =
                    editedPackages[code.id] !== undefined &&
                    editedPackages[code.id] !== code.package;
                  const hasChanges =
                    priceChanged || codeChanged || packageChanged;
                  const isSaving = savingIds.has(code.id);

                  return (
                    <TableRow key={code.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {code.is_active && (
                            <Star className="h-4 w-4 text-yellow-500 fill-current flex-shrink-0" />
                          )}
                          <div>
                            {ingredient.name}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({ingredient.unit})
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {supplier?.full_name || "Neznámý dodavatel"}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          value={currentCode || ""}
                          onChange={(e) =>
                            handleCodeChange(code.id, e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && hasChanges) {
                              handleSaveChanges(code, ingredient.name);
                            }
                          }}
                          className={`font-mono w-28 h-8 text-xs ${
                            codeChanged ? "border-orange-500" : ""
                          }`}
                          disabled={isSaving}
                          placeholder="Kód"
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {code.supplier_ingredient_name || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={currentPrice}
                            onChange={(e) =>
                              handlePriceChange(code.id, e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && hasChanges) {
                                handleSaveChanges(code, ingredient.name);
                              }
                            }}
                            className={`no-spinner w-24 h-8 text-right ${
                              priceChanged
                                ? "border-orange-500"
                                : "border-sky-900"
                            }`}
                            disabled={isSaving}
                          />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            Kč/{ingredient.unit}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const currentBasePrice =
                            editedBasePrices[ingredient.id] !== undefined
                              ? editedBasePrices[ingredient.id]
                              : (ingredient.price ?? 0);
                          const basePriceChanged =
                            editedBasePrices[ingredient.id] !== undefined &&
                            editedBasePrices[ingredient.id] !==
                              ingredient.price;
                          const isSavingBase = savingIds.has(ingredient.id);

                          return (
                            <div className="text-xs space-y-1">
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground whitespace-nowrap">
                                  Základ:
                                </span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={currentBasePrice}
                                  onChange={(e) =>
                                    handleBasePriceChange(
                                      ingredient.id,
                                      e.target.value
                                    )
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && basePriceChanged) {
                                      handleSaveBasePrice(
                                        ingredient.id,
                                        ingredient.name,
                                        ingredient.price ?? null
                                      );
                                    }
                                  }}
                                  className={`no-spinner w-16 h-6 text-xs ${
                                    basePriceChanged
                                      ? "border-blue-500"
                                      : "border-orange-500"
                                  }`}
                                  disabled={isSavingBase}
                                />
                                <span className="text-muted-foreground">
                                  Kč
                                </span>
                                {basePriceChanged && (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleSaveBasePrice(
                                        ingredient.id,
                                        ingredient.name,
                                        ingredient.price ?? null
                                      )
                                    }
                                    disabled={isSavingBase}
                                    className="h-6 px-2 bg-blue-600 hover:bg-blue-700"
                                  >
                                    {isSavingBase ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Save className="h-3 w-3" />
                                    )}
                                  </Button>
                                )}
                              </div>
                              {currentBasePrice > 0 && (
                                <>
                                  {(() => {
                                    const diff =
                                      currentPrice - currentBasePrice;
                                    const diffPercent = (
                                      (diff / currentBasePrice) *
                                      100
                                    ).toFixed(0);
                                    const isHigher = diff > 0;
                                    const isLower = diff < 0;
                                    return (
                                      <div
                                        className={`font-medium ${
                                          isHigher
                                            ? "text-red-600"
                                            : isLower
                                              ? "text-green-600"
                                              : "text-gray-600"
                                        }`}
                                      >
                                        {isHigher && "↑ "}
                                        {isLower && "↓ "}
                                        {diff > 0 ? "+" : ""}
                                        {diff.toFixed(2)} Kč ({diffPercent}%)
                                      </div>
                                    );
                                  })()}
                                </>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.1"
                            value={currentPackage ?? ""}
                            onChange={(e) =>
                              handlePackageChange(code.id, e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && hasChanges) {
                                handleSaveChanges(code, ingredient.name);
                              }
                            }}
                            className={`no-spinner w-20 h-8 text-sm text-right ${
                              packageChanged ? "border-orange-500" : ""
                            }`}
                            disabled={isSaving}
                            placeholder="0"
                          />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {ingredient.unit}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          {code.updated_at ? (
                            <>
                              <div>
                                {new Date(code.updated_at).toLocaleDateString(
                                  "cs-CZ",
                                  {
                                    day: "numeric",
                                    month: "numeric",
                                    year: "numeric",
                                  }
                                )}
                              </div>
                              <div className="text-[10px] text-gray-400">
                                {new Date(code.updated_at).toLocaleTimeString(
                                  "cs-CZ",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </div>
                            </>
                          ) : (
                            "-"
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() =>
                            handleSaveChanges(code, ingredient.name)
                          }
                          disabled={!hasChanges || isSaving}
                          className="bg-orange-600 hover:bg-orange-700 h-8"
                        >
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Save className="h-3 w-3 mr-1" />
                              Uložit
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
