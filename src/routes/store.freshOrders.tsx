import { Category9OrdersTable } from "@/components/Category9OrdersTable";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/store/freshOrders")({
  component: FreshOrders,
});

function FreshOrders() {
  return <Category9OrdersTable />;
}
