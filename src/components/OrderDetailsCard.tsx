import { fetchOrderDetails } from "@/hooks/useOrders";
import { useOrderStore } from "@/providers/orderStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";

export function OrderDetailsCard() {
  const { selectedOrderId, setSelectedOrderId, setOrderDetails } =
    useOrderStore();

  const {
    data: orderItems,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["orderDetails", selectedOrderId],
    queryFn: () => fetchOrderDetails(selectedOrderId!),

    enabled: !!selectedOrderId,
    onSuccess: (data) => setOrderDetails(data),
  });

  if (!selectedOrderId) return null;
  if (isLoading) return <div>Loading order details...</div>;
  if (error) return <div>Error loading order details</div>;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Order Details</CardTitle>
        <CardDescription>Order ID: {selectedOrderId}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderItems?.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.product.name}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>${item.price.toFixed(2)}</TableCell>
                <TableCell>
                  ${(item.quantity * item.price).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-4 font-bold">
          Total: $
          {orderItems
            ?.reduce((sum, item) => sum + item.quantity * item.price, 0)
            .toFixed(2)}
        </div>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => setSelectedOrderId(0)}
        >
          Close
        </Button>
      </CardContent>
    </Card>
  );
}
