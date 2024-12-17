import { useState } from "react";

import { fetchActiveProducts } from "@/hooks/useProducts";
import { fetchCategories } from "@/hooks/useCategories";
import { Product } from "../../types";
import { Input } from "./ui/input";
import { Card, CardTitle, CardHeader } from "./ui/card";
import { CategoryBadges } from "./CategoryBadges";
import { useInsertProductionItems } from "@/hooks/useProductions";

interface AddProductionProductProps {
  productionId: number;
  onUpdate: () => Promise<void>;
}

export function AddProductionProduct({
  productionId,
  onUpdate,
}: AddProductionProductProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
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
        <CategoryBadges
          categories={categories || []}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2 p-2">
          {(filteredProducts ?? []).length === 0 ? (
            <div>No products found</div>
          ) : (
            (filteredProducts ?? []).map((product) => (
              <Card
                key={product.id}
                onClick={() => handleAddProduct(product)}
                className="text-center h-32 flex flex-col cursor-pointer"
              >
                <div className="flex-1">
                  <CardHeader className="h-full px-1">
                    <CardTitle className="text-sm line-clamp-2 mx-1 hover:line-clamp-3">
                      {product.name}
                    </CardTitle>
                  </CardHeader>
                </div>
                <div className="flex-1 flex flex-col justify-between"></div>
              </Card>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}
