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
import { fetchCategories } from "@/hooks/useCategories";

import { useUpdateOrderItems } from "@/hooks/useOrders";
import { useOrderStore } from "@/providers/orderStore";
import { useOrderItemsStore } from "@/providers/orderItemsStore";

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

export const AddProduct: React.FC = () => {
  const { data: products, isLoading, error } = fetchAllProducts();
  const { data: categories, isLoading: categoriesLoading } = fetchCategories();

  const addItem = useCartStore((state) => state.addItem);
  const user = useAuthStore((state) => state.user);

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const { mutate: updateOrderItems } = useUpdateOrderItems();

  const selectedOrderId = useOrderStore((state) => state.selectedOrderId);
  const addOrderItem = useOrderItemsStore((state) => state.addOrderItem);

  const handleAddProduct = async (product: any) => {
    if (selectedOrderId) {
      console.log("Adding product to existing order:", {
        orderId: selectedOrderId,
        product: product,
      });

      // Check if product already exists in order
      const existingItem = useOrderItemsStore
        .getState()
        .orderItems.find((item) => item.product_id === product.id);

      if (existingItem) {
        // Update existing item quantity
        await updateOrderItems({
          id: existingItem.id,
          updatedFields: {
            quantity: existingItem.quantity + 1,
          },
        });
      } else {
        // Add new item
        await updateOrderItems({
          id: 0,
          updatedFields: {
            order_id: selectedOrderId,
            product_id: product.id,
            quantity: 1,
            price: product.price,
            checked: false,
          },
        });
      }

      // Update local state after database operation
      addOrderItem(product);

      console.log(
        "Updated order items:",
        useOrderItemsStore.getState().orderItems
      );
    } else {
      addItem(product);
    }
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
        {filteredProducts?.map((product) => (
          <Card key={product.id} className="text-center h-48 flex flex-col">
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
              <CardContent className="pb-0">
                {user?.role === "user" && (
                  <span>{product.price.toFixed(2)} Kč</span>
                )}
                {user?.role === "admin" && (
                  <div className="flex flex-col gap-1 text-sm">
                    <span>{product.price.toFixed(2)} Kč</span>
                    <span className="italic font-semibold">
                      {product.priceMobil.toFixed(2)} Kč
                    </span>
                  </div>
                )}
              </CardContent>
              <CardFooter className="justify-center pt-0">
                <Button
                  variant="outline"
                  onClick={() => handleAddProduct(product)}
                >
                  <ShoppingCart size={16} />
                </Button>
              </CardFooter>
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
};