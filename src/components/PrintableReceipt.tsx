import { Receipt } from "types";
import { ReceiptItems } from "./ReceiptItems";
import { useAuthStore } from "@/lib/supabase";
import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { Button } from "./ui/button";
import { PrinterIcon } from "lucide-react";

interface PrintableReceiptProps {
  receipt: Receipt;
}

export function PrintableReceipt({ receipt }: PrintableReceiptProps) {
  const user = useAuthStore((state) => state.user);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    // content: () => printRef.current,
    contentRef: printRef,
    pageStyle: `
      @page { 
        size: 80mm 297mm;
        margin: 2mm;
      }
      body {
        padding: 0;
        margin: 0;
        font-size: 8px;
      }
      table {
        font-size: 7px;
      }
      h1, h2, h3 {
        font-size: 10px;
        margin-top: 8px;
      }
      button, .print-hidden {
        display: none !important;
      }
      .print-name {
        font-size: 12px;
        font-weight: bold;
        text-align: center;
      }
      .print-receipt-no {
        font-size: 8px;
        text-align: center;
      }
      .print-items {
        margin-top: 8px;
        text-align: right;
        font-weight: bold;
      }
    `,
  });

  return (
    <>
      <div ref={printRef} className="print:!m-0">
        <div className="w-[200px] print:print-name print:text-[15px]">
          {user?.full_name}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground font-semibold">
              {new Date(receipt.date).toLocaleDateString()}
            </span>
          </div>
          <span className="print:print-receipt-no"># {receipt.receipt_no}</span>
        </div>
        <div className="print:print-items">
          <ReceiptItems items={receipt.receipt_items} />
        </div>
      </div>
      <Button
        variant="outline"
        onClick={() => handlePrint()}
        className="flex flex-row font-bold text-slate-600 w-1/2 mb-auto print:hidden"
      >
        <PrinterIcon className="h-4 w-4" />
      </Button>
    </>
  );
}
