import { ReceiptItem } from "../../types";
import { Table, TableBody, TableCell, TableFooter, TableRow } from "./ui/table";

interface ReceiptItemsProps {
  items: ReceiptItem[];
}

export function ReceiptItems({ items }: ReceiptItemsProps) {
  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.product.price,
    0
  );

  return (
    <Table>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{item.product.name}</TableCell>
            <TableCell className="text-left">
              {item.price.toFixed(2)} Kč
            </TableCell>
            <TableCell className="text-right font-semibold">
              {item.quantity}
            </TableCell>
            <TableCell className="text-right">
              {(item.price * item.quantity).toFixed(2)} Kč
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Celkem</TableCell>
          <TableCell className="text-right">{total.toFixed(2)} Kč</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
