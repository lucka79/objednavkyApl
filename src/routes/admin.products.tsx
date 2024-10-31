import { createFileRoute } from "@tanstack/react-router";

import { useAuthStore } from "@/lib/supabase";
import { ProductDetailsCard } from "@/components/ProductDetailsCard";

import { ProductsTable } from "@/components/ProductsTable";
import { ProductCategory } from "@/components/ProductCategory";
import ProductCategoryList from "@/components/ProductCategoryList";

export const Route = createFileRoute("/admin/products")({
  component: AdminProducts,
});

function AdminProducts() {
  const user = useAuthStore((state) => state.user);

  if (user?.role !== "admin") {
    return <div>Access denied. Admin only.</div>;
  }

  return (
    <>
      <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
        <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
          <ProductsTable />
          {/* <ProductCategory /> */}

          <ProductCategoryList />
        </div>
        <div>
          <ProductDetailsCard />
        </div>
      </main>
    </>
  );
}