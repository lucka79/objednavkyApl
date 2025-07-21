import { createFileRoute } from "@tanstack/react-router";
import { RecipesTable } from "@/components/RecipesTable";

export const Route = createFileRoute("/admin/recipes")({
  component: AdminRecipes,
});

function AdminRecipes() {
  return (
    <div className="container mx-auto py-6">
      <RecipesTable />
    </div>
  );
}
