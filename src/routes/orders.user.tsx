import ProductCatalog2 from "@/components/ProductScrollCategory";
import { useAuth } from "@/providers/AuthProvider";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/orders/user")({
  component: UserIndex,
});

function UserIndex() {
  const { session } = useAuth();

  if (!session) {
    throw redirect({ to: "/" });
  }
  return (
    <div className="p-2">
      <ProductCatalog2 />
    </div>
  );
}
