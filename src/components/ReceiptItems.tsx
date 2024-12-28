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

  return (
    <Table className="print:!m-0">
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="flex flex-col gap-1 ">
              <span className="print:text-[12px]">
                {item.product.name.length > 20
                  ? `${item.product.name.slice(0, 20)}...`
                  : item.product.name}
              </span>
              <span className="print:text-[9px]">
                {item.price.toFixed(2)} Kč
              </span>
            </TableCell>
            {/* <TableCell className="text-left"></TableCell> */}
            <TableCell
              colSpan={2}
              className="text-center font-semibold print:text-[10px]"
            >
              {item.quantity}
            </TableCell>
            <TableCell className="text-right font-semibold print:text-[9px]">
              {(item.price * item.quantity).toFixed(2)} Kč
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        {/* Group and display items by VAT rate */}
        {Object.entries(
          items.reduce(
            (acc, item) => {
              const vat = item.product.vat;
              if (!acc[vat]) acc[vat] = 0;
              acc[vat] += (item.quantity * item.price * vat) / 100;
              return acc;
            },
            {} as Record<number, number>
          )
        )
          .sort(([vatA], [vatB]) => Number(vatA) - Number(vatB))
          .map(([vat, vatAmount]) => {
            // Calculate base price for items with this VAT rate
            const basePrice = items
              .filter((item) => item.product.vat === Number(vat))
              .reduce((sum, item) => sum + item.quantity * item.price, 0);

            return (
              <TableRow key={vat}>
                <TableCell colSpan={2} className="print:text-[10px]">
                  DPH {vat}%
                </TableCell>
                <TableCell
                  // colSpan={1}
                  className="text-right print:print-name print:text-[10px]"
                >
                  {vatAmount.toFixed(2)} Kč
                </TableCell>
                <TableCell className="text-right print:text-[10px]">
                  {(basePrice - vatAmount).toFixed(2)} Kč
                </TableCell>
              </TableRow>
            );
          })}
        <TableRow className="border-t border-gray-200">
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
