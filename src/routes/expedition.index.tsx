import { useAuthStore } from "@/lib/supabase";
import { useState } from "react";

import { createFileRoute } from "@tanstack/react-router";
// import { FileSliders } from "lucide-react";
// import { Button } from "@/components/ui/button";
import { OrderDetailsDialog } from "@/components/OrderDetailsDialog";
// import { OrdersTable } from "@/components/OrdersTable";
// import { ReturnsTable } from "@/components/ReturnsTable";
import CartAdmin from "@/components/CartAdmin";
import { OrdersExpeditionTable } from "@/components/OrdersExpedition";

export const Route = createFileRoute("/expedition/")({
  component: ExpeditionDashboard,
});

function ExpeditionDashboard() {
  const [activeView] = useState<"createOrder" | "orders">("orders");
  const user = useAuthStore((state) => state.user);

  if (user?.role !== "expedition") {
    return <div>Access denied. Admin a expedice.</div>;
  }
  return (
    <div className="h-full w-full flex">
      {/* <nav className="flex flex-col gap-2 p-2 border-r bg-background print:hidden">
        <Button
          variant={activeView === "orders" ? "outline" : "ghost"}
          size="icon"
          onClick={() => setActiveView("orders")}
        >
          <FileSliders className="h-5 w-5" />
        </Button>
        <Button
          variant={activeView === "returns" ? "outline" : "ghost"}
          size="icon"
          onClick={() => setActiveView("returns")}
        >
          <Undo2 className="h-5 w-5" />
        </Button>
      </nav> */}

      <main className="flex-1 grid h-full w-full items-start gap-4 p-2 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
        <div className="grid h-full auto-rows-max items-start gap-2 md:gap-8 lg:col-span-4">
          <div className="h-full overflow-y-auto overflow-x-hidden">
            {/* {activeView === "orders" && (
              <OrdersTable selectedProductId={null} />
            )} */}
            {activeView === "orders" && (
              <OrdersExpeditionTable selectedProductId={null} />
            )}
            {/* {activeView === "returns" && <ReturnsTable />} */}
          </div>
        </div>
        <div className="h-full overflow-y-auto overflow-x-hidden">
          {activeView === "createOrder" && <CartAdmin />}
          {activeView === "orders" && <OrderDetailsDialog />}
        </div>
      </main>
    </div>
  );
}
