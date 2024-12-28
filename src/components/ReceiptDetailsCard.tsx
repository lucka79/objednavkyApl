import { useRef } from "react";
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
import { useReactToPrint } from "react-to-print";
import { ReceiptItems } from "./ReceiptItems";
import { PrintReceipt } from "./PrintReceipt";
import { toast } from "@/hooks/use-toast";

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

  // 2. Print handler
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "Doklad",
    onAfterPrint: () => {
      toast({
        title: "Doklad vvtisknut",
      });
    },
    pageStyle: `
      @page {
        size: 80mm 297mm;
        margin: 0;
      }
      @media print {
        body {
          margin: 0;
          padding: 8px;
          width: 80mm;
          height: 297mm;
        }
      }
    `,
  });

  if (isLoading) {
    return <div>Loading receipt details...</div>;
  }

  if (error) {
    return <div>Error loading receipt details</div>;
  }

  return (
    <div className="space-y-4">
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
                  {new Date(receipt.date).toLocaleDateString()}
                </span>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReceiptItems items={receipt.receipt_items} />
          </CardContent>
          <CardFooter className="flex justify-end gap-2 print:hidden">
            <Button
              variant="outline"
              size="icon"
              onClick={() => window.print()}
            >
              <PrinterIcon className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => handlePrint()}>
              <PrinterIcon className="h-4 w-4" />
            </Button>
          </CardFooter>
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
