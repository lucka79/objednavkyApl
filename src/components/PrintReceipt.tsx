import { Receipt, ReceiptItem } from "types";
import { format } from "date-fns";

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
    <div className="p-4 w-[58mm] text-sm">
      <div className="text-center mb-4">
        <h2 className="font-semibold">{userName}</h2>
        <h2 className="font-semibold">Doklad #{receipt.receipt_no}</h2>
        <p>{format(new Date(receipt.date), "PPP")}</p>
      </div>

      <div className="border-t border-b py-2 my-2">
        {receipt.receipt_items?.map((item: ReceiptItem) => (
          <div key={item.id} className="flex justify-between">
            <div>
              <div>
                {item.product.name.length > 15
                  ? `${item.product.name.slice(0, 15)}...`
                  : item.product.name}
              </div>
              <div className="text-xs">
                {item.quantity}x @ {item.price.toFixed(2)}
              </div>
            </div>
            <div>{(item.quantity * item.price).toFixed(2)} Kč</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 mt-4">
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
        <div className="flex justify-between font-bold">
          <span>Celkem:</span>
          <span>{receipt.total.toFixed(2)} Kč</span>
        </div>
      </div>
    </div>
  );
}
