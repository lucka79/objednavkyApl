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

  return <div>Objednávky</div>;
}
