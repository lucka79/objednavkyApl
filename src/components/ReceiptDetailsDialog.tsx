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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useReceiptStore } from "@/providers/receiptStore";
import { Receipt } from "types";
import { ReceiptItems } from "./ReceiptItems";

// interface ReceiptDetailsDialogProps {
//   receiptId: number | null;
//   onOpenChange: (open: boolean) => void;
// }

export function ReceiptDetailsDialog() {
  const user = useAuthStore((state) => state.user);
  const { selectedReceiptId, setSelectedReceiptId } = useReceiptStore();

  const {
    data: receipts,
    error,
    // @ts-ignore
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
    <Dialog
      open={!!selectedReceiptId}
      // @ts-ignore
      onOpenChange={(open) => !open && setSelectedReceiptId(null)}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:border-none print:shadow-none print:absolute print:top-0 print:left-0 print:right-0 print:m-0 print:h-auto print:overflow-visible print:transform-none">
        <DialogHeader>
          <DialogTitle>Detail účtenky</DialogTitle>
          <DialogDescription>Detail účtenky s položkami</DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}
