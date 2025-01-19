import { Suspense, lazy } from "react";

// import { fetchAllProducts } from "@/hooks/useProducts";
import { createFileRoute } from "@tanstack/react-router";
import { useProductsWithDailyQuantities } from "@/hooks/useProducts";

import { TooltipContent } from "@/components/ui/tooltip";
import { TooltipTrigger } from "@/components/ui/tooltip";
import { Tooltip } from "@/components/ui/tooltip";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { FileSliders, Undo2 } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  startOfWeek,
  startOfMonth,
  subMonths,
  subDays,
  format,
  addDays,
} from "date-fns";
import { cs } from "date-fns/locale";
import { ZeroQuantityOrders } from "@/components/ZeroQuantityOrders";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsDashboard,
});

const ProductQuantityCard = lazy(
  () => import("@/components/reports/ProductQuantityCard")
);

function ReportsDashboard() {
  const [activeView, setActiveView] = useState<"reports" | "returns">(
    "returns"
  );
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState("today");

  const dateRanges = {
    today: format(today, "yyyy-MM-dd"),
    tomorrow: format(addDays(today, 1), "yyyy-MM-dd"),
    yesterday: format(subDays(today, 1), "yyyy-MM-dd"),
    thisWeek: format(
      startOfWeek(today, { locale: cs, weekStartsOn: 1 }),
      "yyyy-MM-dd"
    ),
    nextWeek: format(
      addDays(startOfWeek(today, { locale: cs, weekStartsOn: 1 }), 7),
      "yyyy-MM-dd"
    ),
    thisMonth: format(startOfMonth(today), "yyyy-MM-dd"),
    lastMonth: format(startOfMonth(subMonths(today, 1)), "yyyy-MM-dd"),
  };

  const { data: products, isLoading } = useProductsWithDailyQuantities(
    dateRanges[selectedDate as keyof typeof dateRanges]
  );

  if (isLoading) return <div>Loading...</div>;
  if (!products) return null;

  return (
    <TooltipProvider>
      <div className="h-full w-full flex">
        <nav className="flex flex-col gap-2 p-2 border-r bg-background print:hidden">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={activeView === "reports" ? "outline" : "ghost"}
                size="icon"
                onClick={() => setActiveView("reports")}
              >
                <FileSliders className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-orange-500 text-white">
              <p>Statistiky</p>
            </TooltipContent>
          </Tooltip>
          <Button
            variant={activeView === "returns" ? "outline" : "ghost"}
            size="icon"
            onClick={() => setActiveView("returns")}
          >
            <Undo2 className="h-5 w-5" />
          </Button>
        </nav>
        <main className="flex-1 p-4">
          <Tabs
            value={selectedDate}
            onValueChange={setSelectedDate}
            className="mb-4"
          >
            <TabsList>
              <TabsTrigger value="today">Dnes</TabsTrigger>
              <TabsTrigger value="tomorrow">Zítra</TabsTrigger>
              <TabsTrigger value="yesterday">Včera</TabsTrigger>
              <TabsTrigger value="thisWeek">Tento týden</TabsTrigger>
              <TabsTrigger value="nextWeek">Následující týden</TabsTrigger>
              <TabsTrigger value="thisMonth">Tento měsíc</TabsTrigger>
              <TabsTrigger value="lastMonth">Předchozí měsíc</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-4">
            {activeView === "reports" &&
              products
                .filter(
                  (product): product is NonNullable<typeof product> =>
                    product !== null
                )
                .map((product) => (
                  <Suspense
                    key={product.id}
                    fallback={
                      <div className="h-[200px] animate-pulse bg-muted rounded-lg" />
                    }
                  >
                    <ProductQuantityCard
                      productId={product.id}
                      productName={product.productName}
                      productionQty={product.productionQty}
                      returnsQty={product.returnsQty}
                      orderItemQty={product.orderItemQty}
                      receiptItemQty={product.receiptItemQty}
                      date={dateRanges[selectedDate as keyof typeof dateRanges]}
                    />
                  </Suspense>
                ))}
            {activeView === "returns" && (
              <div className="w-full">
                <ZeroQuantityOrders
                  date={dateRanges[selectedDate as keyof typeof dateRanges]}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
