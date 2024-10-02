//import * as React from "react";
import { useAuth } from "@/providers/AuthProvider";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cart")({
  component: Cart,
});

function Cart() {
  const { session } = useAuth();

  if (!session) {
    throw redirect({ to: "/" });
  }
  return (
    <div className="p-2">
      <h3>Košík</h3>
    </div>
  );
}
