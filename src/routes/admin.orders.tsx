import { OrdersAdmin } from "@/components/OrdersAdmin";
import { OrdersTable } from "@/components/OrdersTable";
import { useAuthStore } from "@/lib/supabase";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrders,
});

function AdminOrders() {
  const user = useAuthStore((state) => state.user);

  if (user?.role !== "admin") {
    return <div>Access denied. Admin only.</div>;
  }

  return (
    <>
      <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
        <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
          <OrdersAdmin />
          <OrdersTable />
        </div>
      </main>
    </>
  );
}
