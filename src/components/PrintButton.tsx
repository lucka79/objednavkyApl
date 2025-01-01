import { printReceipt } from "@/utils/iminPrint";
import { Button } from "./ui/button";

export function PrintButton({ data }: { data: any }) {
  const handlePrint = async () => {
    await printReceipt(data);
  };

  return <Button onClick={handlePrint}>Print Receipt</Button>;
}
