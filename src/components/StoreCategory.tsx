// ProductList.tsx
import React, { useState } from "react";
import { fetchStoreProducts } from "@/hooks/useProducts";
import { useReceiptStore } from "@/providers/receiptStore";

import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { Category } from "types";
import { Skeleton } from "./ui/skeleton";
import { useAuthStore } from "@/lib/supabase";
import { fetchCategories } from "@/hooks/useCategories";
import { useStoredItems } from "@/hooks/useStoredItems";
import { fetchAllOrders } from "@/hooks/useOrders";
import { Label } from "./ui/label";

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
export const StoreCategory: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const { data: products, isLoading, error } = fetchStoreProducts();
  const { data: categories, isLoading: categoriesLoading } = fetchCategories();
  const { data: storedItems } = useStoredItems(user?.id ?? "");
  const { data: orders } = fetchAllOrders();

  const addItem = useReceiptStore((state) => state.addItem);

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  // Calculate future quantities for the selected user
  const getFutureQuantity = (productId: number) => {
    if (!orders || !user) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return orders
      .filter((order) => {
        const orderDate = new Date(order.date);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate > today && order.user_id === user.id;
      })
      .reduce((sum, order) => {
        const orderItem = order.order_items.find(
          (item: { product_id: number }) => item.product_id === productId
        );
        return sum + (orderItem?.quantity || 0);
      }, 0);
  };

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
        {filteredProducts?.map((product) => {
          const storedQuantity =
            storedItems?.find((item) => item.product_id === product.id)
              ?.quantity || 0;
          const futureQuantity = getFutureQuantity(product.id);

          return (
            <Card
              key={product.id}
              onClick={() => addItem(product)}
              className="text-center h-36 flex flex-col hover:cursor-pointer hover:bg-accent relative"
            >
              <div className="flex-1">
                <CardHeader className="h-full px-1">
                  <CardTitle className="text-sm line-clamp-2 mx-1 hover:line-clamp-3">
                    {product.name}
                    <div className="flex gap-1 justify-end">
                      <Badge variant="outline" className="ml-1">
                        {storedQuantity - futureQuantity}
                      </Badge>
                      {futureQuantity > 0 && (
                        <Badge variant="secondary" className="ml-1">
                          +{futureQuantity}
                        </Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
              </div>

              {/* Second half - Prices and Button */}
              <div className="flex-1 flex flex-col justify-between">
                {/* Empty div to push the footer to the bottom */}
                <div className="flex-grow"></div>
                {/* <CardContent className="pb-0 text-xs font-semibold"></CardContent> */}
                <CardFooter className="flex justify-center absolute bottom-1">
                  <Label>
                    {user?.role === "store" && (
                      <span>{product.price.toFixed(2)} Kč</span>
                    )}
                  </Label>
                </CardFooter>
              </div>
            </Card>
          );
        })}
      </div>
    </Card>
  );
};
