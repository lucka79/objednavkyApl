import { createFileRoute } from "@tanstack/react-router";
import Transfers from "@/components/Transfers";

export const Route = createFileRoute("/user/transfers")({
  component: UserTransfers,
});

function UserTransfers() {
  return <Transfers />;
}
