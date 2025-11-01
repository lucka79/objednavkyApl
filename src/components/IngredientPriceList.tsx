import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useIngredients } from "@/hooks/useIngredients";
import { useSupplierUsers } from "@/hooks/useProfiles";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
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
import { Loader2, Save, Star } from "lucide-react";

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
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
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
      supplier_codes: ing.ingredient_supplier_codes as IngredientSupplierCode[],
    }));

  // Filter by selected supplier
  const filteredIngredients =
    selectedSupplier === "all"
      ? ingredientsWithCodes
      : ingredientsWithCodes
          .map((ing) => ({
            ...ing,
            supplier_codes: ing.supplier_codes.filter(
              (code) => code.supplier_id === selectedSupplier
            ),
          }))
          .filter((ing) => ing.supplier_codes.length > 0);

  // Flatten and sort all rows by product code
  const sortedRows = filteredIngredients
    .flatMap((ingredient) =>
      ingredient.supplier_codes.map((code) => ({
        ingredient,
        code,
      }))
    )
    .sort((a, b) =>
      (a.code.product_code || "").localeCompare(b.code.product_code || "")
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
      const updates: any = {};
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

      toast({
        title: "Změny uloženy",
        description: `${ingredientName}: ${changes.join(", ")}`,
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
          <h2 className="text-2xl font-bold">Ceník surovin podle dodavatelů</h2>
          <p className="text-muted-foreground">
            Upravte ceny surovin u jednotlivých dodavatelů
          </p>
        </div>
        <div className="w-64">
          <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
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
      </div>

      {filteredIngredients.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              Žádné suroviny nenalezeny pro vybraného dodavatele.
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
                  <TableHead className="w-[120px]">Balení</TableHead>
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
                    <TableRow
                      key={code.id}
                      className={
                        code.is_active ? "bg-green-50 hover:bg-green-100" : ""
                      }
                    >
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
                            className={`no-spinner w-24 h-8 ${
                              priceChanged ? "border-orange-500" : ""
                            }`}
                            disabled={isSaving}
                          />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            Kč/{ingredient.unit}
                          </span>
                        </div>
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
                            className={`no-spinner w-20 h-8 text-sm ${
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
