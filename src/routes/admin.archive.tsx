import { createFileRoute } from "@tanstack/react-router";

import { useAuthStore } from "@/lib/supabase";
import { ArchiveOrdersTable } from "@/components/ArchiveOrdersTable";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OrderDetailsDialog } from "@/components/OrderDetailsDialog";

export const Route = createFileRoute("/admin/archive")({
  component: ArchiveDashboard,
});

function ArchiveDashboard() {
  const user = useAuthStore((state) => state.user);
  // const [selectedProductId] = useState<string | null>(null);

  if (user?.role !== "admin") {
    return <div>Access denied. Admin only.</div>;
  }

  return (
    <TooltipProvider>
      <div className="h-full w-full flex">
        <main className="flex-1 grid h-full w-full items-start gap-4 p-2 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
          <div className="grid h-full auto-rows-max items-start gap-2 md:gap-8 lg:col-span-4">
            <div className="h-full overflow-y-auto overflow-x-hidden">
              <ArchiveOrdersTable />
            </div>
            <div className="h-full overflow-y-auto overflow-x-hidden">
              <OrderDetailsDialog />
            </div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
