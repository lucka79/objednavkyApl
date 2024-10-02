//import * as React from "react";
import { useAuth } from "@/providers/AuthProvider";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login2")({
  component: LoginComponent,
});

function LoginComponent() {
  const { session, loading, isAdmin } = useAuth();

  if (loading) {
    return <Loader2 />;
  }

  if (!session) {
    throw redirect({ to: "/auth/sign-up" });
  }
  if (session) {
    throw redirect({ to: "/orders/user" });
    // return <Link to="/user" ></Link>
  }
  if (isAdmin) {
    return <Link to="/orders/admin"></Link>;
  }

  // return (
  //   <div style={{ flex: 1, justifyContent: "center", padding: 10 }}>
  //     <Button asChild>
  //       <Link to="/user">User</Link>
  //     </Button>
  //     <Button asChild>
  //       <Link to="/admin">Admin</Link>
  //     </Button>

  //     <Button onClick={() => supabase.auth.signOut()}>Sign out</Button>
  //   </div>
  // );
}
