import { Receipt, ReceiptItem } from "types";
import { format } from "date-fns";

interface PrintReceiptProps {
  receipt: Receipt;
}

export function PrintReceipt({ receipt }: PrintReceiptProps) {
  return (
    <div className="p-4 w-[58mm] text-sm">
      <div className="text-center mb-4">
        <h2 className="font-semibold">Doklad #{receipt.receipt_no}</h2>
        <p>{format(new Date(receipt.date), "PPP")}</p>
      </div>

      <div className="border-t border-b py-2 my-2">
        {receipt.receipt_items?.map((item: ReceiptItem) => (
          <div key={item.id} className="flex justify-between">
            <div>
              <div>{item.product.name}</div>
              <div className="text-xs">
                {item.quantity}x @ {item.price.toFixed(2)}
              </div>
            </div>
            <div>{(item.quantity * item.price).toFixed(2)} Kč</div>
          </div>
        ))}
      </div>

      <div className="flex justify-between font-bold mt-4">
        <span>Total:</span>
        <span>{receipt.total.toFixed(2)} Kč</span>
      </div>
    </div>
  );
}
