import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, AlertTriangle } from "lucide-react";

interface LeCoInvoiceLayoutProps {
  items: any[];
  onUnmap?: (itemId: string) => void;
}

export function LeCoInvoiceLayout({
  items,
  onUnmap,
}: LeCoInvoiceLayoutProps) {
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
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Jednotka
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Cena/jed
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Celkem bez DPH
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              DPH %
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              DPH částka
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Celkem s DPH
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
            const vatRate = item.vat_rate || item.vatRate;
            const vatAmount = item.vat_amount || item.vatAmount;
            const totalWithVat = item.total_with_vat || item.totalWithVat;

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
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-sm text-gray-700 border-r border-gray-200">
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
                  {lineTotal?.toLocaleString("cs-CZ", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  Kč
                </td>
                <td className="px-3 py-2 text-right text-sm text-gray-700 border-r border-gray-200">
                  {vatRate ? `${vatRate}%` : "-"}
                </td>
                <td className="px-3 py-2 text-right text-sm text-gray-700 border-r border-gray-200">
                  {vatAmount?.toLocaleString("cs-CZ", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) || "-"}
                </td>
                <td className="px-3 py-2 text-right text-sm font-semibold text-green-700 border-r border-gray-200">
                  {totalWithVat?.toLocaleString("cs-CZ", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) || lineTotal?.toLocaleString("cs-CZ", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) || "-"}
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

