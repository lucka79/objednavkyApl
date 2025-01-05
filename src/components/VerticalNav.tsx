import { fetchCategories } from "@/hooks/useCategories";
import { Button } from "./ui/button";

interface VerticalNavProps {
  onCategorySelect: (categoryId: number | null) => void;
  selectedCategory: number | null;
}

export function VerticalNav({
  onCategorySelect,
  selectedCategory,
}: VerticalNavProps) {
  const { data: categories } = fetchCategories();

  return (
    <nav className="space-y-2 w-40">
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-1">
          {categories?.map((category) => (
            <Button
              key={category.id}
              variant="outline"
              className={`cursor-pointer hover:bg-orange-500 hover:text-white transition-colors text-xs w-20 h-10 ${
                selectedCategory === category.id
                  ? "bg-orange-500 text-white"
                  : ""
              }`}
              onClick={() => onCategorySelect(category.id)}
            >
              {category.name}
            </Button>
          ))}
        </div>
      </div>
    </nav>
  );
}
