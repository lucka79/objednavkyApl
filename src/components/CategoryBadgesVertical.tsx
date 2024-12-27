import { Button } from "./ui/button";
import { Category } from "types";

interface CategoryBadgesProps {
  categories: Category[];
  selectedCategory: number | null;
  onSelectCategory: (id: number | null) => void;
}

export const CategoryBadgesVertical = ({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryBadgesProps) => {
  const storeCategories = categories.filter((category) => category.buyer);

  return (
    <div className="w-full rounded-md border p-2">
      <div className="flex flex-col gap-2">
        <Button
          key="all"
          variant="outline"
          className={`w-full hover:border-orange-400 ${
            selectedCategory === null ? "bg-orange-400" : ""
          }`}
          onClick={() => onSelectCategory(null)}
        >
          Vše
        </Button>
        {storeCategories.map((category) => (
          <Button
            key={category.id}
            variant="outline"
            className={`w-full hover:border-orange-400 ${
              selectedCategory === category.id ? "bg-orange-400" : ""
            }`}
            onClick={() => onSelectCategory(category.id)}
          >
            {category.name}
          </Button>
        ))}
      </div>
    </div>
  );
};
