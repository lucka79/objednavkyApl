import { createFileRoute } from "@tanstack/react-router";
import { IngredientsTable } from "@/components/IngredientsTable";

export const Route = createFileRoute("/admin/ingredients")({
  component: AdminIngredients,
});

function AdminIngredients() {
  return (
    <div className="container mx-auto py-6">
      <IngredientsTable />
    </div>
  );
}
