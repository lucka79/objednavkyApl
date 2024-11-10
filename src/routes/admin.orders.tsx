import { OrderDetailsCard } from "@/components/OrderDetailsCard";
import { OrdersTable } from "@/components/OrdersTable";
import { ProductOrderFilter } from "@/components/ProductOrderFilter";
import { useAuthStore } from "@/lib/supabase";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrders,
});

function AdminOrders() {
  const user = useAuthStore((state) => state.user);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  );

  if (user?.role !== "admin") {
    return <div>Access denied. Admin only.</div>;
  }

  return (
    <>
      <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-4 xl:grid-cols-4">
        <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2 print:hidden">
          <div className="mb-4">
            <ProductOrderFilter onProductSelect={setSelectedProductId} />
          </div>
          <OrdersTable selectedProductId={selectedProductId} />
        </div>
        <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
          <OrderDetailsCard />
        </div>
      </main>
    </>
  );
}
