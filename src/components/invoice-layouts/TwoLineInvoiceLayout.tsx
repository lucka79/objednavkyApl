interface TwoLineInvoiceLayoutProps {
  items: any[];
}

export function TwoLineInvoiceLayout({ items }: TwoLineInvoiceLayoutProps) {
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
                <td className="px-3 py-2 text-right text-sm text-gray-900 border-r border-gray-200">
                  {item.quantity.toLocaleString("cs-CZ")}{" "}
                  <span className="text-gray-500 text-xs">
                    {item.unit_of_measure}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-sm text-gray-700 border-r border-gray-200">
                  {item.unit_price?.toLocaleString("cs-CZ", {
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
                  {item.matched_ingredient_id ? (
                    <div className="flex items-center gap-1 text-green-700">
                      <span className="text-sm">✓</span>
                      {item.matched_ingredient_name}
                    </div>
                  ) : item.suggested_ingredient_name ? (
                    <div className="flex items-center gap-1 text-orange-600">
                      <span className="text-sm">⚠</span>
                      {item.suggested_ingredient_name}
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

