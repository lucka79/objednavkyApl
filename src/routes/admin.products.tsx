import { createFileRoute } from "@tanstack/react-router";

import { useAuthStore } from "@/lib/supabase";

import { ProductCategory } from "@/components/ProductCategory";

import CartAdmin from "@/components/CartAdmin";

export const Route = createFileRoute("/admin/products")({
  component: AdminProducts,
});

function AdminProducts() {
  const user = useAuthStore((state) => state.user);

  if (user?.role !== "admin") {
    return <div>Access denied. Admin only.</div>;
  }

  return (
    <div className="h-full w-full flex">
      <style>{`
        /* Hide number input spinners (Chrome, Edge, Safari) */
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        /* Hide number input spinners (Firefox) */
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
      <main className="h-full w-full flex flex-col md:flex-row gap-2 p-2 sm:px-6 md:px-[20px] lg:px-[40px] sm:py-0">
        <div className="flex-1 md:w-1/2 lg:flex-1 h-full overflow-y-auto overflow-x-hidden">
          <ProductCategory />
        </div>
        <div className="order-first md:order-last md:w-1/2 lg:w-[33%] h-full w-full overflow-y-auto overflow-x-hidden">
          <CartAdmin />
        </div>
      </main>
    </div>
  );
}
