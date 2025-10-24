import { useState } from "react";
import { useUnmappedCodes } from "@/hooks/useUnmappedCodes";
import { useIngredients } from "@/hooks/useIngredients";
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
import type { Ingredient } from "@/hooks/useIngredients";

interface UnmappedCodesManagerProps {
  supplierId?: string;
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

  const { data: ingredientsData } = useIngredients();
  const ingredients = ingredientsData?.ingredients || [];
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

  const filteredIngredients = (searchQuery: string) => {
    if (!searchQuery) return ingredients;
    return ingredients.filter((ing: Ingredient) =>
      ing.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
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
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kód</TableHead>
                        <TableHead>Popis</TableHead>
                        <TableHead className="text-right">Výskytů</TableHead>
                        <TableHead className="text-right">Posl. cena</TableHead>
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
                                <span className="text-sm">
                                  {code.suggested_ingredient.name}
                                </span>
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
                              <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Vyberte surovinu" />
                              </SelectTrigger>
                              <SelectContent>
                                <div className="p-2">
                                  <Input
                                    placeholder="Hledat..."
                                    onChange={(e) =>
                                      setSearchTerm(e.target.value)
                                    }
                                    className="mb-2"
                                  />
                                </div>
                                {filteredIngredients(searchTerm).map(
                                  (ingredient: Ingredient) => (
                                    <SelectItem
                                      key={ingredient.id}
                                      value={ingredient.id.toString()}
                                    >
                                      {ingredient.name} ({ingredient.unit})
                                    </SelectItem>
                                  )
                                )}
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
