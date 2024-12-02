import { ReceiptItem } from "../../types";
import { Table, TableBody, TableCell, TableFooter, TableRow } from "./ui/table";

interface ReceiptItemsProps {
  items: ReceiptItem[];
}

export function ReceiptItems({ items }: ReceiptItemsProps) {
  if (!items.length) {
    return null;
  }

  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.product.price,
    0
  );

  const nettoVatTotal = items.reduce(
    (sum, item) =>
      sum + (item.quantity * item.product.price * item.product.vat) / 100,
    0
  );

  //   const nettoPrice = (item: ReceiptItem) =>
  //     item.product.price * (1 - item.product.vat / 100);

  return (
    <Table>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="flex flex-col gap-1 ">
              <span className="print:print-receipt-no print:text-[9px]">
                {item.product.name.length > 15
                  ? `${item.product.name.slice(0, 15)}...`
                  : item.product.name}
              </span>
              <span className="text-sm text-muted-foreground print:print-items print:text-[9px]">
                {/* {nettoPrice(item).toFixed(2)}
                {" x "} {item.product.vat}%  */}
                {item.price.toFixed(2)} Kč
              </span>
            </TableCell>
            {/* <TableCell className="text-left"></TableCell> */}
            <TableCell className="text-right font-semibold print:text-[10px]">
              {item.quantity}
            </TableCell>
            <TableCell className="text-right font-semibold print:text-[9px]">
              {(item.price * item.quantity).toFixed(2)} Kč
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2} className="print:text-[10px]">
            DPH {items[0].product.vat}%
          </TableCell>
          <TableCell
            colSpan={2}
            className="text-right print:print-name print:text-[10px]"
          >
            {nettoVatTotal.toFixed(2)} Kč
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell colSpan={2} className="print:text-[10px]">
            Celkem
          </TableCell>
          <TableCell colSpan={2} className="text-right print:text-[10px]">
            {total.toFixed(2)} Kč
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
