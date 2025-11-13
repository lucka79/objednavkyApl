import { IngredientMapping } from "./IngredientMapping";
import { Input } from "@/components/ui/input";
import { Pencil } from "lucide-react";

interface FabioInvoiceLayoutProps {
  items: any[];
  onUnmap?: (itemId: string) => void;
  supplierId?: string;
  onItemMapped?: (itemId: string, ingredientId: number) => void;
  supplierIngredients?: any[];
  editedFabioQuantities?: { [key: string]: number };
  setEditedFabioQuantities?: (
    value:
      | { [key: string]: number }
      | ((prev: { [key: string]: number }) => { [key: string]: number })
  ) => void;
  editedFabioPrices?: { [key: string]: number };
  setEditedFabioPrices?: (
    value:
      | { [key: string]: number }
      | ((prev: { [key: string]: number }) => { [key: string]: number })
  ) => void;
  editingItemId?: string | null;
  setEditingItemId?: (value: string | null) => void;
  editingField?: string | null;
  setEditingField?: (value: string | null) => void;
}

export function FabioInvoiceLayout({
  items,
  onUnmap,
  supplierId,
  onItemMapped,
  supplierIngredients,
  editedFabioQuantities = {},
  setEditedFabioQuantities,
  editedFabioPrices = {},
  setEditedFabioPrices,
  editingItemId,
  setEditingItemId,
  editingField,
  setEditingField,
}: FabioInvoiceLayoutProps) {
  console.log("🍞 FabioInvoiceLayout Props:", {
    itemsCount: items?.length,
    supplierId,
    supplierIngredientsCount: supplierIngredients?.length,
    firstItemHasIngredientId:
      items?.[0]?.matched_ingredient_id || items?.[0]?.ingredientId,
    firstItem: items?.[0],
  });

  return (
    <div className="overflow-x-auto border border-gray-300 rounded-lg">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b-2 border-gray-300">
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Název
            </th>
            <th className="text-center px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              Množství
            </th>
            <th className="text-center px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              MJ
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              <div className="flex items-center justify-end gap-1">
                Cena/jedn
                <Pencil className="w-3 h-3 text-gray-400" />
              </div>
            </th>
            <th className="text-center px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200 bg-yellow-50">
              <div className="flex items-center justify-center gap-1">
                Množství celkem
                <Pencil className="w-3 h-3 text-gray-400" />
              </div>
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200 bg-green-50">
              Celkem
            </th>
            <th className="text-center px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
              DPH%
            </th>
            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200 bg-blue-50">
              Celkem s DPH
            </th>
            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">
              Namapováno
            </th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {items?.map((item: any, idx: number) => {
            const lineAmount =
              item.line_amount || item.quantity * item.unit_price || 0;
            const lineTotal =
              item.line_total || lineAmount * (1 + (item.vat_rate || 0) / 100);

            // Get supplier info and calculate total quantity
            let ingredientUnit = null;
            let supplierPrice = null;
            let packageSize = null;
            let totalQuantity = null;
            let calculatedPricePerKg = null;

            const matchedIngredientId =
              item.matched_ingredient_id || item.ingredientId;

            if (matchedIngredientId && supplierIngredients) {
              // Find the matched ingredient
              const ingredient = supplierIngredients.find(
                (ing: any) => ing.id === matchedIngredientId
              );

              if (ingredient) {
                ingredientUnit = ingredient.unit; // e.g., "kg", "ks", "l"

                // For FABIO: Get price and package from supplier codes
                // The product_code in ingredient_supplier_codes contains the description (since FABIO has no codes)
                const supplierCode = ingredient.ingredient_supplier_codes?.find(
                  (code: any) => code.supplier_id === supplierId
                );

                console.log(
                  `🔍 FABIO Item "${item.description}" package lookup:`,
                  {
                    itemDescription: item.description,
                    itemProductCode: item.product_code,
                    ingredientId: ingredient.id,
                    ingredientName: ingredient.name,
                    ingredientUnit: ingredient.unit,
                    supplierCodesCount:
                      ingredient.ingredient_supplier_codes?.length,
                    supplierCode: supplierCode,
                    supplierCodeProductCode: supplierCode?.product_code,
                    supplierCodePrice: supplierCode?.price,
                    supplierCodePackage: supplierCode?.package,
                  }
                );

                supplierPrice = supplierCode?.price
                  ? parseFloat(supplierCode.price)
                  : ingredient.price
                    ? parseFloat(ingredient.price)
                    : null;
                packageSize = supplierCode?.package
                  ? parseFloat(supplierCode.package)
                  : ingredient.package
                    ? parseFloat(ingredient.package)
                    : null;
              } else {
                console.warn(
                  `⚠️ FABIO Item "${item.description}" - ingredient not found in supplierIngredients!`,
                  {
                    matchedIngredientId,
                    supplierIngredientsCount: supplierIngredients?.length,
                  }
                );
              }
            } else {
              if (!matchedIngredientId) {
                console.warn(
                  `⚠️ FABIO Item "${item.description}" - no matched_ingredient_id/ingredientId!`
                );
              }
              if (!supplierIngredients) {
                console.warn(
                  `⚠️ FABIO Item "${item.description}" - supplierIngredients is null/undefined!`
                );
              }
            }

            // Calculate total quantity based on unit
            if (item.quantity && item.unit_of_measure) {
              if (item.unit_of_measure.toLowerCase() === "ks" && packageSize) {
                totalQuantity = item.quantity * packageSize;
              } else if (
                item.unit_of_measure.toLowerCase() === "kg" ||
                item.unit_of_measure.toLowerCase() === "krt"
              ) {
                totalQuantity = item.quantity;
              }
            }

            // Calculate price per kg from invoice: Celkem / Množství celkem
            if (totalQuantity && totalQuantity > 0 && lineAmount) {
              calculatedPricePerKg = lineAmount / totalQuantity;
            }

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
                <td className="px-3 py-2 text-sm text-gray-900 border-r border-gray-200">
                  {item.description || "-"}
                  {item.product_code && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      Kód: {item.product_code}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-center text-sm text-gray-700 border-r border-gray-200">
                  {item.quantity
                    ? item.quantity.toLocaleString("cs-CZ", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "-"}
                </td>
                <td className="px-3 py-2 text-center text-xs text-gray-600 border-r border-gray-200 uppercase">
                  {item.unit_of_measure || "-"}
                </td>
                <td className="px-3 py-2 text-right text-sm text-gray-700 border-r border-gray-200">
                  {editingItemId === item.id &&
                  editingField === "fabioPrice" ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={
                        editedFabioPrices[item.id] !== undefined
                          ? editedFabioPrices[item.id].toString()
                          : (calculatedPricePerKg || 0).toString()
                      }
                      onChange={(e) => {
                        const value = e.target.value;
                        const parsedValue = parseFloat(value) || 0;
                        if (setEditedFabioPrices) {
                          setEditedFabioPrices((prev) => ({
                            ...prev,
                            [item.id]: parsedValue,
                          }));
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
                          if (setEditedFabioPrices) {
                            setEditedFabioPrices((prev) => {
                              const newState = { ...prev };
                              delete newState[item.id];
                              return newState;
                            });
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
                    <div
                      onClick={() => {
                        if (setEditingItemId) setEditingItemId(item.id);
                        if (setEditingField) setEditingField("fabioPrice");
                      }}
                      className="cursor-pointer hover:bg-gray-100 px-1 rounded"
                      title="Klikněte pro úpravu"
                    >
                      {(editedFabioPrices[item.id] ?? calculatedPricePerKg) ? (
                        <div>
                          <div className="text-sm font-bold text-purple-700">
                            {(
                              editedFabioPrices[item.id] ?? calculatedPricePerKg
                            ).toLocaleString("cs-CZ", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            Kč
                          </div>
                          {ingredientUnit && (
                            <div className="text-xs text-gray-500">
                              /{ingredientUnit}
                            </div>
                          )}
                          {supplierPrice && (
                            <div className="text-xs text-gray-500">
                              DB: {supplierPrice.toLocaleString("cs-CZ")} Kč
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-center text-sm font-semibold text-gray-900 border-r border-gray-200 bg-yellow-50/50">
                  {editingItemId === item.id &&
                  editingField === "fabioQuantity" ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={
                        editedFabioQuantities[item.id] !== undefined
                          ? editedFabioQuantities[item.id].toString()
                          : (totalQuantity || 0).toString()
                      }
                      onChange={(e) => {
                        const value = e.target.value;
                        const parsedValue = parseFloat(value) || 0;
                        if (setEditedFabioQuantities) {
                          setEditedFabioQuantities((prev) => ({
                            ...prev,
                            [item.id]: parsedValue,
                          }));
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
                          if (setEditedFabioQuantities) {
                            setEditedFabioQuantities((prev) => {
                              const newState = { ...prev };
                              delete newState[item.id];
                              return newState;
                            });
                          }
                          if (setEditingItemId) setEditingItemId(null);
                          if (setEditingField) setEditingField(null);
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      autoFocus
                      className="h-7 text-sm text-center w-24 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  ) : (
                    <div
                      onClick={() => {
                        if (setEditingItemId) setEditingItemId(item.id);
                        if (setEditingField) setEditingField("fabioQuantity");
                      }}
                      className="cursor-pointer hover:bg-gray-100 px-1 rounded inline-block"
                      title="Klikněte pro úpravu"
                    >
                      {item.quantity && item.unit_of_measure ? (
                        <div>
                          {item.unit_of_measure.toLowerCase() === "ks" &&
                          packageSize ? (
                            // For "ks" unit: multiply by package size
                            <>
                              <div className="text-sm font-bold text-green-700">
                                {(
                                  editedFabioQuantities[item.id] ??
                                  item.quantity * packageSize
                                ).toLocaleString("cs-CZ", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{" "}
                                {ingredientUnit || "kg"}
                              </div>
                              <div className="text-xs text-gray-500">
                                {item.quantity.toLocaleString("cs-CZ")} ks ×{" "}
                                {packageSize.toLocaleString("cs-CZ")}{" "}
                                {ingredientUnit}
                              </div>
                            </>
                          ) : item.unit_of_measure.toLowerCase() === "kg" ||
                            item.unit_of_measure.toLowerCase() === "krt" ? (
                            // For "kg" or "krt" unit: use quantity as-is
                            <div className="text-sm font-bold text-green-700">
                              {(
                                editedFabioQuantities[item.id] ?? item.quantity
                              ).toLocaleString("cs-CZ", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              {item.unit_of_measure.toLowerCase()}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-sm text-green-700 border-r border-gray-200 bg-green-50/50 font-medium">
                  {lineAmount.toLocaleString("cs-CZ", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  Kč
                </td>
                <td className="px-3 py-2 text-center text-xs text-gray-600 border-r border-gray-200">
                  {item.vat_rate ? `${item.vat_rate}%` : "-"}
                </td>
                <td className="px-3 py-2 text-right text-sm font-semibold text-blue-900 border-r border-gray-200 bg-blue-50/50">
                  {lineTotal.toLocaleString("cs-CZ", {
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
