import React, { useState } from "react";
import { fetchAllProducts } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";
import { useAuthStore } from "@/lib/supabase";
import { fetchCategories } from "@/hooks/useCategories";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CategoryBadges } from "./CategoryBadges";

interface AddFavoriteProductProps {
  favoriteOrderId: number;
  onUpdate: () => Promise<void>;
}

export const AddFavoriteProduct: React.FC<AddFavoriteProductProps> = ({
  favoriteOrderId,
  onUpdate,
}) => {
  const { data: products = [], isLoading, error } = fetchAllProducts();
  const { data: categories = [] } = fetchCategories();
  const user = useAuthStore((state) => state.user);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const handleAddProduct = async (product: any) => {
    try {
      const { data: newItem, error } = await supabase
        .from("favorite_items")
        .insert({
          order_id: favoriteOrderId,
          product_id: product.id,
          quantity: 1,
          //   price: product.price,
        })
        .select()
        .single();

      if (error) {
        console.error("Error adding favorite item:", error);
        throw error;
      }

      // Invalidate queries to refresh the data
      await queryClient.invalidateQueries({ queryKey: ["favoriteOrders"] });
      await queryClient.invalidateQueries({
        queryKey: ["favoriteOrder", favoriteOrderId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["favoriteItems", favoriteOrderId],
      });
      await onUpdate();
    } catch (error) {
      console.error("Failed to add favorite product:", error);
    }
  };

  const filteredProducts =
    products?.filter((product) =>
      selectedCategory ? product.category_id === selectedCategory : true
    ) ?? [];

  if (isLoading) return <div>Loading products...</div>;
  if (error) return <div>Error loading products</div>;

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
        {filteredProducts.length === 0 ? (
          <div>No products found</div>
        ) : (
          filteredProducts.map((product) => (
            <Card key={product.id} className="text-center h-48 flex flex-col">
              <div className="flex-1">
                <CardHeader className="h-full px-1">
                  <CardTitle className="text-sm line-clamp-2 mx-1 hover:line-clamp-3">
                    {product.name}
                  </CardTitle>
                </CardHeader>
              </div>
              <div className="flex-1 flex flex-col justify-between">
                <CardContent className="pb-0">
                  {user?.role === "admin" && (
                    <Button
                      variant="outline"
                      onClick={() => handleAddProduct(product)}
                    >
                      <ShoppingCart size={16} />
                    </Button>
                  )}
                </CardContent>
              </div>
            </Card>
          ))
        )}
      </div>
    </Card>
  );
};
