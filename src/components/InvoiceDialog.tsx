import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

interface InvoiceDialogProps {
  invoice: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const InvoiceDialog = ({
  invoice,
  open,
  onOpenChange,
}: InvoiceDialogProps) => {
  if (!invoice) return null;

  const totalSum = invoice.items?.reduce((sum: any, item: any) => {
    return sum + item.quantity * item.price;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Invoice Details #{invoice.invoice_number}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-6">
          {/* Customer Info */}
          <div>
            <h3 className="font-semibold mb-2">Customer Information</h3>
            <div className="text-sm">
              <p>{invoice.profiles?.full_name}</p>
              {invoice.profiles?.company && <p>{invoice.profiles.company}</p>}
              <p>{invoice.profiles?.address}</p>
              {invoice.profiles?.ico && <p>IČO: {invoice.profiles.ico}</p>}
              {invoice.profiles?.dic && <p>DIČ: {invoice.profiles.dic}</p>}
            </div>
          </div>

          {/* Orders List */}
          <div>
            <h3 className="font-semibold mb-2">Included Orders</h3>
            <div className="space-y-2">
              {invoice.orders?.map((order: any) => (
                <div
                  key={order.id}
                  className="border rounded p-2 text-sm flex justify-between"
                >
                  <div>
                    <p>Order #{order.id}</p>
                    <p>Customer: {order.profiles?.full_name}</p>
                  </div>
                  <div className="text-right">
                    <p>
                      {format(new Date(order.date), "d. M. yyyy", {
                        locale: cs,
                      })}
                    </p>
                    <p>{order.total.toLocaleString("cs-CZ")} Kč</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Items Summary */}
          <div>
            <h3 className="font-semibold mb-2">Items Summary</h3>
            <div className="space-y-1">
              {invoice.items?.map((item: any) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.products.name}</span>
                  <span>
                    {item.quantity} × {item.price} Kč ={" "}
                    {(item.quantity * item.price).toLocaleString("cs-CZ")} Kč
                  </span>
                </div>
              ))}
              <div className="border-t mt-2 pt-2 font-semibold">
                <div className="flex justify-between">
                  <span>Total</span>
                  <span>{totalSum?.toLocaleString("cs-CZ")} Kč</span>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice Period */}
          <div className="text-sm text-gray-500">
            <p>
              Invoice period:{" "}
              {format(new Date(invoice.start_date), "d. M. yyyy", {
                locale: cs,
              })}{" "}
              -{" "}
              {format(new Date(invoice.end_date), "d. M. yyyy", {
                locale: cs,
              })}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
