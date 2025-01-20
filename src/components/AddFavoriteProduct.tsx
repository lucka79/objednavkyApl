import React, { useState } from "react";
import { fetchActiveProducts } from "@/hooks/useProducts";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { fetchCategories } from "@/hooks/useCategories";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CategoryBadgesVertical } from "./CategoryBadgesVertical";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddFavoriteProductProps {
  favoriteOrderId: number;
  onUpdate: () => Promise<void>;
}

export const AddFavoriteProduct: React.FC<AddFavoriteProductProps> = ({
  favoriteOrderId,
  onUpdate,
}) => {
  const { data: products = [], isLoading, error } = fetchActiveProducts();
  const { data: categories = [] } = fetchCategories();

  const [selectedCategory, setSelectedCategory] = useState<number | null>(8);
  const [showMobilOnly, setShowMobilOnly] = useState<"all" | "mobil">("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleAddProduct = async (product: any) => {
    try {
      const { data: existingItem } = await supabase
        .from("favorite_items")
        .select()
        .eq("order_id", favoriteOrderId)
        .eq("product_id", product.id)
        .single();

      if (existingItem) {
        toast({
          title: "Product already exists",
          description: "This product is already in your favorite list",
          variant: "destructive",
        });
        return;
      }

      console.log("Adding product with buyer price:", {
        productName: product.name,
        priceBuyer: product.priceBuyer,
        role: "buyer",
      });

      const { error } = await supabase
        .from("favorite_items")
        .insert({
          order_id: favoriteOrderId,
          product_id: product.id,
          quantity: 0,
        })
        .select()
        .single();

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["favoriteOrders"] });
      await onUpdate();
    } catch (error) {
      console.error("Failed to add favorite product:", error);
      toast({
        title: "Error",
        description: "Failed to add product",
        variant: "destructive",
      });
    }
  };

  const filteredProducts =
    products?.filter((product: any) => {
      const categoryMatch = selectedCategory
        ? product.category_id === selectedCategory
        : true;
      const mobilMatch =
        showMobilOnly === "mobil" ? product.priceMobil > 0 : true;
      return categoryMatch && mobilMatch;
    }) ?? [];

  if (isLoading) return <div>Loading products...</div>;
  if (error) return <div>Error loading products</div>;

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
        <div className="flex-1">
          <div className="mb-4">
            <Select
              value={showMobilOnly}
              onValueChange={(value: "all" | "mobil") =>
                setShowMobilOnly(value)
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by price" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="mobil">Mobil Price Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
            {filteredProducts.length === 0 ? (
              <div>No products found</div>
            ) : (
              filteredProducts.map((product: any) => (
                <Card
                  key={product.id}
                  onClick={() => handleAddProduct(product)}
                  className="text-center h-32 flex flex-col justify-between relative"
                >
                  <CardHeader className="px-1">
                    <CardTitle className="text-sm mx-1 hover:line-clamp-none line-clamp-2 hover:absolute hover:z-10 hover:bg-white hover:w-full hover:left-0">
                      {product.name}
                    </CardTitle>
                  </CardHeader>
                  <div className="bg-white/80 backdrop-blur-sm">
                    <CardContent className="pb-0 text-sm font-semibold">
                      {product.priceBuyer.toFixed(2)} Kč
                    </CardContent>
                    <CardContent className="pb-0 text-sm italic">
                      {product.priceMobil.toFixed(2)} Kč
                    </CardContent>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
