import { createFileRoute } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/supabase";
import { useState } from "react";

import { StoreOrdersTable } from "@/components/StoreOrdersTable";
// import { Badge } from "@/components/ui/badge";
import { StoreOrderDetailsDialog } from "@/components/StoreOrderDetailsDialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/store/orders")({
  component: StoreOrders,
});

function StoreOrders() {
  const user = useAuthStore((state) => state.user);
  const [selectedProductId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"orders" | "returns">("orders");

  if (user?.role !== "store") {
    return <div>Access denied. Store only.</div>;
  }
  return (
    <div className="h-full w-full flex">
      <nav className="flex flex-col gap-2 p-2 border-r bg-background print:hidden">
        <Button
          variant={activeView === "orders" ? "outline" : "secondary"}
          onClick={() => setActiveView("orders")}
          className="cursor-pointer"
        >
          Objednávky
        </Button>
        <Button
          variant={activeView === "returns" ? "outline" : "secondary"}
          onClick={() => setActiveView("returns")}
          className="cursor-pointer"
        >
          Vratky
        </Button>
      </nav>

      <main className="flex-1 grid h-full w-full items-start gap-4 p-2 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-2 xl:grid-cols-2">
        <div className="grid h-full auto-rows-max items-start gap-2 md:gap-8 lg:col-span-2">
          <div className="h-full overflow-y-auto overflow-x-hidden">
            {activeView === "orders" && (
              <StoreOrdersTable selectedProductId={selectedProductId} />
            )}
          </div>
        </div>
        <div className="h-full overflow-y-auto overflow-x-hidden">
          {activeView === "returns" && <StoreOrderDetailsDialog />}
        </div>
      </main>
    </div>
  );
}
