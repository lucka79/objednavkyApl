import { createFileRoute } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/supabase";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCartIcon, FileSliders } from "lucide-react";
import { StoreCategory } from "@/components/StoreCategory";
import CartStore from "@/components/CartStore";
import { ReceiptsTable } from "@/components/ReceiptsTable";
import { ReceiptDetailsCard } from "@/components/ReceiptDetailsCard";
import { useReceiptStore } from "@/providers/receiptStore";

export const Route = createFileRoute("/store/")({
  component: StoreDashboard,
});

function StoreDashboard() {
  const [activeView, setActiveView] = useState<"createReceipt" | "receipts">(
    "createReceipt"
  );

  const user = useAuthStore((state) => state.user);
  const selectedReceiptId = useReceiptStore((state) => state.selectedReceiptId);

  if (user?.role !== "admin" && user?.role !== "store") {
    return <div>Access denied. Admin and store only.</div>;
  }
  return (
    <div className="h-full w-full flex">
      <nav className="flex flex-col gap-2 p-2 border-r bg-background print:hidden">
        <Button
          variant={activeView === "createReceipt" ? "outline" : "ghost"}
          size="icon"
          onClick={() => setActiveView("createReceipt")}
        >
          <ShoppingCartIcon className="h-5 w-5" />
        </Button>
        <Button
          variant={activeView === "receipts" ? "outline" : "ghost"}
          size="icon"
          onClick={() => setActiveView("receipts")}
        >
          <FileSliders className="h-5 w-5" />
        </Button>
      </nav>

      <main className="flex-1 grid h-full w-full items-start gap-4 p-2 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
        <div className="grid h-full auto-rows-max items-start gap-2 md:gap-8 lg:col-span-2">
          <div className="h-full overflow-y-auto overflow-x-hidden">
            {/* {activeView === "table" ? <ProductsTable /> : <ProductCategory />} */}

            {activeView === "createReceipt" && <StoreCategory />}
            {activeView === "receipts" && (
              <ReceiptsTable
                selectedReceiptId={selectedReceiptId ?? undefined}
                onSelectReceipt={(id) =>
                  useReceiptStore.getState().setSelectedReceiptId(id)
                }
              />
            )}
          </div>
        </div>
        <div className="h-full overflow-y-auto overflow-x-hidden">
          {/* {activeView === "table" ? <ProductDetailsCard /> : <Cart />} */}

          {/* {activeView === "products" && <ProductDetailsCard />} */}
          {activeView === "createReceipt" && <CartStore />}
          {activeView === "receipts" && <ReceiptDetailsCard />}
        </div>
      </main>
    </div>
  );
}
