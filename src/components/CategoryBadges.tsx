import { Badge } from "./ui/badge";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";
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
}: CategoryBadgesProps) => (
  <ScrollArea className="w-full whitespace-nowrap rounded-md border">
    <div className="flex w-max space-x-4 p-4">
      <Badge
        variant={selectedCategory === null ? "default" : "outline"}
        className="cursor-pointer"
        onClick={() => onSelectCategory(null)}
      >
        Vše
      </Badge>
      {categories.map((category) => (
        <Badge
          key={category.id}
          variant={selectedCategory === category.id ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => onSelectCategory(category.id)}
        >
          {category.name}
        </Badge>
      ))}
    </div>
    <ScrollBar orientation="horizontal" />
  </ScrollArea>
);
