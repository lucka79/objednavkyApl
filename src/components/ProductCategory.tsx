// ProductList.tsx
import React, { useState } from "react";
import { fetchActiveProducts } from "@/hooks/useProducts";
import { useCartStore } from "@/providers/cartStore";

import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "./ui/badge";
import { Category } from "types";
import { Skeleton } from "./ui/skeleton";
import { useAuthStore } from "@/lib/supabase";
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

  const halfLength = Math.ceil((buyerCategories.length + 1) / 2); // +1 for "Vše" badge
  const firstRow = [null, ...buyerCategories.slice(0, halfLength - 1)];
  const secondRow = buyerCategories.slice(halfLength - 1);

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
              key={category?.id}
              variant="outline"
              className={`w-32 hover:border-orange-400 ${
                selectedCategory === category?.id
                  ? "bg-orange-400 text-white"
                  : ""
              }`}
              onClick={() => onSelectCategory(category?.id)}
            >
              {category?.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

interface Product {
  id: number;
  name: string;
  category_id: number;
  priceBuyer: number;
  priceMobil: number;
}

export const ProductCategory: React.FC = () => {
  const { data: products, isLoading, error } = fetchActiveProducts();
  const { data: categories, isLoading: categoriesLoading } = fetchCategories();

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
    ? products.filter(
        (product: Product) => product.category_id === selectedCategory
      )
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
        {filteredProducts?.map((product: Product) => (
          <Card
            key={product.id}
            onClick={() => addItem(product as any)}
            className="text-center h-36 flex flex-col cursor-pointer"
          >
            {/* First half - Product Name */}
            <div className="flex-1">
              <CardHeader className="h-full px-1">
                <CardTitle className="text-sm line-clamp-2 mx-1 hover:line-clamp-3">
                  {product.name}
                </CardTitle>
              </CardHeader>
            </div>

            {/* Second half - Prices and Button */}
            <div className="flex-1 flex flex-col justify-between">
              {/* Empty div to push the footer to the bottom */}
              <div className="flex-grow"></div>
              {/* <CardContent className="pb-0 text-xs font-semibold"></CardContent> */}
              <CardFooter className="flex justify-end pb-2">
                <Badge variant="outline" className="text-xs">
                  {user?.role === "admin" && (
                    <div className="flex flex-col gap-1 text-sm">
                      <span>{product.priceBuyer.toFixed(2)} Kč</span>
                      <span className="italic font-semibold">
                        {product.priceMobil.toFixed(2)} Kč
                      </span>
                    </div>
                  )}
                </Badge>
              </CardFooter>
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
};
