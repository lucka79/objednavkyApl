import { OrderDetailsDialog } from "@/components/OrderDetailsDialog";
import { OrdersTable } from "@/components/OrdersTable";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/supabase";
import { Undo2 } from "lucide-react";
import { LayoutTemplate } from "lucide-react";
import { FileSliders } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ReturnsTable } from "@/components/ReturnsTable";
import { FavoriteOrdersTable } from "@/components/FavoriteOrdersTable";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TooltipProvider } from "@/components/ui/tooltip";

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrders,
});

function AdminOrders() {
  const user = useAuthStore((state) => state.user);
  // const [selectedProductId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<
    "orders" | "returns" | "templates"
  >("orders");

  if (user?.role !== "admin") {
    return <div>Access denied. Admin only.</div>;
  }

  return (
    <TooltipProvider>
      <div className="h-full w-full flex">
        <nav className="flex flex-col gap-2 p-2 border-r bg-background print:hidden">
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeView === "templates" ? "outline" : "ghost"}
                size="icon"
                onClick={() => setActiveView("templates")}
              >
                <LayoutTemplate className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Šablony objednávek</p>
            </TooltipContent>
          </Tooltip>
        </nav>

        <main className="flex-1 grid h-full w-full items-start gap-4 p-2 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
          <div className="grid h-full auto-rows-max items-start gap-2 md:gap-8 lg:col-span-4">
            <div className="h-full overflow-y-auto overflow-x-hidden">
              {activeView === "orders" && (
                <OrdersTable selectedProductId={null} />
              )}
              {activeView === "returns" && <ReturnsTable />}
              {activeView === "templates" && (
                <FavoriteOrdersTable selectedProductId={null} />
              )}
            </div>
          </div>
          <div className="h-full overflow-y-auto overflow-x-hidden">
            {activeView === "orders" && <OrderDetailsDialog />}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
