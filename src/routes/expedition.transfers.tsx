import { createFileRoute } from "@tanstack/react-router";
import Transfers from "@/components/Transfers";

export const Route = createFileRoute("/expedition/transfers")({
  component: ExpeditionTransfers,
});

function ExpeditionTransfers() {
  return <Transfers />;
}
