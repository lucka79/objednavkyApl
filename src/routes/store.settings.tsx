import { PrinterSettings } from "@/components/PrinterSettings";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/store/settings")({
  component: PrinterDashboard,
});

function PrinterDashboard() {
  return <PrinterSettings />;
}
