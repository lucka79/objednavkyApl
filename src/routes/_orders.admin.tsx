import { useAuth } from "@/providers/AuthProvider";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_orders/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    throw redirect({ to: "/" });
  }

  return (
    <section className="grid gap-2 p-2">
      <p>Hi {}!</p>
      <p>You are currently on the dashboard route.</p>
      <Outlet />
    </section>
  );
}
