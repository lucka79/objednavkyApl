import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/store/")({
  component: StoreDashboard,
});

function StoreDashboard() {
  return <div>Store Dashboard</div>;
}
