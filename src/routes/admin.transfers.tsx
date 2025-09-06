import { createFileRoute } from "@tanstack/react-router";
import Transfers from "@/components/Transfers";

export const Route = createFileRoute("/admin/transfers")({
  component: AdminTransfers,
});

function AdminTransfers() {
  return <Transfers />;
}
