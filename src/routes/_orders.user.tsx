import { useAuth } from "@/providers/AuthProvider";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_orders/user")({
  component: UserIndex,
});

function UserIndex() {
  const { session } = useAuth();

  if (!session) {
    throw redirect({ to: "/" });
  }
  return (
    <div className="p-2">
      <h3>User index</h3>
    </div>
  );
}
