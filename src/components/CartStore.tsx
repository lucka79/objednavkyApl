// Cart.tsx
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Coins, SquareMinus, SquarePlus } from "lucide-react";
import { Label } from "@/components/ui/label";
// import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useReceiptStore } from "@/providers/receiptStore";
import {
  useInsertReceipt,
  useInsertReceiptItems,
  useUpdateStoredItems,
} from "@/hooks/useReceipts";
import { useState } from "react";
import { generateReceiptNumber } from "@/lib/generateNumbers";
import { PrintReceipt } from "@/components/PrintReceipt";
import { ThermalPrinterService } from "@/services/ThermalPrinterService";

export default function CartStore() {
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);
  const { mutateAsync: insertReceipt } = useInsertReceipt();
  const { mutateAsync: insertReceiptItems } = useInsertReceiptItems();
  const { mutateAsync: updateStoredItems } = useUpdateStoredItems();
  const {
    items,
    // removeItem,
    updateQuantity,
    // clearCart,

    checkout,
  } = useReceiptStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const printerService = ThermalPrinterService.getInstance();

  const date = new Date();
  date.setHours(date.getHours() + 1); // Add 1 hour to the current date
  const formattedDate = date.toISOString(); // Format the date to ISO string for database

  // Format the current date for display
  const displayDate = date.toLocaleDateString("cs-CZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      return sum + item.product.price * item.quantity;
    }, 0);
  };

  const formatReceiptForPrinting = (receipt: any, userName: string) => {
    let printText = "";

    // Header
    printText += `\n${userName}\n`;
    printText += `Účtenka č. ${receipt.receipt_no}\n`;
    printText += `${new Date(receipt.date).toLocaleString("cs-CZ")}\n\n`;

    // Items
    receipt.receipt_items.forEach((item: any) => {
      printText += `${item.product.name}\n`;
      printText += `${item.quantity}x ${item.price.toFixed(2)} Kč`;
      printText += `    ${(item.quantity * item.price).toFixed(2)} Kč\n`;
    });

    // VAT Summary
    const vatTotals = receipt.receipt_items.reduce((acc: any, item: any) => {
      const vat = item.vat || 0;
      const total = item.quantity * item.price;
      const vatAmount = total * (vat / (100 + vat));
      const netAmount = total - vatAmount;

      acc[vat] = acc[vat] || { net: 0, vat: 0 };
      acc[vat].net += netAmount;
      acc[vat].vat += vatAmount;
      return acc;
    }, {});

    // Print VAT details
    Object.entries(vatTotals).forEach(([rate, amounts]: [string, any]) => {
      printText += `\nZáklad daně (${rate}%): ${amounts.net.toFixed(2)} Kč\n`;
      printText += `DPH ${rate}%: ${amounts.vat.toFixed(2)} Kč\n`;
    });

    // Footer
    printText += `\nCelkem k úhradě: ${receipt.total.toFixed(2)} Kč\n\n`;
    printText += `Děkujeme za Váš nákup!\n`;
    printText += `APLICA s.r.o., DIČ: CZ00555801\n`;

    return printText;
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast({
        title: "Error",
        description: "Zeje to tu prázdnotou",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const orderTotal = calculateTotal();

      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      // Generate receipt number
      const receiptNo = await generateReceiptNumber(user.id);

      // Create receipt data
      const receipt = {
        receipt_no: receiptNo,
        date: formattedDate,
        total: orderTotal,
        id: 0,
        paid_by: "cash",
        seller_id: user.id,
        buyer_id: null,
        receipt_items: items.map((item) => ({
          id: item.product.id,
          product_id: item.product.id,
          product: item.product,
          quantity: item.quantity,
          price: item.product.price,
          vat: item.product.vat || 0,
        })),
      };

      // Save to database first
      await checkout(
        insertReceipt,
        insertReceiptItems,
        new Date(formattedDate),
        orderTotal,
        updateStoredItems,
        receiptNo
      );

      // Format receipt for printing
      const printContent = formatReceiptForPrinting(
        receipt,
        user.full_name || ""
      );
      console.log("Printing content:", printContent); // Debug log
      await printerService.printReceipt(printContent);

      // Set receipt data for display
      setReceiptData(receipt);

      toast({
        title: "Účtenka vytištěna",
        description: "Účtenka byla úspěšně vytištěna",
        variant: "default",
      });
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Chyba",
        description: "Nastala chyba při tisku nebo ukládání účtenky",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2">
            <CardTitle className="flex flex-row justify-between gap-2">
              <div className="w-[200px]">{user?.full_name}</div>

              {/* <Button
                variant="outline"
                onClick={() => {
                  clearCart();
                }}
              >
                Smazat
              </Button> */}
            </CardTitle>
          </div>
          <CardDescription>
            <div className="text-sm">{displayDate}</div>{" "}
            {/* Display the formatted date */}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {items.length === 0 ? (
            <p>Není vložený výrobek.</p>
          ) : (
            items.map((item) => (
              <div key={item.product.id} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm line-clamp-1 hover:line-clamp-2">
                    {item.product.name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {item.product.price.toFixed(2)} Kč
                  </span>
                  <div className="flex items-center">
                    {item.quantity > 0 && (
                      <SquareMinus
                        onClick={() =>
                          updateQuantity(
                            item.product.id,
                            Math.max(0, item.quantity - 1)
                          )
                        }
                        className="text-stone-300 cursor-pointer hover:text-stone-400"
                      />
                    )}
                    <Input
                      type="number"
                      min="0"
                      value={item.quantity}
                      onChange={(e) => {
                        const value = Math.max(
                          0,
                          parseInt(e.target.value) || 0
                        );
                        updateQuantity(item.product.id, value);
                      }}
                      className="w-16 mx-2 text-center"
                    />
                    <SquarePlus
                      onClick={() =>
                        updateQuantity(item.product.id, item.quantity + 1)
                      }
                      className="text-stone-300 cursor-pointer hover:text-stone-400"
                    />
                    <Label className="w-16 mx-2 justify-end">
                      {(item.product.price * item.quantity).toFixed(2)} Kč
                    </Label>
                  </div>
                </div>
              </div>
            ))
          )}
          <Button
            onClick={handleSubmit}
            variant="outline"
            disabled={isSubmitting}
            className="flex flex-row font-bold text-slate-600 w-full mb-auto"
          >
            <Coins className="flex flex-row font-bold text-slate-600 w-1/12 mb-auto" />
            {isSubmitting ? "Zpracování..." : calculateTotal().toFixed(2)}
          </Button>
        </CardContent>
        {/* <CardFooter className="flex flex-row">
          <Button onClick={clearCart}>Clear Cart</Button>
        </CardFooter> */}
      </Card>

      {receiptData && (
        <div className="mt-4">
          <PrintReceipt
            receipt={receiptData}
            userName={user?.full_name || ""}
          />
        </div>
      )}
    </>
  );
}
