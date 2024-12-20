import { useAuthStore } from "@/lib/supabase";
import { createFileRoute } from "@tanstack/react-router";
import { CreateProductForm } from "@/components/CreateProductForm";
export const Route = createFileRoute("/admin/create")({
  component: ProductCreate,
});

function ProductCreate() {
  const user = useAuthStore((state) => state.user);

  if (user?.role !== "admin") {
    return <div>Access denied. Admin only.</div>;
  }

  return (
    <div>
      <CreateProductForm />
    </div>
  );
}
