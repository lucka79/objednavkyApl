import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProductQuantityCardProps {
  productName: string;
  productionQty: number;
  returnsQty: number;
  orderItemQty: number;
  receiptItemQty: number;
}

export default function ProductQuantityCard({
  productName,
  productionQty,
  returnsQty,
  orderItemQty,
  receiptItemQty,
}: ProductQuantityCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{productName}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Výroba</p>
            <p className="text-2xl font-bold">{productionQty}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Vratky</p>
            <p className="text-2xl font-bold">{returnsQty}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Objednávky
            </p>
            <p className="text-2xl font-bold">{orderItemQty}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Prodejky
            </p>
            <p className="text-2xl font-bold">{receiptItemQty}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
