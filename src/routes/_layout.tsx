//import * as React from "react";
import { Navbar } from "@/components/Navbar";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout")({
  component: Layout,
});

function Layout() {
  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
