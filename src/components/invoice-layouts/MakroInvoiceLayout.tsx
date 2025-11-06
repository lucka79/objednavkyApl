import { IngredientMapping } from "./IngredientMapping";

interface MakroInvoiceLayoutProps {
  items: any[];
  onUnmap?: (itemId: string) => void;
  supplierId?: string;
  onItemMapped?: (itemId: string, ingredientId: number) => void;
  supplierIngredients?: any[];
}

export function MakroInvoiceLayout({
  items,
  onUnmap,
  supplierId,
  onItemMapped,
  supplierIngredients,
}: MakroInvoiceLayoutProps) {
  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left p-2 text-xs">číslo zboží</th>
            <th className="text-right p-2 text-xs">počet MU</th>
            <th className="text-left p-2 text-xs">název zboží</th>
            <th className="text-right p-2 text-xs">hmot. bal.</th>
            <th className="text-right p-2 text-xs">celk. hmot.</th>
            <th className="text-right p-2 text-xs">zákl. cena</th>
            <th className="text-right p-2 text-xs">jedn. v MU</th>
            <th className="text-right p-2 text-xs">cena za MU</th>
            <th className="text-right p-2 text-xs">cena celkem</th>
            <th className="text-right p-2 text-xs bg-orange-50">Cena/kg</th>
            <th className="text-left p-2 text-xs">Namapováno</th>
          </tr>
        </thead>
        <tbody>
          {items?.map((item: any, idx: number) => {
            const priceTotal =
              item.line_total || item.quantity * item.unit_price || 0;

            return (
              <tr key={idx} className="border-b hover:bg-gray-50">
                {/* číslo zboží */}
                <td className="p-2">
                  <code className="text-xs bg-blue-100 px-1 py-0.5 rounded font-mono">
                    {item.product_code || "???"}
                  </code>
                </td>
                {/* počet MU */}
                <td className="p-2 text-right text-xs font-semibold">
                  {item.description?.startsWith("*") ? (
                    <span className="text-purple-600">
                      {item.total_weight_kg?.toLocaleString("cs-CZ", {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })}{" "}
                      kg
                    </span>
                  ) : (
                    item.quantity.toLocaleString("cs-CZ")
                  )}
                </td>
                {/* název zboží */}
                <td className="p-2 text-xs">{item.description || "-"}</td>
                {/* hmot. bal. (package weight) */}
                <td className="p-2 text-right text-xs text-blue-600">
                  {item.package_weight_kg
                    ? `${(item.package_weight_kg * 1000).toLocaleString(
                        "cs-CZ",
                        {
                          maximumFractionDigits: 0,
                        }
                      )} g`
                    : "-"}
                </td>
                {/* celk. hmot. (total weight) */}
                <td className="p-2 text-right text-xs text-green-600 font-medium">
                  {item.total_weight_kg
                    ? `${item.total_weight_kg.toLocaleString("cs-CZ", {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })} kg`
                    : "-"}
                </td>
                {/* zákl. cena (base price per package OR price per kg for * items) */}
                <td className="p-2 text-right text-xs">
                  {item.base_price ? (
                    <span
                      className={
                        item.description?.startsWith("*")
                          ? "text-purple-600 font-medium"
                          : ""
                      }
                    >
                      {item.base_price.toLocaleString("cs-CZ", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      {item.description?.startsWith("*") && " /kg"}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                {/* jedn. v MU (units in MU) */}
                <td className="p-2 text-right text-xs">
                  {item.units_in_mu || "1"}
                </td>
                {/* cena za MU (price per MU) */}
                <td className="p-2 text-right text-xs">
                  {item.unit_price?.toLocaleString("cs-CZ", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                {/* cena celkem */}
                <td className="p-2 text-right text-xs font-semibold">
                  {priceTotal.toLocaleString("cs-CZ", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                {/* Cena/kg (calculated) */}
                <td className="p-2 text-right text-xs bg-orange-50">
                  {item.price_per_kg ? (
                    <span className="text-orange-600 font-bold">
                      {item.price_per_kg.toLocaleString("cs-CZ", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      Kč/kg
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                {/* Namapováno */}
                <td className="p-2 text-xs">
                  <IngredientMapping
                    itemId={`item-${idx}`}
                    productCode={item.product_code || ""}
                    description={item.description || ""}
                    unitPrice={item.price_per_kg || item.unit_price}
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
