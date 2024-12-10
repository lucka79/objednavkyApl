import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
} from "@tanstack/react-table";
import { fetchAllReturns } from "@/hooks/useReturns";
import { Return } from "../../types";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import { Card } from "./ui/card";
// import { Badge } from "./ui/badge";

import { ReturnDetailsDialog } from "./ReturnDetailsDialog";
import { Plus } from "lucide-react";
import { Button } from "./ui/button";
import { AddReturnDialog } from "./AddReturnDialog";
import { useAuthStore } from "@/lib/supabase";

const columns: ColumnDef<Return>[] = [
  //   {
  //     accessorKey: "created_at",
  //     header: () => <div className="text-left">Vytvořeno</div>,
  //     cell: ({ row }) => (
  //       <div className="text-left">
  //         {new Date(row.original.created_at).toLocaleDateString()}
  //       </div>
  //     ),
  //   },
  {
    accessorKey: "date",
    header: () => <div className="text-left">Datum</div>,
    cell: ({ row }) => (
      <div className="text-left">
        {new Date(row.original.date).toLocaleDateString()}
      </div>
    ),
  },
  {
    accessorKey: "id",
    header: "# ID",
  },
  //   {
  //     accessorKey: "seller.full_name",
  //     header: "Prodejce",
  //     cell: ({ row }) => <div>{row.original.seller?.full_name || "N/A"}</div>,
  //   },
  {
    accessorKey: "user.full_name",
    header: "Odběratel",
    cell: ({ row }) => <div>{row.original.user?.full_name || "N/A"}</div>,
  },
  {
    accessorKey: "user.role",
    header: "Typ",
    cell: ({ row }) => <div>{row.original.user?.role || "N/A"}</div>,
  },
  {
    accessorKey: "total",
    header: () => <div className="text-right">Celkem</div>,
    cell: ({ row }) => (
      <div className="text-right font-medium">
        {row.original.total?.toFixed(2)} Kč
      </div>
    ),
  },
];

export function ReturnsTable() {
  const user = useAuthStore((state) => state.user);
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedReturnId, setSelectedReturnId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const {
    data: returns,
    isLoading,
    error,
  } = fetchAllReturns(user?.id, user?.role);

  const table = useReactTable({
    data: returns || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { globalFilter },
  });

  if (isLoading) return <div>Loading returns...</div>;
  if (error) return <div>Error loading returns</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Input
          placeholder="Vyhledat vratky..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Přidat vratku
        </Button>
        <AddReturnDialog open={open} onClose={() => setOpen(false)} />
      </div>

      <Card className="rounded-md">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => setSelectedReturnId(row.original.id)}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Žádné výsledky.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <ReturnDetailsDialog
        returnId={selectedReturnId}
        onClose={() => setSelectedReturnId(null)}
      />
    </div>
  );
}
