import CartAdmin from "@/components/CartAdmin";

import { ProductCategory } from "@/components/ProductCategory";
import { useAuthStore } from "@/lib/supabase";

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/expedition/create")({
  component: ExpeditionCreate,
});

function ExpeditionCreate() {
  const user = useAuthStore((state) => state.user);

  if (user?.role !== "admin" && user?.role !== "expedition") {
    return <div>Access denied. Admin a expedice.</div>;
  }
  return (
    <div className="h-full w-full flex">
      <nav className="flex flex-col gap-2 p-2 border-r bg-background print:hidden">
        {/* <Button
          variant={activeView === "createOrder" ? "outline" : "ghost"}
          size="icon"
          onClick={() => setActiveView("createOrder")}
        >
          <ShoppingCartIcon className="h-5 w-5" />
        </Button> */}
      </nav>

      <main className="flex-1 grid h-full w-full items-start gap-4 p-2 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
        <div className="grid h-full auto-rows-max items-start gap-2 md:gap-8 lg:col-span-2">
          <div className="h-full overflow-y-auto overflow-x-hidden">
            <ProductCategory />
          </div>
        </div>
        <div className="h-full overflow-y-auto overflow-x-hidden">
          <CartAdmin />
        </div>
      </main>
    </div>
  );
}
