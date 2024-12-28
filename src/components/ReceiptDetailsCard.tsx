import { useFetchReceiptById } from "@/hooks/useReceipts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/lib/supabase";

import { useReceiptStore } from "@/providers/receiptStore";
import { Receipt } from "types";
import { ReceiptItems } from "./ReceiptItems";

import { useRef } from "react";

// interface ReceiptDetailsCardProps {
//   receiptId: number | null;
//   onOpenChange: (open: boolean) => void;
// }

export function ReceiptDetailsCard() {
  const { selectedReceiptId } = useReceiptStore();
  const user = useAuthStore((state) => state.user);
  const { data: receipts, error } = useFetchReceiptById(selectedReceiptId);
  // @ts-ignore

  const printRef = useRef<HTMLDivElement>(null);

  if (!selectedReceiptId) {
    return null;
  }

  if (error) return <div>Error loading receipt details</div>;
  if (!receipts) return null;

  return (
    <div className="print:!m-0" ref={printRef}>
      {receipts?.map((receipt: Receipt) => (
        <Card key={receipt.id}>
          <CardHeader>
            <CardTitle>{user?.full_name}</CardTitle>
            <CardDescription className="flex justify-between">
              {/* <PrintableReceipt receipt={receipt} /> */}
              <span className="text-muted-foreground font-semibold">
                {new Date(receipt.date).toLocaleDateString()}
              </span>
              <span className="text-muted-foreground font-semibold">
                {receipt.receipt_no}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReceiptItems items={receipt.receipt_items} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
