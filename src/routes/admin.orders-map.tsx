import { createFileRoute } from "@tanstack/react-router";
import { OrdersMap } from "../components/OrdersMap";

export const Route = createFileRoute("/admin/orders-map")({
  component: OrdersMapPage,
});

function OrdersMapPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <OrdersMap />
    </div>
  );
}
