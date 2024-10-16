import { createFileRoute, useParams } from "@tanstack/react-router";
import { fetchOrderDetails } from "@/hooks/useOrders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { useOrderStore } from "@/providers/orderStore";
import { useAuthStore } from "@/lib/supabase";

export const Route = createFileRoute("/admin/orders/$orderId")({
  component: OrderDetails,
});

export function OrderDetails() {
  const user = useAuthStore((state) => state.user);
  const selectedOrderId = useOrderStore((state) => state.selectedOrderId);
  const setSelectedOrderId = useOrderStore((state) => state.setSelectedOrderId);

  const {
    data: order,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["orderDetails", selectedOrderId],
    queryFn: () => fetchOrderDetails(selectedOrderId),
    enabled: !!user,
  });

  if (user?.role !== "admin") {
    return <div>Access denied. Admin only.</div>;
  }

  //   const order = orders.find((o: Order) => o.id === parseInt(orderId));
  if (isLoading) {
    return <Loader2 className="animate-spin" />;
  }

  if (error || !order) {
    return <Label>Nepovedlo se získat data objednavek.</Label>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Details - #{selectedOrderId}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Customer Information</h3>
            <p>Name: </p>
          </div>
          <div>
            <h3 className="font-semibold">Order Information</h3>
            <p>Date: {new Date(order.created_at).toLocaleString()}</p>
            <p>Total: ${order.total.toFixed(2)}</p>
          </div>
          <div>
            <h3 className="font-semibold">Order Items</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.order_items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.product.name}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>${item.product.price.toFixed(2)}</TableCell>
                    <TableCell>
                      ${(item.quantity * item.product.price).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
