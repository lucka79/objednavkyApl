import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ShoppingCartIcon,
  FileSliders,
  LayoutTemplate,
  Undo2,
} from "lucide-react";

import { useAuthStore } from "@/lib/supabase";

import { ProductCategory } from "@/components/ProductCategory";
import { OrdersTable } from "@/components/OrdersTable";
import CartAdmin from "@/components/CartAdmin";
import { FavoriteOrdersTable } from "@/components/FavoriteOrdersTable";
import { OrderDetailsDialog } from "@/components/OrderDetailsDialog";
import { ReturnsTable } from "@/components/ReturnsTable";

export const Route = createFileRoute("/admin/products")({
  component: AdminProducts,
});

function AdminProducts() {
  const [activeView, setActiveView] = useState<
    "products" | "createOrder" | "orders" | "returns" | "templates"
  >("orders");

  const user = useAuthStore((state) => state.user);

  if (user?.role !== "admin") {
    return <div>Access denied. Admin only.</div>;
  }

  return (
    <div className="h-full w-full flex">
      <nav className="flex flex-col gap-2 p-2 border-r bg-background print:hidden">
        {/* <Button
          variant={activeView === "products" ? "outline" : "ghost"}
          size="icon"
          onClick={() => setActiveView("products")}
        >
          <CakeSlice className="h-5 w-5" />
        </Button> */}
        <Button
          variant={activeView === "createOrder" ? "outline" : "ghost"}
          size="icon"
          onClick={() => setActiveView("createOrder")}
        >
          <ShoppingCartIcon className="h-5 w-5" />
        </Button>
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
        <Button
          variant={activeView === "templates" ? "outline" : "ghost"}
          size="icon"
          onClick={() => setActiveView("templates")}
        >
          <LayoutTemplate className="h-5 w-5" />
        </Button>
      </nav>

      <main className="flex-1 grid h-full w-full items-start gap-4 p-2 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
        <div className="grid h-full auto-rows-max items-start gap-2 md:gap-8 lg:col-span-2">
          <div className="h-full overflow-y-auto overflow-x-hidden">
            {/* {activeView === "table" ? <ProductsTable /> : <ProductCategory />} */}
            {/* {activeView === "products" && <ProductsTable />} */}
            {activeView === "createOrder" && <ProductCategory />}
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
          {/* {activeView === "table" ? <ProductDetailsCard /> : <Cart />} */}

          {/* {activeView === "products" && <ProductDetailsDialog />} */}
          {activeView === "createOrder" && <CartAdmin />}
          {activeView === "orders" && <OrderDetailsDialog />}
        </div>
      </main>
    </div>
  );
}
