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

import {
  startOfWeek,
  startOfMonth,
  format,
  endOfWeek,
  endOfMonth,
  addWeeks,
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
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [viewMode, setViewMode] = useState<"today" | "week" | "month">("today");

  const { data: products, isLoading } = useProductsWithDailyQuantities(
    format(selectedDate, "yyyy-MM-dd")
  );

  const weekStart = startOfWeek(selectedDate, { locale: cs, weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { locale: cs, weekStartsOn: 1 });
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);

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
          <div className="flex flex-col gap-4">
            {activeView === "reports" && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setSelectedDate(today);
                    setViewMode("today");
                  }}
                  className={`px-3 py-1 rounded ${
                    viewMode === "today"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Dnes
                </button>
                <button
                  onClick={() => {
                    setSelectedDate(weekStart);
                    setViewMode("week");
                  }}
                  className={`px-3 py-1 rounded ${
                    viewMode === "week"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {format(weekStart, "dd.MM.")} - {format(weekEnd, "dd.MM.")}
                </button>
                <button
                  onClick={() => {
                    setSelectedDate(addWeeks(weekStart, 1));
                    setViewMode("week");
                  }}
                  className={`px-3 py-1 rounded ${
                    viewMode === "week" &&
                    format(selectedDate, "yyyy-MM-dd") ===
                      format(addWeeks(weekStart, 1), "yyyy-MM-dd")
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {format(addWeeks(weekStart, 1), "dd.MM.")} -{" "}
                  {format(addWeeks(weekEnd, 1), "dd.MM.")}
                </button>
                <button
                  onClick={() => {
                    setSelectedDate(monthStart);
                    setViewMode("month");
                  }}
                  className={`px-3 py-1 rounded ${
                    viewMode === "month"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {format(monthStart, "dd.MM.")} - {format(monthEnd, "dd.MM.")}
                </button>
              </div>
            )}
            {activeView === "reports" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {products
                  ?.filter(
                    (product): product is NonNullable<typeof product> =>
                      product !== null &&
                      (product.orderItemQty > 0 || product.receiptItemQty > 0)
                  )
                  .map((product) => (
                    <Suspense
                      key={product.id}
                      fallback={
                        <div className="h-[200px] animate-pulse bg-muted rounded-lg" />
                      }
                    >
                      <ProductQuantityCard
                        productName={product.productName}
                        productionQty={product.productionQty}
                        returnsQty={product.returnsQty}
                        orderItemQty={product.orderItemQty}
                        receiptItemQty={product.receiptItemQty}
                      />
                    </Suspense>
                  ))}
              </div>
            )}
            {activeView === "returns" && (
              <div className="w-full">
                <ZeroQuantityOrders />
              </div>
            )}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
