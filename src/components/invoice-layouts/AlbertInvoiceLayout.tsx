import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface AlbertInvoiceLayoutProps {
  items: any[];
  onUnmap?: (itemId: string) => void;
}

/**
 * Albert Invoice Layout
 * Special layout for Albert supermarket invoices that don't have product codes
 * Only shows: Name, Quantity, Unit, Price, Total, and mapping status
 */
export function AlbertInvoiceLayout({
  items,
  onUnmap,
}: AlbertInvoiceLayoutProps) {
  return (
    <div className="overflow-x-auto border border-gray-300 rounded-lg">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-blue-50 border-b-2 border-blue-300">
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Název položky
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Množství
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Jedn. cena
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
            const description = item.description || item.name;
            const quantity = item.quantity;
            const unitOfMeasure = item.unit_of_measure || item.unit;
            const unitPrice = item.unit_price || item.price;
            const lineTotal = item.line_total || item.total;
            const vatRate = item.vat_rate;

            const priceTotal =
              lineTotal || (quantity && unitPrice ? quantity * unitPrice : 0);

            // Support both matching status formats
            const ingredientId =
              item.matched_ingredient_id || item.ingredientId;
            const ingredientName =
              item.matched_ingredient_name || item.ingredientName;
            const suggestedName = item.suggested_ingredient_name;

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
                <td className="px-3 py-2 text-right text-sm text-gray-900 border-r border-gray-200">
                  <span className="font-semibold">
                    {quantity?.toLocaleString("cs-CZ")}
                  </span>{" "}
                  <span className="text-gray-500 text-xs">{unitOfMeasure}</span>
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
            <strong>ℹ️ Albert formát:</strong> Položky nemají kódy dodavatele - mapování pouze podle názvu
          </p>
          <p className="text-xs text-gray-500">
            Pro namapování přejděte do <strong>Admin → Suroviny → Kódy dodavatelů</strong> a přidejte mapování podle názvu (např. "RYBÍZ ČERVENÝ" → surovina)
          </p>
        </div>
      )}
    </div>
  );
}

