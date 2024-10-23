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
import { FilePenLine, ShoppingCart } from "lucide-react";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { Category } from "types";
import { Skeleton } from "./ui/skeleton";
import { useAuthStore } from "@/lib/supabase";
import { fetchCategories } from "@/hooks/useCategories";
import { useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useProductStore } from "@/providers/productStore";

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
  const { data: categories, isLoading: categoriesLoading } = fetchCategories();
  const setSelectedProductId = useProductStore(
    (state) => state.setSelectedProductId
  );

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
    <Card className="p-4 print:hidden">
      <div className="container mx-auto p-2">
        <CategoryBadges
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2 p-2">
        {filteredProducts?.map((product) => (
          <Card key={product.id} className="text-center h-48">
            <CardHeader className="px-0 h-full max-h-28">
              <CardTitle className="text-sm line-clamp-2 hover:line-clamp-3">
                {product.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-full max-h-10">
              {user?.role === "user" && (
                <span>{product.priceMobil.toFixed(2)} Kč</span>
              )}
              {/* <p>{product.description}</p> */}
              <span className="font-semibold text-sm">
                {user?.role === "admin" && <>${product.price.toFixed(2)}</>}
              </span>
            </CardContent>
            <CardFooter className="h-full max-h-8 justify-center ">
              <Button variant="outline" onClick={() => addItem(product)}>
                <ShoppingCart size={16} />
              </Button>
              {user?.role == "admin" && (
                <Button
                  variant="outline"
                  onClick={() => setSelectedProductId(product.id)}
                >
                  <FilePenLine size={16} />
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </Card>
  );
};
