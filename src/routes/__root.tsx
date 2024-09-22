//import * as React from "react";
import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import "@/styles/app.css";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const { session, isAdmin, profile } = useAuth();

  if (!session) {
    return (
      <>
        <div className="flex h-5 m-4 items-center space-x-4 text-lg justify-end md:pe-40 xl:pe-58">
          <div>
            <Link
              to="/"
              activeProps={{
                className: "font-semibold",
              }}
              activeOptions={{ exact: true }}
            >
              Home
            </Link>{" "}
          </div>
          <Separator orientation="vertical" />
          <div>
            <Link
              to={"/about"}
              activeProps={{
                className: "font-semibold",
              }}
            >
              About
            </Link>
          </div>
          <Separator orientation="vertical" />
          <div>
            <Link
              to={"/auth/sign-in"}
              activeProps={{
                className: "font-semibold",
              }}
            >
              Login
            </Link>
          </div>
        </div>

        {/* <Separator /> */}
        <hr className="shadow" />

        <Outlet />
        <TanStackRouterDevtools position="bottom-right" />
      </>
    );
  }

  if (session.user.id) {
    return (
      <>
        <div className="flex h-5 m-4 items-center space-x-4 text-lg justify-end md:pe-40 xl:pe-58">
          <div>
            <Link
              to="/user"
              activeProps={{
                className: "font-semibold",
              }}
              activeOptions={{ exact: true }}
            >
              Výrobky
            </Link>{" "}
          </div>
          <Separator orientation="vertical" />
          <div>
            <Link
              to={"/about"}
              activeProps={{
                className: "font-semibold",
              }}
            >
              Profile
            </Link>
          </div>
          <Separator orientation="vertical" />
          <div>
            <Button onClick={() => supabase.auth.signOut()}>
              <Link
                to={"/"}
                activeProps={{
                  className: "font-semibold",
                }}
              >
                Logout
              </Link>
            </Button>
          </div>
        </div>

        {/* <Separator /> */}
        <hr className="shadow" />

        <Outlet />
        <TanStackRouterDevtools position="bottom-right" />
      </>
    );
  }
}
