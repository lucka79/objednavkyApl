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
import { fetchReceiptsBySellerId } from "@/hooks/useReceipts";
import { Input } from "./ui/input";
import { useAuthStore } from "@/lib/supabase";
import {
  startOfToday,
  startOfYesterday,
  startOfMonth,
  subMonths,
  endOfMonth,
} from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReceiptStore } from "@/providers/receiptStore";

//   const DAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"] as const;

type DateFilter =
  | "today"
  | "yesterday"
  | "this-month"
  | "last-month"
  | "custom";

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
    header: () => <div className="text-right">Celkem</div>,
    cell: ({ row }) => (
      <div className="text-right">{row.original.total.toFixed(2)} Kč</div>
    ),
  },
];

interface ReceiptsTableProps {
  selectedReceiptId: string | null;
  initialProductId?: string;
}

export function ReceiptsTable({
  selectedReceiptId: initialReceiptId,
  initialProductId,
}: ReceiptsTableProps) {
  const user = useAuthStore((state) => state.user);
  const [date, setDate] = useState<Date>();
  const [selectedProductId, setSelectedProductId] = useState(
    initialProductId || ""
  );
  const setSelectedReceiptId = useReceiptStore(
    (state) => state.setSelectedReceiptId
  );
  //   const { data: receipts, isLoading, error } = fetchAllReceipts();
  const {
    data: receipts,
    isLoading,
    error,
  } = fetchReceiptsBySellerId(user!.id);
  const { data: products } = fetchAllProducts();
  //   const [selectedDay, setSelectedDay] = useState<string>("all");
  //   const { mutateAsync: insertOrder } = useInsertOrder();
  //   const { mutateAsync: insertOrderItems } = useInsertOrderItems();
  //   const user = useAuthStore((state) => state.user);
  const [globalFilter, setGlobalFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");

  const isDateInRange = (receiptDate: Date, filter: DateFilter) => {
    const date = new Date(receiptDate);

    switch (filter) {
      case "today":
        const today = startOfToday();
        return date >= today;
      case "yesterday":
        const yesterday = startOfYesterday();
        return date >= yesterday && date < startOfToday();
      case "this-month":
        const firstDayOfMonth = startOfMonth(new Date());
        return date >= firstDayOfMonth;
      case "last-month":
        const firstDayLastMonth = startOfMonth(subMonths(new Date(), 1));
        const lastDayLastMonth = endOfMonth(firstDayLastMonth);
        return date >= firstDayLastMonth && date <= lastDayLastMonth;
      default:
        return true;
    }
  };

  const getReceiptCountForFilter = (filter: DateFilter) => {
    return (
      receipts?.filter((receipt) => {
        if (filter === "custom") {
          return false; // Don't show count for custom filter
        }
        return isDateInRange(new Date(receipt.date), filter);
      }).length || 0
    );
  };

  if (isLoading) return <div>Loading orders...</div>;
  if (error) return <div>Error loading orders: {error.message}</div>;
  if (!receipts) return <div>No orders found</div>;

  const filteredReceipts = receipts.filter((receipt) => {
    // First filter by selected product
    if (selectedProductId && selectedProductId !== "all") {
      const hasProduct = receipt.receipt_items?.some(
        (item: ReceiptItem) => item.product_id.toString() === selectedProductId
      );
      if (!hasProduct) return false;
    }

    // Then filter by date
    if (date) {
      const receiptDate = new Date(receipt.date);
      const selectedDate = new Date(date);
      if (
        receiptDate.getDate() !== selectedDate.getDate() ||
        receiptDate.getMonth() !== selectedDate.getMonth() ||
        receiptDate.getFullYear() !== selectedDate.getFullYear()
      ) {
        return false;
      }
    } else if (dateFilter !== "custom") {
      if (!isDateInRange(new Date(receipt.date), dateFilter)) {
        return false;
      }
    }

    // Then filter by globalFilter
    if (globalFilter) {
      return (
        receipt.receipt_no.toLowerCase().includes(globalFilter.toLowerCase()) ||
        receipt.total.toString().includes(globalFilter) ||
        new Date(receipt.date).toLocaleDateString().includes(globalFilter)
      );
    }

    return true;
  });

  // Add console log to check when component renders
  console.log("ReceiptsTable render, selectedReceiptId:", initialReceiptId);

  return (
    <>
      <Card className="my-0 p-4 print:hidden">
        <div className="space-y-4 overflow-x-auto print:!m-0">
          <div className="space-y-2">
            {" "}
            <div className="flex gap-2 items-center">
              <Input
                type="text"
                placeholder="Search receipts..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="max-w-sm"
              />
            </div>
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
                {dateFilter === "custom" && (
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
                        {date ? format(date, "PP") : <span>Vybrat datum</span>}
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
                )}
              </div>{" "}
            </div>
            <div className="flex justify-between items-center gap-2">
              <Tabs
                defaultValue="today"
                value={dateFilter}
                onValueChange={(value) => {
                  setDateFilter(value as DateFilter);
                  setDate(undefined);
                }}
                className="w-full"
              >
                <TabsList className="grid grid-cols-5">
                  <TabsTrigger value="today">
                    Dnes
                    <Badge variant="secondary" className="ml-2">
                      {getReceiptCountForFilter("today")}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="yesterday">
                    Včera
                    <Badge variant="secondary" className="ml-2">
                      {getReceiptCountForFilter("yesterday")}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="this-month">
                    Tento měsíc
                    <Badge variant="secondary" className="ml-2">
                      {getReceiptCountForFilter("this-month")}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="last-month">
                    Minulý měsíc
                    <Badge variant="secondary" className="ml-2">
                      {getReceiptCountForFilter("last-month")}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger
                    value="custom"
                    className="flex items-center gap-2"
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {date ? format(date, "PP") : "Vlastní datum"}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <ReceiptsTableContent
            data={filteredReceipts}
            columns={columns}
            setSelectedReceiptId={setSelectedReceiptId}
          />
        </div>
      </Card>
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

  const handleRowClick = (id: number) => {
    console.log("Row clicked, id:", id);
    setSelectedReceiptId(id);
  };

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
              onClick={() => handleRowClick(row.original.id)}
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
