import { useAuthStore } from "@/lib/supabase";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/crossroad")({
  component: Crossroad,
});

export default function Crossroad() {
  const { user, isLoading, fetchProfile } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate({ to: "/login" });
      } else {
        // Assuming the user object has a 'role' field
        switch (user.role) {
          case "admin":
            navigate({ to: "/admin" });
            break;
          case "user":
          default:
            navigate({ to: "/profile" });
            break;
        }
      }
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return null;
}
