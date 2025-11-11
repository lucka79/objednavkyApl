import { IngredientMapping } from "./IngredientMapping";

interface ZeelandiaInvoiceLayoutProps {
  items: any[];
  onUnmap?: (itemId: string) => void;
  supplierId?: string;
  onItemMapped?: (itemId: string, ingredientId: number) => void;
  supplierIngredients?: any[];
}

export function ZeelandiaInvoiceLayout({
  items,
  onUnmap,
  supplierId,
  onItemMapped,
  supplierIngredients,
}: ZeelandiaInvoiceLayoutProps) {
  console.log("Using Zeelandia layout, items:", items);
  console.log("Items count:", items?.length);

  return (
    <div className="overflow-x-auto border border-gray-300 rounded-lg">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b-2 border-gray-300">
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Číslo položky
            </th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Název
            </th>
            <th className="text-center px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              MJ
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Obsah
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Fakt. mn.
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Cena/jed
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Cena/kg
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Cena celkem
            </th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">
              Namapováno
            </th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {items?.map((item: any, idx: number) => {
            const priceTotal =
              item.line_total || item.quantity * item.unit_price || 0;

            return (
              <tr
                key={idx}
                className={`border-b border-gray-200 hover:bg-gray-50 ${
                  item.matched_ingredient_id
                    ? ""
                    : item.suggested_ingredient_name
                      ? "bg-orange-50/30"
                      : "bg-red-50/30"
                }`}
              >
                <td className="px-3 py-2 border-r border-gray-200">
                  <code className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">
                    {item.product_code || "???"}
                  </code>
                </td>
                <td className="px-3 py-2 text-sm text-gray-900 border-r border-gray-200">
                  {item.description || "-"}
                </td>
                <td className="px-3 py-2 text-center text-xs text-gray-600 border-r border-gray-200">
                  {item.quantity
                    ? `${item.quantity.toLocaleString("cs-CZ")} ${
                        item.unit_of_measure || ""
                      }`
                    : "-"}
                </td>
                <td className="px-3 py-2 text-right text-sm text-gray-700 border-r border-gray-200">
                  {item.package_weight_kg
                    ? `${item.package_weight_kg.toLocaleString("cs-CZ", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} kg`
                    : item.package_weight && item.package_weight_unit
                      ? `${item.package_weight.toLocaleString("cs-CZ", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} ${item.package_weight_unit.toLowerCase()}`
                      : "-"}
                </td>
                <td className="px-3 py-2 text-right text-sm text-gray-900 border-r border-gray-200">
                  {item.total_weight_kg
                    ? `${item.total_weight_kg.toLocaleString("cs-CZ", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} kg`
                    : item.total_weight && item.total_weight_unit
                      ? `${item.total_weight.toLocaleString("cs-CZ", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} ${item.total_weight_unit.toLowerCase()}`
                      : "-"}
                </td>
                <td className="px-3 py-2 text-right text-sm text-gray-700 border-r border-gray-200">
                  {item.unit_price?.toLocaleString("cs-CZ", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  Kč
                </td>
                <td className="px-3 py-2 text-right text-sm text-blue-700 border-r border-gray-200">
                  {item.price_per_kg ? (
                    <>
                      {item.price_per_kg.toLocaleString("cs-CZ", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      Kč/kg
                    </>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
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
                    itemId={`item-${idx}`}
                    productCode={item.product_code || ""}
                    description={item.description || ""}
                    unitPrice={item.unit_price}
                    supplierId={supplierId}
                    supplierIngredients={supplierIngredients}
                    ingredientId={
                      item.matched_ingredient_id || item.ingredientId
                    }
                    ingredientName={
                      item.matched_ingredient_name || item.ingredientName
                    }
                    suggestedName={item.suggested_ingredient_name}
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
