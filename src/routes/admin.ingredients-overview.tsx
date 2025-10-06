import { createFileRoute } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/supabase";
import { IngredientQuantityOverview } from "@/components/IngredientQuantityOverview";
import { InvoiceUploadDialog } from "@/components/InvoiceUploadDialog";
import { DocumentAIDebug } from "@/components/DocumentAIDebug";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IngredientComparison } from "@/components/IngredientComparison";
import { ReceivedInvoices } from "@/components/ReceivedInvoices";

export const Route = createFileRoute("/admin/ingredients-overview")({
  component: AdminIngredientsOverview,
});

function AdminIngredientsOverview() {
  const user = useAuthStore((state) => state.user);

  if (user?.role !== "admin") {
    return <div>Access denied. Admin only.</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Přehled zásob a faktury</h1>
          <p className="text-muted-foreground">
            Správa zásob surovin a nahrávání faktur od dodavatelů
          </p>
        </div>
        <InvoiceUploadDialog />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Přehled zásob</TabsTrigger>
          <TabsTrigger value="supplier-codes">
            Srovnávač cen surovin
          </TabsTrigger>
          <TabsTrigger value="invoices">Faktury</TabsTrigger>
          <TabsTrigger value="debug">Debug Parser</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <IngredientQuantityOverview />
        </TabsContent>

        <TabsContent value="supplier-codes" className="mt-6">
          <IngredientComparison />
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          <ReceivedInvoices />
        </TabsContent>

        <TabsContent value="debug" className="mt-6">
          <DocumentAIDebug />
        </TabsContent>
      </Tabs>
    </div>
  );
}
