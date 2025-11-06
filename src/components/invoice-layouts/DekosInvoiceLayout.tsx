import { Input } from "@/components/ui/input";
import { Pencil } from "lucide-react";
import { IngredientMapping } from "./IngredientMapping";

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
                  <IngredientMapping
                    itemId={item.id}
                    productCode={productCode}
                    description={description}
                    unitPrice={finalUnitPrice}
                    supplierId={supplierId}
                    supplierIngredients={supplierIngredients}
                    ingredientId={ingredientId}
                    ingredientName={ingredientName}
                    suggestedName={suggestedName}
                    confidence={confidence}
                    onUnmap={onUnmap}
                    onItemMapped={onItemMapped}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
