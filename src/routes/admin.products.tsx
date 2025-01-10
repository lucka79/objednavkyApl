import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCartIcon } from "lucide-react";

import { useAuthStore } from "@/lib/supabase";

import { ProductCategory } from "@/components/ProductCategory";

import CartAdmin from "@/components/CartAdmin";

export const Route = createFileRoute("/admin/products")({
  component: AdminProducts,
});

function AdminProducts() {
  const [activeView, setActiveView] = useState<
    "products" | "createOrder" | "orders" | "returns" | "templates"
  >("createOrder");

  const user = useAuthStore((state) => state.user);

  if (user?.role !== "admin") {
    return <div>Access denied. Admin only.</div>;
  }

  return (
    <div className="h-full w-full flex">
      <nav className="flex flex-col gap-2 p-2 border-r bg-background print:hidden">
        <Button
          variant={activeView === "createOrder" ? "outline" : "ghost"}
          size="icon"
          onClick={() => setActiveView("createOrder")}
        >
          <ShoppingCartIcon className="h-5 w-5" />
        </Button>
      </nav>

      <main className="h-full w-full flex flex-col md:flex-row gap-2 p-2 sm:px-6 md:px-[20px] lg:px-[40px] sm:py-0">
        <div className="flex-1 md:w-1/2 lg:flex-1 h-full overflow-y-auto overflow-x-hidden">
          {activeView === "createOrder" && <ProductCategory />}
        </div>
        <div className="order-first md:order-last md:w-1/2 lg:w-[33%] h-full w-full overflow-y-auto overflow-x-hidden">
          {activeView === "createOrder" && <CartAdmin />}
        </div>
      </main>
    </div>
  );
}
