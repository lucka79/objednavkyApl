import { useState } from "react";

import { fetchActiveProducts } from "@/hooks/useProducts";
import { fetchCategories } from "@/hooks/useCategories";
import { Product } from "../../types";
import { Input } from "./ui/input";
import { Card, CardTitle, CardHeader, CardContent } from "./ui/card";
import { useInsertProductionItems } from "@/hooks/useProductions";
import { CategoryBadgesVertical } from "./CategoryBadgesVertical";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface AddProductionProductProps {
  productionId: number;
  onUpdate: () => Promise<void>;
}

export function AddProductionProduct({
  productionId,
  onUpdate,
}: AddProductionProductProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(8);
  const { toast } = useToast();
  const { data: products } = fetchActiveProducts();
  const { data: categories } = fetchCategories();
  const { mutateAsync: insertProductionItems } = useInsertProductionItems();

  const filteredProducts = products?.filter((product: Product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory
      ? product.category_id === selectedCategory
      : true;
    return matchesSearch && matchesCategory;
  });

  const handleAddProduct = async (product: Product) => {
    try {
      // Check if item already exists
      const { data: existingItem } = await supabase
        .from("production_items")
        .select()
        .eq("production_id", productionId)
        .eq("product_id", product.id)
        .single();

      if (existingItem) {
        toast({
          variant: "destructive",
          title: "Výrobek je již ve výrobě",
          description: "Výrobek je již ve výrobě",
        });
        return;
      }

      await insertProductionItems([
        {
          production_id: productionId,
          product_id: product.id,
          quantity: 0,
          price: product.price,
        },
      ]);
      await onUpdate();
    } catch (error) {
      console.error("Failed to add product:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add product to production.",
      });
    }
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <Input
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="flex gap-4">
          <div className="w-36">
            <CategoryBadgesVertical
              categories={categories || []}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-2 p-2">
            {(filteredProducts ?? []).length === 0 ? (
              <div>No products found</div>
            ) : (
              (filteredProducts ?? []).map((product) => (
                <Card
                  key={product.id}
                  onClick={() => handleAddProduct(product)}
                  className="text-center h-28 flex flex-col justify-between relative"
                >
                  <CardHeader className="px-1">
                    <CardTitle className="text-sm mx-1 hover:line-clamp-none line-clamp-2 hover:absolute hover:z-10 hover:bg-white hover:w-full hover:left-0">
                      {product.name}
                    </CardTitle>
                  </CardHeader>
                  <div className="bg-white/80 backdrop-blur-sm">
                    <CardContent className="pb-2 text-sm font-semibold">
                      {product.price.toFixed(2)} Kč
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
}
