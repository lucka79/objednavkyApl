import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/supabase";

export default function RedirectPage() {
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
