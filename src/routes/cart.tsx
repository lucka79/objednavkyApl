// Cart.tsx
import { createFileRoute } from "@tanstack/react-router";
import Cart from "@/components/Cart";
import { PageLayout } from "@/components/PageLayout";
import { useAuthStore } from "@/lib/supabase";
import CartAdmin from "@/components/CartAdmin";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

function CartPage() {
  const user = useAuthStore((state) => state.user);
  if (user?.role === "admin") {
    return <CartAdmin />;
  } else {
    return (
      <PageLayout>
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-6">Košík</h1>
          <CartAdmin />
        </div>
      </PageLayout>
    );
  }
}
