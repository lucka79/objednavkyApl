import { useQuery } from "@tanstack/react-query";
import { fetchOrderDetails } from "@/hooks/useOrders";
import { useOrderStore } from "@/providers/orderStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function OrderDetailsDialog() {
  const selectedOrderId = useOrderStore((state) => state.selectedOrderId);
  const setSelectedOrderId = useOrderStore((state) => state.setSelectedOrderId);

  const {
    data: orderItems,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["orderDetails", selectedOrderId],
    queryFn: () => fetchOrderDetails(selectedOrderId!),
    enabled: !!selectedOrderId,
  });

  if (isLoading) return <div>Loading order details...</div>;
  if (error) return <div>Error loading order details</div>;

  return (
    <Dialog open={!!selectedOrderId} onOpenChange={() => setSelectedOrderId(0)}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Order Details</DialogTitle>
          <DialogDescription>Order ID: {selectedOrderId}</DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderItems?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.product.name}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>${item.price.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 font-bold">
          Total: $
          {orderItems
            ?.reduce((sum, item) => sum + item.quantity * item.price, 0)
            .toFixed(2)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
