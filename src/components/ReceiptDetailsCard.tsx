import { useFetchReceiptById } from "@/hooks/useReceipts";
import { useReactToPrint } from "react-to-print";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/lib/supabase";

import { useReceiptStore } from "@/providers/receiptStore";
import { Receipt } from "types";
import { ReceiptItems } from "./ReceiptItems";
import { Button } from "./ui/button";
import { PrinterIcon } from "lucide-react";
import { useRef } from "react";

// interface ReceiptDetailsCardProps {
//   receiptId: number | null;
//   onOpenChange: (open: boolean) => void;
// }

export function ReceiptDetailsCard() {
  const user = useAuthStore((state) => state.user);
  // @ts-ignore
  const { selectedReceiptId, setSelectedReceiptId } = useReceiptStore();
  const printRef = useRef<HTMLDivElement>(null);
  const {
    data: receipts,
    error,
    // @ts-ignore
    isLoading,
  } = useFetchReceiptById(selectedReceiptId);

  if (!selectedReceiptId) {
    return null;
  }

  // const updateStatus = (status: string) => {
  //   if (!selectedReceiptId) return;
  //   updateReceipt({ id: selectedReceiptId, updatedFields: { status } });
  // };

  const handlePrint = useReactToPrint({
    // @ts-ignore
    content: () => printRef.current,
    contentRef: printRef,
    pageStyle: `
      @page { 
        size: 58mm 297mm;
        margin: 0mm;
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

  if (isLoading) return <div>Loading receipt details...</div>;
  if (error) return <div>Error loading receipt details</div>;
  if (!receipts) return null;

  return (
    <div className="print:!m-0" ref={printRef}>
      {receipts?.map((receipt: Receipt) => (
        <Card key={receipt.id}>
          <CardHeader>
            <CardTitle></CardTitle>
            <CardTitle className="flex justify-between">
              <div className="w-[200px] print:print-name print:text-[15px]">
                {user?.full_name}
              </div>{" "}
              <Button
                variant="outline"
                onClick={() => handlePrint()}
                className="flex flex-row font-bold text-slate-600 w-1/2 mb-auto"
              >
                <PrinterIcon className="h-4 w-4" />
              </Button>
            </CardTitle>
            <CardDescription className="flex flex-col gap-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-semibold">
                  {new Date(receipt.date).toLocaleDateString()}
                </span>
              </div>
              <span className="print:print-receipt-no">
                # {receipt.receipt_no}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="print:print-items">
              <ReceiptItems items={receipt.receipt_items} />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 print:hidden"></CardFooter>
        </Card>
      ))}
    </div>
  );
}
