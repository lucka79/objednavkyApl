import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  flexRender,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
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
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

// import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
// import { useAuthStore } from "@/lib/supabase";
// import { Dialog, DialogTrigger } from "@/components/ui/dialog";
// import { useDeleteReceipt } from "@/hooks/useReceipts";
import { Receipt, ReceiptItem } from "types";
import { fetchAllProducts } from "@/hooks/useProducts";
import { fetchAllReceipts } from "@/hooks/useReceipts";

//   const DAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"] as const;

const columns: ColumnDef<Receipt>[] = [
  {
    accessorKey: "date",
    header: () => <div className="w-18 text-left">Datum</div>,
    cell: ({ row }) => (
      <div className="w-18 text-left">
        {new Date(row.original.date).toLocaleDateString()}
      </div>
    ),
  },
  {
    accessorKey: "id",
    header: "# ID",
  },

  {
    accessorKey: "receipt_no",
    header: "# cislo",
  },
  {
    accessorKey: "total",
    header: "Celkem",
  },

  //   {
  //     id: "actions",
  //     cell: ({ row }) => {
  //       const receipt = row.original;
  //       const deleteReceipt = useDeleteReceipt();
  //       const { toast } = useToast();

  //       const handleDelete = async (e: React.MouseEvent) => {
  //         e.stopPropagation(); // Prevent row click event

  //         try {
  //           await deleteReceipt.mutateAsync(receipt.id);
  //           toast({
  //             title: "Success",
  //             description: "Receipt deleted successfully",
  //           });
  //         } catch (error) {
  //           console.error("Failed to delete receipt:", error);
  //           toast({
  //             title: "Error",
  //             description: "Failed to delete receipt",
  //             variant: "destructive",
  //           });
  //         }
  //       };

  //       return (
  //         <div className="flex justify-end">
  //           <Button
  //             variant="ghost"
  //             size="sm"
  //             onClick={handleDelete}
  //             className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
  //           >
  //             <Trash2 className="h-4 w-4" />
  //           </Button>
  //         </div>
  //       );
  //     },
  //   },
];

interface ReceiptsTableProps {
  selectedReceiptId: string | null;
  initialProductId?: string;
}

export function ReceiptsTable({
  selectedReceiptId: initialReceiptId,
  initialProductId,
}: ReceiptsTableProps) {
  const [date, setDate] = useState<Date>();
  const [selectedProductId, setSelectedProductId] = useState(
    initialProductId || ""
  );
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(
    initialReceiptId ? Number(initialReceiptId) : null
  );
  const { data: receipts, isLoading, error } = fetchAllReceipts();
  const { data: products } = fetchAllProducts();
  //   const [selectedDay, setSelectedDay] = useState<string>("all");
  //   const { mutateAsync: insertOrder } = useInsertOrder();
  //   const { mutateAsync: insertOrderItems } = useInsertOrderItems();
  //   const user = useAuthStore((state) => state.user);

  console.log(selectedReceiptId);

  if (isLoading) return <div>Loading orders...</div>;
  if (error) return <div>Error loading orders: {error.message}</div>;
  if (!receipts) return <div>No orders found</div>;

  const filteredReceipts = receipts.filter((receipt) => {
    // First filter by selected day
    // if (selectedDay !== "all" && !receipt.days?.includes(selectedDay))
    //   return false;

    // Then filter by selected product
    if (selectedProductId && selectedProductId !== "all") {
      return receipt.receipt_items?.some(
        (item: ReceiptItem) => item.product_id.toString() === selectedProductId
      );
    }
    return true;
  });

  return (
    <>
      <Card className="my-0 p-4 print:border-none print:shadow-none print:absolute print:top-0 print:left-0 print:right-0 print:m-0 print:h-auto print:overflow-visible print:transform-none">
        <div className="space-y-4 overflow-x-auto print:!m-0">
          <div className="space-y-2">
            <div className="flex justify-between items-center gap-2">
              <Select
                value={selectedProductId}
                onValueChange={setSelectedProductId}
              >
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue placeholder="Filter by product..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {products?.map((product) => (
                    <SelectItem key={product.id} value={product.id.toString()}>
                      <div className="flex justify-between items-center w-full">
                        <span className="mr-2">{product.name}</span>
                        <Badge variant="outline">
                          {
                            filteredReceipts.filter((receipt: Receipt) =>
                              receipt.receipt_items?.some(
                                (item: ReceiptItem) =>
                                  item.product_id.toString() ===
                                  product.id.toString()
                              )
                            ).length
                          }{" "}
                          receipts
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2 items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[240px] justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? (
                        date.toLocaleDateString()
                      ) : (
                        <span>Datum objednávky</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <ReceiptsTableContent
            data={filteredReceipts}
            columns={columns}
            setSelectedReceiptId={setSelectedReceiptId}
          />
        </div>
      </Card>

      {/* <ReceiptDetailsDialog
        receiptId={selectedReceiptId}
        onClose={() => setSelectedReceiptId(null)}
      /> */}
    </>
  );
}

// Updated OrderTableContent component
function ReceiptsTableContent({
  data,
  columns,
  setSelectedReceiptId,
}: {
  data: Receipt[];
  columns: ColumnDef<Receipt>[];
  setSelectedReceiptId: (id: number) => void;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
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
              onClick={() => setSelectedReceiptId(row.original.id)}
              className="cursor-pointer hover:bg-muted/50"
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length} className="h-24 text-center">
              No results.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
