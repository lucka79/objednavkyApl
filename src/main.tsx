import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import QueryProvider from "./providers/QueryProvider";
import { Toaster } from "./components/ui/toaster";
import { useAuthStore } from "./lib/supabase";

// Initialize auth when app starts
useAuthStore.getState().initializeAuth();

// Create a new router instance
const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  context: {
    auth: undefined!,
  },
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Render the app
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <QueryProvider>
        <RouterProvider router={router} />

        <Toaster />
      </QueryProvider>
    </StrictMode>
  );
}
