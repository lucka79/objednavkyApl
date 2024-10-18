// ProductList.tsx
import React, { useState } from "react";
import { fetchAllProducts } from "@/hooks/useProducts";
import { useCartStore } from "@/providers/cartStore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { Category } from "types";
import { Skeleton } from "./ui/skeleton";
import { useAuthStore } from "@/lib/supabase";
import { getCategories } from "@/hooks/useCategories";

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

export const ProductCategory: React.FC = () => {
  const { data: products, isLoading, error } = fetchAllProducts();
  const { data: categories, isLoading: categoriesLoading } = getCategories();

  const addItem = useCartStore((state) => state.addItem);
  const user = useAuthStore((state) => state.user);

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  if (!categories || !products) {
    return <div className="text-center text-red-500">Error loading data</div>;
  }

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

  const filteredProducts = selectedCategory
    ? products.filter((product) => product.category_id === selectedCategory)
    : products;

  // Use filteredProducts instead of products when rendering
  return (
    <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
      <div className="container mx-auto p-2">
        <CategoryBadges
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-8 gap-2">
          {filteredProducts?.map((product) => (
            <Card key={product.id}>
              <CardHeader className="pb-2 px-2">
                <CardTitle className="text-sm">{product.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {user?.role === "user" && (
                  <>{product.priceMobil.toFixed(2)} Kč</>
                )}
                {/* <p>{product.description}</p> */}
                <p className="font-semibold text-sm">
                  {user?.role === "admin" && <>${product.price.toFixed(2)}</>}
                </p>
              </CardContent>
              <CardFooter className="pb-2">
                <Button variant="outline" onClick={() => addItem(product)}>
                  <ShoppingCart size={16} />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
