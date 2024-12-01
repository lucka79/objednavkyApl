import { useFetchReceiptById } from "@/hooks/useReceipts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "./ui/badge";
import { useAuthStore } from "@/lib/supabase";

import { useReceiptStore } from "@/providers/receiptStore";
import { Receipt } from "types";
import { ReceiptItems } from "./ReceiptItems";

interface ReceiptDetailsCardProps {
  receiptId: number | null;
  onOpenChange: (open: boolean) => void;
}

export function ReceiptDetailsCard() {
  const user = useAuthStore((state) => state.user);
  const { selectedReceiptId, setSelectedReceiptId } = useReceiptStore();

  const {
    data: receipts,
    error,
    isLoading,
    // refetch,
  } = useFetchReceiptById(selectedReceiptId ?? null);

  if (!selectedReceiptId) {
    return null;
  }

  //

  if (isLoading) return <div>Loading receipt details...</div>;
  if (error) return <div>Error loading receipt details</div>;

  return (
    <div className="print:!m-0">
      {receipts?.map((receipt: Receipt) => (
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
          <CardFooter className="flex flex-col gap-2 print:hidden"></CardFooter>
        </Card>
      ))}
    </div>
  );
}
