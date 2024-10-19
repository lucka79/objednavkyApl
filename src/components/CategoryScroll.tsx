import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { fetchCategories } from "@/hooks/useCategories";

export function CategoryScroll({
  onSelectCategory,
}: {
  onSelectCategory: (categoryId: string) => void;
}) {
  const { data: categories, isLoading, error } = fetchCategories();

  if (isLoading) return <div>Loading categories...</div>;
  if (error) return <div>Error loading categories</div>;
  if (!categories) return null;

  return (
    <ScrollArea className="w-full whitespace-nowrap rounded-md border">
      <div className="flex w-max space-x-4 p-4">
        {categories.map((category) => (
          <Button
            key={category.id}
            variant="outline"
            className="flex-shrink-0"
            onClick={() => onSelectCategory(category.id)}
          >
            {category.name}
          </Button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
