import { Button } from "./ui/button";
import { Category } from "types";

interface CategoryBadgesProps {
  categories: Category[];
  selectedCategory: number | null;
  onSelectCategory: (id: number | null) => void;
}

export const CategoryBadges = ({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryBadgesProps) => {
  const storeCategories = categories.filter((category) => category.store);
  const itemsPerRow = 4;
  const row1 = [null, ...storeCategories.slice(0, itemsPerRow - 1)];
  const row2 = storeCategories.slice(itemsPerRow - 1, itemsPerRow * 2 - 1);
  const row3 = storeCategories.slice(itemsPerRow * 2 - 1);

  return (
    <div className="w-full rounded-md border p-2">
      <div className="flex flex-col gap-2">
        {[row1, row2, row3].map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-4">
            {row.map((category) => (
              <Button
                key={category?.id ?? "all"}
                variant="outline"
                className={`w-32 hover:border-orange-400 ${
                  selectedCategory === (category?.id ?? null)
                    ? "bg-orange-400"
                    : ""
                }`}
                onClick={() => onSelectCategory(category?.id ?? null)}
              >
                {category?.name ?? "Vše"}
              </Button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
