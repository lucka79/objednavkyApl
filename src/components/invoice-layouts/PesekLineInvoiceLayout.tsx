import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface PesekLineInvoiceLayoutProps {
  items: any[];
  onUnmap?: (itemId: string) => void;
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
  if (unit === "1ks" || unit === "ks" || unit === "kus" || unit === "kusy") return 1;
  
  // Packages (balení)
  if (unit === "bal" || unit === "balení") return 1;
  
  // Try to parse as number (e.g., "50", "100")
  const numericUnit = parseInt(unit);
  if (!isNaN(numericUnit)) return numericUnit;
  
  // Default to 1 for unknown units
  return 1;
};

export function PesekLineInvoiceLayout({ items, onUnmap }: PesekLineInvoiceLayoutProps) {
  return (
    <div className="overflow-x-auto border border-gray-300 rounded-lg">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b-2 border-gray-300">
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Kód
            </th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Název položky
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Množství
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Celk. ks
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Jedn. cena
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
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
            const priceTotal =
              lineTotal || (quantity && unitPrice ? quantity * unitPrice : 0);
            
            // Calculate total quantity in base units (pieces)
            const unitMultiplier = getUnitMultiplier(unitOfMeasure || "");
            const totalQuantity = quantity * unitMultiplier;
            
            // Calculate price per single item
            const pricePerItem = totalQuantity > 0 ? unitPrice / totalQuantity : 0;

            // Support both matching status formats
            const ingredientId =
              item.matched_ingredient_id || item.ingredientId;
            const ingredientName =
              item.matched_ingredient_name || item.ingredientName;
            const suggestedName = item.suggested_ingredient_name;

            return (
              <tr
                key={idx}
                className={`border-b border-gray-200 hover:bg-gray-50 ${
                  ingredientId
                    ? ""
                    : suggestedName
                      ? "bg-orange-50/30"
                      : "bg-red-50/30"
                }`}
              >
                <td className="px-3 py-2 border-r border-gray-200">
                  <code className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">
                    {productCode || "???"}
                  </code>
                </td>
                <td className="px-3 py-2 text-sm text-gray-900 border-r border-gray-200">
                  {description || "-"}
                </td>
                <td className="px-3 py-2 text-right text-sm text-gray-900 border-r border-gray-200">
                  {quantity?.toLocaleString("cs-CZ")}{" "}
                  <span className="text-gray-500 text-xs">{unitOfMeasure}</span>
                </td>
                <td className="px-3 py-2 text-right text-xs font-medium text-blue-700 border-r border-gray-200">
                  {totalQuantity.toLocaleString("cs-CZ", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}{" "}
                  <span className="text-gray-500">ks</span>
                </td>
                <td className="px-3 py-2 text-right text-sm text-gray-700 border-r border-gray-200">
                  {unitPrice?.toLocaleString("cs-CZ", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  Kč
                </td>
                <td className="px-3 py-2 text-right text-xs text-purple-700 border-r border-gray-200">
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
