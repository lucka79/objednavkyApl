import { useRef, useState, useEffect } from "react";
import { useAuthStore } from "@/lib/supabase";
import { useReceiptStore } from "@/providers/receiptStore";
import { useFetchReceiptById } from "@/hooks/useReceipts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { PrinterIcon } from "lucide-react";
// import { useReactToPrint } from "react-to-print";
import { ReceiptItems } from "./ReceiptItems";
import { PrintReceipt } from "./PrintReceipt";
import { toast } from "@/hooks/use-toast";
// import { printExample } from "../example";
import { ThermalPrinterService } from "@/services/ThermalPrinterService";
import { Receipt } from "types";

export function ReceiptDetailsCard() {
  // 1. Hooks at the top
  const { selectedReceiptId } = useReceiptStore();
  const user = useAuthStore((state) => state.user);
  const {
    data: receipts,
    error,
    isLoading,
  } = useFetchReceiptById(selectedReceiptId);
  const printRef = useRef<HTMLDivElement>(null);
  const [isPrinterConnected, setIsPrinterConnected] = useState(false);
  const printer = ThermalPrinterService.getInstance();

  useEffect(() => {
    const checkPrinterConnection = () => {
      const isConnected = !!localStorage.getItem("thermal_printer_connected");
      setIsPrinterConnected(isConnected);
    };

    checkPrinterConnection();
    window.addEventListener("storage", checkPrinterConnection);

    return () => window.removeEventListener("storage", checkPrinterConnection);
  }, []);

  // 2. Print handler
  // const handlePrint = useReactToPrint({
  //   contentRef: printRef,
  //   documentTitle: "Doklad",
  //   onAfterPrint: () => {
  //     toast({
  //       title: "Doklad vvtisknut",
  //     });
  //   },
  //   pageStyle: `
  //     @page {
  //       size: 80mm 297mm;
  //       margin: 0;
  //     }
  //     @media print {
  //       body {
  //         margin: 0;
  //         padding: 8px;
  //         width: 80mm;
  //         height: 297mm;
  //       }
  //     }
  //   `,
  // });

  const handleThermalPrint = async (receipt: Receipt) => {
    try {
      const receiptText = [
        "\x1B\x40", // Initialize printer
        "\x1B\x61\x01", // Center alignment
        `${user?.full_name}\n`,
        `Doklad #${receipt.receipt_no}\n`,
        `${new Date(receipt.date).toLocaleString("cs-CZ")}\n\n`,

        // Items
        ...receipt.receipt_items.map(
          (item) =>
            `${item.product.name}\n` +
            `${item.quantity}x @ ${item.price.toFixed(2)}\n` +
            `${(item.quantity * item.price).toFixed(2)} Kč\n\n`
        ),

        // Total
        `\nCelkem: ${receipt.total.toFixed(2)} Kč\n\n`,
        "Děkujeme Vám za nákup!\n",
        "APLICA s.r.o., DIČ: CZ00555801\n",
      ].join("");

      await printer.printReceipt(receiptText);
      toast({
        title: "Doklad vytisknut",
      });
    } catch (error) {
      console.error("Printing error:", error);
      toast({
        title: "Chyba tisku",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div>Loading receipt details...</div>;
  }

  if (error) {
    return <div>Error loading receipt details</div>;
  }

  return (
    <div className="space-y-4">
      {/* <Button
        onClick={printExample}
        variant={isPrinterConnected ? "default" : "outline"}
      >
        {isPrinterConnected ? "Printer Connected" : "Connect Printer"}
      </Button> */}

      {/* Display version */}
      {receipts?.map((receipt) => (
        <Card key={receipt.id}>
          <CardHeader>
            <CardTitle className="flex justify-between">
              <div className="w-[200px]">{user?.full_name}</div>
              <Badge variant="outline">{receipt.paid_by}</Badge>
            </CardTitle>

            <CardDescription className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span>Receipt #{receipt.receipt_no}</span>
                <span className="text-muted-foreground font-semibold">
                  {new Date(receipt.date).toLocaleString("cs-CZ", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            </CardDescription>
            <CardDescription>
              <Button
                className="w-1/2"
                variant="outline"
                size="icon"
                onClick={() => receipt && handleThermalPrint(receipt)}
                disabled={!isPrinterConnected}
              >
                <PrinterIcon className="h-4 w-4" />
              </Button>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReceiptItems items={receipt.receipt_items} />
          </CardContent>
          <CardFooter className="flex justify-end gap-2 print:hidden"></CardFooter>
        </Card>
      ))}

      {/* Hidden print version */}
      <div className="hidden">
        <div ref={printRef}>
          {receipts?.map((receipt) => (
            <PrintReceipt
              key={receipt.id}
              receipt={receipt}
              userName={user?.full_name ?? ""}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
