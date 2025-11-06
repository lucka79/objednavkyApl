import { IngredientMapping } from "./IngredientMapping";

interface PesekLineInvoiceLayoutProps {
  items: any[];
  onUnmap?: (itemId: string) => void;
  supplierId?: string;
  onItemMapped?: (itemId: string, ingredientId: number) => void;
  supplierIngredients?: any[];
}

export function PesekLineInvoiceLayout({
  items,
  onUnmap,
  supplierId,
  onItemMapped,
  supplierIngredients,
}: PesekLineInvoiceLayoutProps) {
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
              Jedn. cena
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
                <td className="px-3 py-2 text-right text-sm text-gray-700 border-r border-gray-200">
                  {unitPrice?.toLocaleString("cs-CZ", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="px-3 py-2 text-right text-sm font-medium text-gray-900 border-r border-gray-200">
                  {priceTotal.toLocaleString("cs-CZ", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="px-3 py-2 text-sm">
                  <IngredientMapping
                    itemId={`item-${idx}`}
                    productCode={productCode || ""}
                    description={description || ""}
                    unitPrice={unitPrice}
                    supplierId={supplierId}
                    supplierIngredients={supplierIngredients}
                    ingredientId={ingredientId}
                    ingredientName={ingredientName}
                    suggestedName={suggestedName}
                    confidence={
                      item.confidence ||
                      item.matching_confidence ||
                      item.match_confidence ||
                      100
                    }
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
