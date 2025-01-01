import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Badge } from "./ui/badge";

import { useState } from "react";
import { Category, Product } from "types";
import { fetchActiveProducts } from "@/hooks/useProducts";
import { fetchCategories } from "@/hooks/useCategories";
import { Button } from "./ui/button";

// Category badges component
const CategoryBadges = ({
  categories,
  selectedCategory,
  onSelectCategory,
}: {
  categories: Category[];
  selectedCategory: number | null;
  onSelectCategory: (id: number | null) => void;
}) => {
  // Filter categories where buyer is true
  const buyerCategories = categories.filter((category) => category.buyer);

  const itemsPerRow = Math.ceil((buyerCategories.length + 1) / 2); // +1 for "Vše" badge
  const firstRow = [null, ...buyerCategories.slice(0, itemsPerRow - 1)];
  const secondRow = buyerCategories.slice(itemsPerRow - 1);

  return (
    <div className="w-full rounded-md border p-2">
      <div className="flex flex-col gap-2">
        <div className="flex gap-4">
          {firstRow.map((category) => (
            <Button
              key={category?.id ?? "all"}
              variant="outline"
              className={`w-32 hover:border-orange-400 ${
                selectedCategory === (category?.id ?? null)
                  ? "bg-orange-400 text-white"
                  : ""
              }`}
              onClick={() => onSelectCategory(category?.id ?? null)}
            >
              {category?.name ?? "Vše"}
            </Button>
          ))}
        </div>
        <div className="flex gap-4">
          {secondRow.map((category) => (
            <Button
              key={category.id}
              variant="outline"
              className={`w-32 hover:border-orange-400 ${
                selectedCategory === category.id
                  ? "bg-orange-400 text-white"
                  : ""
              }`}
              onClick={() => onSelectCategory(category.id)}
            >
              {category.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

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
  const { data: products, isLoading } = fetchActiveProducts();

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
    ? products
        .filter((product) => product.store)
        .filter((product) => product.category_id === selectedCategory)
    : products.filter((product) => product.store);

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
