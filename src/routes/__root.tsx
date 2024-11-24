//import * as React from "react";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import "@/styles/app.css";
// import { TanStackRouterDevtools } from "@tanstack/router-devtools";
// import { Separator } from "@/components/ui/separator";
// import { useAuth } from "@/providers/AuthProvider";
// import { Button } from "@/components/ui/button";
// import { supabase } from "@/lib/supabase";
import { Navbar } from "@/components/Navbar";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );

  // const { session } = useAuth();

  // if (!session) {
  //   return (
  //     <>
  //       <div className="flex h-5 m-4 items-center space-x-4 text-lg justify-end md:pe-40 xl:pe-58">
  //         <div>
  //           <Link
  //             to="/"
  //             activeProps={{
  //               className: "font-semibold",
  //             }}
  //             activeOptions={{ exact: true }}
  //           >
  //             Home
  //           </Link>{" "}
  //         </div>
  //         <Separator orientation="vertical" />
  //         <div>
  //           <Link
  //             to={"/about"}
  //             activeProps={{
  //               className: "font-semibold",
  //             }}
  //           >
  //             About
  //           </Link>
  //         </div>
  //         <Separator orientation="vertical" />
  //         <div>
  //           <Link
  //             to={"/login"}
  //             activeProps={{
  //               className: "font-semibold",
  //             }}
  //           >
  //             Login
  //           </Link>
  //         </div>
  //       </div>
  //       {/* <Separator /> */}
  //       <hr className="shadow" />

  //       <Outlet />
  //       <TanStackRouterDevtools position="bottom-right" />
  //     </>
  //   );
  // }

  // if (session.user.id) {
  //   return (
  //     <>
  //       <div className="flex h-5 m-4 items-center space-x-4 text-lg justify-end md:pe-40 xl:pe-58">
  //         <div>
  //           <Link
  //             to="/orders/user"
  //             activeProps={{
  //               className: "font-semibold",
  //             }}
  //             activeOptions={{ exact: true }}
  //           >
  //             Výrobky
  //           </Link>
  //         </div>
  //         <Separator orientation="vertical" />
  //         <div>
  //           <Link
  //             to={"/profile"}
  //             activeProps={{
  //               className: "font-semibold",
  //             }}
  //           >
  //             Profile
  //           </Link>
  //         </div>
  //         <div>
  //           <Link
  //             to={"/cart"}
  //             activeProps={{
  //               className: "font-semibold",
  //             }}
  //           >
  //             Košík
  //           </Link>
  //         </div>
  //         <Separator orientation="vertical" />
  //         <div>
  //           <Button onClick={() => supabase.auth.signOut()}>
  //             <Link
  //               to={"/"}
  //               activeProps={{
  //                 className: "font-semibold",
  //               }}
  //             >
  //               Logout
  //             </Link>
  //           </Button>
  //         </div>
  //         <Separator orientation="vertical" />
  //       </div>

  //       {/* <Separator /> */}
  //       <hr className="shadow" />

  //       <Outlet />
  //       <TanStackRouterDevtools position="bottom-right" />
  //     </>
  //   );
  // }
}
