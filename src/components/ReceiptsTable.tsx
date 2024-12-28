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
import { useState, useRef, useCallback } from "react";
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
import { CalendarIcon, PrinterIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Receipt, ReceiptItem } from "types";
import { fetchActiveProducts } from "@/hooks/useProducts";
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
// import { useReceiptStore } from "@/providers/receiptStore";
import { useReactToPrint } from "react-to-print";
import { PrintSummaryTotalReceipts } from "./PrintSummary";
import { PrintReceipt } from "./PrintReceipt";
// import { useProductStore } from "@/providers/productStore";
import { useReceiptStore } from "@/providers/receiptStore";

//   const DAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"] as const;

type DateFilter =
  | "today"
  | "yesterday"
  | "this-month"
  | "last-month"
  | "custom";

type ReceiptsTableProps = {
  selectedReceiptId?: number;
  initialProductId?: string;
  onSelectReceipt?: (id: number) => void;
};

// Update the helper functions
const countItemsByQuantity = (receipt: Receipt) => {
  const counts = receipt.receipt_items?.reduce(
    (acc, item) => {
      if (item.quantity < 0) acc.negative++;
      if (item.quantity === 0) acc.zero++;
      return acc;
    },
    { negative: 0, zero: 0 }
  ) || { negative: 0, zero: 0 };

  return counts;
};

export function ReceiptsTable({
  selectedReceiptId,
  initialProductId,
  // onSelectReceipt,
}: ReceiptsTableProps) {
  // 1. All useState hooks
  const [date, setDate] = useState<Date>();
  const [selectedProductId, setSelectedProductId] = useState(
    initialProductId || ""
  );
  const setSelectedReceiptId = useReceiptStore(
    (state) => state.setSelectedReceiptId
  );
  const [globalFilter, setGlobalFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [selectedReceiptForPrint, setSelectedReceiptForPrint] =
    useState<Receipt | null>(null);

  // 2. All refs
  const printRef = useRef<HTMLDivElement>(null);
  const printReceiptRef = useRef<HTMLDivElement>(null);

  // 3. All store hooks
  const user = useAuthStore((state) => state.user);
  // const setSelectedReceiptId = useReceiptStore(
  //   (state) => state.setSelectedReceiptId
  // );

  // 4. All react-to-print hooks (MOVE THESE BEFORE ANY CONDITIONAL LOGIC)
  const handlePrint = useReactToPrint({
    // @ts-ignore
    content: () => printRef.current,
    contentRef: printRef,
    documentTitle: "Souhrn tržeb",
    removeAfterPrint: true,
    pageStyle: `
      @page {
        size: 80mm 297mm;
        margin: 00mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
        }
      }
    `,
  });

  const handlePrintReceiptRef = useReactToPrint({
    // @ts-ignore
    content: () => printReceiptRef.current,
    contentRef: printReceiptRef,
    documentTitle: "Doklad",
    removeAfterPrint: true,
    onBeforePrint: async () => {
      console.log("Before printing, receipt:", selectedReceiptForPrint);
      return Promise.resolve();
    },
    pageStyle: `
      @page {
        size: 80mm 297mm;
        margin: 0mm;
      }
    `,
  });

  // 5. All queries
  const {
    data: receipts,
    isLoading,
    error,
  } = fetchReceiptsBySellerId(user!.id);
  const { data: products } = fetchActiveProducts();

  // 6. All callbacks
  const handlePrintReceipt = useCallback(
    (receipt: Receipt) => {
      setSelectedReceiptForPrint(receipt);
      handlePrintReceiptRef();
    },
    [handlePrintReceiptRef]
  );

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

  const getTotalForFilteredReceipts = (receipts: Receipt[]) => {
    return receipts.reduce((sum, receipt) => sum + receipt.total, 0);
  };

  // Early returns AFTER all hooks
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

  const filteredTotal = getTotalForFilteredReceipts(filteredReceipts);

  // Add console log to check when component renders
  console.log("ReceiptsTable render, selectedReceiptId:", selectedReceiptId);

  const columns: ColumnDef<Receipt>[] = [
    {
      accessorKey: "date",
      header: () => <div className="w-18 text-left">Datum</div>,
      cell: ({ row }) => (
        <div className="w-18 text-left">
          {new Date(row.original.date).toLocaleString("cs-CZ", {
            dateStyle: "short",
            timeStyle: "short",
          })}
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
      cell: ({ row }) => {
        const counts = countItemsByQuantity(row.original);
        return (
          <div className="flex items-center gap-2">
            <span>{row.original.receipt_no}</span>
            <div className="flex gap-1">
              {counts.negative > 0 && (
                <Badge variant="destructive" className="text-xs">
                  -{counts.negative}
                </Badge>
              )}
              {counts.zero > 0 && (
                <Badge variant="outline" className="text-xs">
                  {counts.zero}
                </Badge>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "total",
      header: () => <div className="text-right">Celkem</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <span className={row.original.total < 0 ? "text-destructive" : ""}>
            {row.original.total.toFixed(2)} Kč
          </span>
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            console.log("Print button clicked for receipt:", row.original);
            handlePrintReceipt(row.original);
          }}
        >
          <PrinterIcon className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const handleRowClick = (id: number) => {
    console.log("Row clicked, id:", id);
    setSelectedReceiptId(id);
  };

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
              <div className="flex justify-between items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => handlePrint()}
                  className="print:hidden"
                >
                  <PrinterIcon className="h-4 w-4" />
                </Button>
                <Badge variant="secondary" className="text-md">
                  Celkem: {filteredTotal.toFixed(2)} Kč
                </Badge>
              </div>
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
            setSelectedReceiptId={handleRowClick}
          />
        </div>
      </Card>
      <div className="hidden">
        <div ref={printRef}>
          <PrintSummaryTotalReceipts
            date={
              dateFilter === "custom" && date
                ? format(date, "PP")
                : dateFilter === "today"
                  ? "Dnes"
                  : dateFilter === "yesterday"
                    ? "Včera"
                    : dateFilter === "this-month"
                      ? "Tento měsíc"
                      : dateFilter === "last-month"
                        ? "Minulý měsíc"
                        : new Date().toLocaleDateString()
            }
            total={filteredTotal}
            userName={user?.full_name ?? ""}
          />
        </div>
        {selectedReceiptForPrint && (
          <div ref={printReceiptRef}>
            <PrintReceipt
              receipt={selectedReceiptForPrint}
              userName={user?.full_name ?? ""}
            />
          </div>
        )}
      </div>
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
