import { useAuthStore } from "@/lib/supabase";
import { OrderItem } from "../../types";
import { Table, TableBody, TableCell, TableFooter, TableRow } from "./ui/table";

interface OrderItemsProps {
  items: OrderItem[];
}

export function OrderItems({ items }: OrderItemsProps) {
  const user = useAuthStore((state) => state.user);
  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  );

  return (
    <Table>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{item.product.name}</TableCell>
            <TableCell className="text-left">
              {item.price?.toFixed(2)} Kč
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
