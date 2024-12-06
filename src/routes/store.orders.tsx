import { createFileRoute } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/supabase";
import { useState } from "react";
import CartStore from "@/components/CartStore";
import { StoreOrdersTable } from "@/components/StoreOrdersTable";
import { Badge } from "@/components/ui/badge";
import { StoreOrderDetailsDialog } from "@/components/StoreOrderDetailsDialog";

export const Route = createFileRoute("/store/orders")({
  component: StoreOrders,
});

function StoreOrders() {
  const user = useAuthStore((state) => state.user);
  const [selectedProductId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"createOrder" | "orders">(
    "createOrder"
  );

  if (user?.role !== "store") {
    return <div>Access denied. Store only.</div>;
  }
  return (
    <div className="h-full w-full flex">
      <nav className="flex flex-col gap-2 p-2 border-r bg-background print:hidden">
        <Badge
          variant={activeView === "createOrder" ? "outline" : "secondary"}
          onClick={() => setActiveView("createOrder")}
          className="cursor-pointer"
        >
          Objednávky
        </Badge>
        <Badge
          variant={activeView === "orders" ? "outline" : "secondary"}
          onClick={() => setActiveView("orders")}
          className="cursor-pointer"
        >
          Vratky
        </Badge>
      </nav>

      <main className="flex-1 grid h-full w-full items-start gap-4 p-2 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-2 xl:grid-cols-2">
        <div className="grid h-full auto-rows-max items-start gap-2 md:gap-8 lg:col-span-2">
          <div className="h-full overflow-y-auto overflow-x-hidden">
            {activeView === "createOrder" && (
              <StoreOrdersTable selectedProductId={selectedProductId} />
            )}
          </div>
        </div>
        <div className="h-full overflow-y-auto overflow-x-hidden">
          {activeView === "createOrder" && <StoreOrderDetailsDialog />}
        </div>
      </main>
    </div>
  );
}
