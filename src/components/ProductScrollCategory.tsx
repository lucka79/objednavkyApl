import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Badge } from "./ui/badge";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";
import { useState } from "react";
import { Category, Product } from "types";
import { fetchAllProducts } from "@/hooks/useProducts";
import { fetchCategories } from "@/hooks/useCategories";

// Category badges component
const CategoryBadges = ({
  categories,
  selectedCategory,
  onSelectCategory,
}: {
  categories: Category[];
  selectedCategory: number | null;
  onSelectCategory: (id: number | null) => void;
}) => (
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

// Product grid component
const ProductGrid = ({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
    {products.map((product) => (
      <Card key={product.id} className="h-48">
        <CardHeader className="h-full max-h-16">
          <CardTitle className="flex justify-between">
            <span>{product.name}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="h-full max-h-16">
          <p className="text-sm text-gray-600 line-clamp-2 hover:line-clamp-3">
            {product.description}
          </p>
        </CardContent>
        <CardFooter className="flex justify-between h-fullmax-h-16">
          <Badge variant="outline">
            {categories.find((c) => c.id === product.category_id)?.name}
          </Badge>
          <span className="text-lg font-bold">
            {product.price.toFixed(2)} Kč
          </span>
        </CardFooter>
      </Card>
    ))}
  </div>
);

// Main component
export default function ProductScrollCategory() {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const { data: categories, isLoading: categoriesLoading } = fetchCategories();
  const { data: products, isLoading } = fetchAllProducts();

  if (categoriesLoading || isLoading) {
    return (
      <div className="flex flex-col space-y-4 p-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!categories || !products) {
    return <div className="text-center text-red-500">Error loading data</div>;
  }

  const filteredProducts = selectedCategory
    ? products.filter((product) => product.category_id === selectedCategory)
    : products;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Katalog výrobků</h1>
      <CategoryBadges
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />
      <ProductGrid products={filteredProducts} categories={categories} />
    </div>
  );
}
