// ProductList.tsx
import React, { useState } from "react";
import { fetchActiveProducts } from "@/hooks/useProducts";
import { useCartStore } from "@/providers/cartStore";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Skeleton } from "./ui/skeleton";
import { fetchCategories } from "@/hooks/useCategories";

import { useUpdateOrderItems } from "@/hooks/useOrders";
import { useOrderStore } from "@/providers/orderStore";

import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CategoryBadgesVertical } from "./CategoryBadgesVertical";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AddProductProps {
  orderId: number;
  onUpdate: () => Promise<void>;
}

export const AddProduct: React.FC<AddProductProps> = ({
  // orderId,
  onUpdate,
}) => {
  const { data: products, isLoading, error } = fetchActiveProducts();
  const { data: categories, isLoading: categoriesLoading } = fetchCategories();

  const addItem = useCartStore((state) => state.addItem);

  const [selectedCategory, setSelectedCategory] = useState<number | null>(8);
  // @ts-ignore
  const { mutate: updateOrderItems } = useUpdateOrderItems();

  const selectedOrderId = useOrderStore((state) => state.selectedOrderId);

  const queryClient = useQueryClient();

  const { toast } = useToast();

  const handleAddProduct = async (product: any, quantity: number = 1) => {
    console.log("Adding product:", product);
    console.log("Selected Order ID:", selectedOrderId);

    if (selectedOrderId) {
      try {
        // Check if item already exists
        const { data: existingItem } = await supabase
          .from("order_items")
          .select()
          .eq("order_id", selectedOrderId)
          .eq("product_id", product.id)
          .single();

        if (existingItem) {
          toast({
            title: "Item already exists",
            description: "This item is already in your order.",
            variant: "destructive",
          });
          return;
        }

        // Get the order's user role
        const { data: orderData } = await supabase
          .from("orders")
          .select(
            `
            users:user_id (
              role
            )
          `
          )
          .eq("id", selectedOrderId)
          .single();

        // Determine price based on order user's role
        const price =
          // @ts-ignore
          orderData?.users?.role === "mobil"
            ? product.priceMobil
            : // @ts-ignore
              orderData?.users?.role === "store" ||
                // @ts-ignore
                orderData?.users?.role === "buyer"
              ? product.priceBuyer
              : product.price;

        // Insert new item with correct price and quantity
        const { data: newItem, error } = await supabase
          .from("order_items")
          .insert({
            order_id: selectedOrderId,
            product_id: product.id,
            quantity: quantity,
            price: price,
            checked: false,
          })
          .select()
          .single();

        console.log("New item added:", newItem);

        if (error) {
          console.error("Error adding item:", error);
          throw error;
        }

        // Show success toast
        toast({
          title: "Výrobek přidán",
          description: `Přidáno ${quantity}x ${product.name}`,
        });

        // Invalidate queries to refresh the data
        await queryClient.invalidateQueries({ queryKey: ["orders"] });
        await queryClient.invalidateQueries({
          queryKey: ["order", selectedOrderId],
        });
        await queryClient.invalidateQueries({
          queryKey: ["orderItems", selectedOrderId],
        });
        await onUpdate();
      } catch (error) {
        console.error("Failed to add product:", error);
        toast({
          title: "Chyba",
          description: "Nepodařilo se přidat výrobek do objednávky",
          variant: "destructive",
        });
      }
    } else {
      addItem(product, quantity);
      toast({
        title: "Výrobek přidán",
        description: `Přidáno ${quantity}x ${product.name}`,
      });
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
    <Card className="p-4 print:hidden cursor-pointer">
      <div className="flex gap-4">
        <div className="w-36">
          <CategoryBadgesVertical
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </div>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
          {filteredProducts.length === 0 ? (
            <div>No products found</div>
          ) : (
            filteredProducts.map((product: any) => (
              <Card
                key={product.id}
                className="text-center h-38 flex flex-col justify-between relative"
              >
                <CardHeader className="px-1">
                  <CardTitle className="text-sm mx-1">{product.name}</CardTitle>
                </CardHeader>
                <div className="bg-white/80 backdrop-blur-sm">
                  <CardContent className="pb-0 text-sm font-semibold">
                    {product.priceBuyer.toFixed(2)} Kč
                  </CardContent>
                  <CardContent className="pb-0 text-sm italic">
                    {product.priceMobil.toFixed(2)} Kč
                  </CardContent>
                  <CardContent className="flex justify-end items-center gap-2 pb-2">
                    <Input
                      type="number"
                      min="1"
                      defaultValue={1}
                      className="w-16 h-8 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        (e.target as HTMLInputElement).select();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const input = e.target as HTMLInputElement;
                          const quantity = Number(input.value || 1);
                          if (quantity > 0) {
                            handleAddProduct(product, quantity);
                            input.value = "1";
                          }
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        const input = e.currentTarget
                          .previousElementSibling as HTMLInputElement;
                        const quantity = Number(input?.value || 1);
                        if (quantity > 0) {
                          handleAddProduct(product, quantity);
                          input.value = "1";
                        }
                      }}
                    >
                      Add
                    </Button>
                  </CardContent>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </Card>
  );
};
