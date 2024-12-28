import { Receipt, ReceiptItem } from "types";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

interface PrintReceiptProps {
  receipt: Receipt;
  userName: string;
}

export function PrintReceipt({ receipt, userName }: PrintReceiptProps) {
  // Calculate totals per VAT rate
  const vatTotals = receipt.receipt_items?.reduce(
    (acc, item) => {
      const vat = item.vat || 0;
      const total = item.quantity * item.price;
      const vatAmount = total * (vat / (100 + vat));
      const netAmount = total - vatAmount;

      acc[vat] = acc[vat] || { net: 0, vat: 0 };
      acc[vat].net += netAmount;
      acc[vat].vat += vatAmount;
      return acc;
    },
    {} as Record<number, { net: number; vat: number }>
  );

  return (
    <div className="p-4 w-full text-sm">
      <div className="text-center mb-4">
        <h2 className="font-semibold">{userName}</h2>
        <h2 className="text-xs">Doklad #{receipt.receipt_no}</h2>
        <p>{format(new Date(receipt.date), "PPP HH:mm", { locale: cs })}</p>
      </div>

      <div className="border-t border-b py-2 my-2">
        {receipt.receipt_items?.map((item: ReceiptItem) => (
          <div key={item.id} className="flex justify-between">
            <div className="w-full">
              <div>{item.product.name}</div>
              <div className="flex flex-row justify-between text-sm">
                <span>
                  {item.quantity}x @ {item.price.toFixed(2)}
                </span>
                <span className="font-semibold">
                  {(item.quantity * item.price).toFixed(2)} Kč
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-b my-2"></div>

      <div className="flex flex-col gap-1">
        {Object.entries(vatTotals).map(([rate, amounts]) => (
          <div key={rate}>
            <div className="flex justify-between">
              <span>Netto ({rate}%):</span>
              <span>{amounts.net.toFixed(2)} Kč</span>
            </div>
            <div className="flex justify-between">
              <span>DPH {rate}%:</span>
              <span>{amounts.vat.toFixed(2)} Kč</span>
            </div>
          </div>
        ))}

        <div className="border-b my-2"></div>

        <div className="flex justify-between font-bold">
          <span>Celkem:</span>
          <span>{receipt.total.toFixed(2)} Kč</span>
        </div>

        <div className="flex justify-center py-4">
          <span>Děkujeme Vám za nákup!</span>
        </div>

        <div className="flex justify-center">
          <span>APLICA s.r.o., DIČ: CZ00555801</span>
        </div>
      </div>
    </div>
  );
}
