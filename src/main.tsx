import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { SpeedInsights } from "@vercel/speed-insights/next";
// Import the generated route tree
import { routeTree } from "./routeTree.gen";
import QueryProvider from "./providers/QueryProvider";
import { Toaster } from "./components/ui/toaster";

// Create a new router instance
const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  context: {
    auth: undefined!, // This will be set after we wrap the app in an AuthProvider
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
        <SpeedInsights />
        <Toaster />
      </QueryProvider>
    </StrictMode>
  );
}
