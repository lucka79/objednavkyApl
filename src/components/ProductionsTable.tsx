import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
} from "@tanstack/react-table";
import { useProductions } from "@/hooks/useProductions";
import { Production } from "../../types";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState, useMemo } from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Plus } from "lucide-react";
import { Button } from "./ui/button";
import { ProductionDetailsDialog } from "@/components/ProductionDetailsDialog";

import { useAuthStore } from "@/lib/supabase";
import { AddProductionDialog } from "./AddProductionDialog";

const columns: ColumnDef<Production>[] = [
  {
    accessorKey: "date",
    header: () => <div className="text-left">Datum</div>,
    cell: ({ row }: { row: any }) => (
      <div className="text-left">
        {new Date(row.original.date).toLocaleDateString()}
      </div>
    ),
  },
  {
    accessorKey: "id",
    header: "# ID",
  },
  {
    accessorKey: "user.full_name",
    header: "Uživatel",
    cell: ({ row }: { row: any }) => (
      <div>{row.original.user?.full_name || "N/A"}</div>
    ),
  },
  {
    accessorKey: "production_items",
    header: () => <div className="text-left">Items</div>,
    cell: ({ row }: { row: any }) => (
      <div className="text-left">
        <Badge variant="outline">
          {row.original.production_items?.length || 0}
        </Badge>
      </div>
    ),
  },
  {
    accessorKey: "total",
    header: () => <div className="text-right">Celkem</div>,
    cell: ({ row }: { row: any }) => (
      <div className="text-right font-medium">
        {row.original.total?.toFixed(2)} Kč
      </div>
    ),
  },
];

export function ProductionsTable() {
  const user = useAuthStore((state) => state.user);
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedProductionId, setSelectedProductionId] = useState<
    number | null
  >(null);
  const [open, setOpen] = useState(false);

  const { data: productions, isLoading, error, refetch } = useProductions();

  const filteredProductions = useMemo(() => {
    if (!productions) return [];
    if (user?.role === "store") {
      return productions.filter((prod) => prod.user_id === user.id);
    }
    if (user?.role === "admin") {
      return productions;
    }
    return [];
  }, [productions, user]);

  const table = useReactTable({
    data: filteredProductions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { globalFilter },
  });

  const handleDialogClose = async () => {
    setSelectedProductionId(null);
    await refetch();
  };

  if (isLoading) return <div>Loading productions...</div>;
  if (error) return <div>Error loading productions</div>;

  return (
    <Card className="my-0 p-4 print:border-none print:shadow-none print:absolute print:top-0 print:left-0 print:right-0 print:m-0 print:h-auto print:overflow-visible print:transform-none">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Input
            placeholder="Vyhledat výrobu..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-sm"
          />
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Přidat výrobu
          </Button>
          <AddProductionDialog open={open} onClose={() => setOpen(false)} />
        </div>

        <Card className="rounded-md">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup: any) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header: any) => (
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
                table.getRowModel().rows.map((row: any) => (
                  <TableRow
                    key={row.id}
                    onClick={() => setSelectedProductionId(row.original.id)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    {row.getVisibleCells().map((cell: any) => (
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

        <ProductionDetailsDialog
          productionId={selectedProductionId}
          onClose={handleDialogClose}
        />
      </div>
    </Card>
  );
}
