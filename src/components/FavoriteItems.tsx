import { useAuthStore } from "@/lib/supabase";

import { FavoriteItem } from "types";
import { Table, TableBody, TableCell, TableRow } from "./ui/table";

interface FavoriteItemsProps {
  items: FavoriteItem[];
}

export function FavoriteItems({ items }: FavoriteItemsProps) {
  const user = useAuthStore((state) => state.user);

  console.log("FavoriteItems:", {
    userId: user?.id,
    items,
  });

  return (
    <Table>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{item.product.name}</TableCell>

            <TableCell className="text-right font-semibold">
              {item.quantity || 0}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
