// import { CreateProductForm } from "@/components/CreateProduct";
import { ProductForm } from "@/components/ProductForm";
import { useAuthStore } from "@/lib/supabase";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/products/create")({
  component: ProductCreate,
});
function ProductCreate() {
  const user = useAuthStore((state) => state.user);

  if (user?.role !== "admin") {
    return <div>Access denied. Admin only.</div>;
  }

  return (
    <div>
      {/* <CreateProductForm /> */}
      <ProductForm />
    </div>
  );
}
