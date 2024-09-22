//import * as React from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
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

  // if (!isAdmin) {
  //   return <Redirect href={"/(user)"} />; // (user)
  // }
  if (!isAdmin) {
    throw redirect({ to: "/user" });
    // return <Link to="/user" ></Link>
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
