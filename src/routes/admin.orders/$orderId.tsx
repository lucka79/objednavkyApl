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

export const Route = createFileRoute("/admin/orders/$orderId")({
  component: OrderDetails,
});

export function OrderDetails() {
  const { orderId: idString } = useParams({ from: "/admin/orders/$orderId" });
  const orderId = parseInt(idString, 10);

  const {
    data: order,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["orderDetails", orderId],
    queryFn: () => fetchOrderDetails(orderId),
  });

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
        <CardTitle>Order Details - #{order.id}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold">Customer Information</h3>
            <p>Name: {order.user.full_name}</p>
          </div>
          <div>
            <h3 className="font-semibold">Order Information</h3>
            <p>Date: {new Date(order.date).toLocaleString()}</p>
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
