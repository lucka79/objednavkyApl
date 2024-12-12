import { useState } from "react";
import { useInsertReturnItems } from "@/hooks/useReturns";
import { fetchActiveProducts } from "@/hooks/useProducts";
import { fetchCategories } from "@/hooks/useCategories";
import { Product } from "../../types";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { CategoryBadges } from "./CategoryBadges";

interface AddReturnProductProps {
  returnId: number;
  onUpdate: () => Promise<void>;
}

export function AddReturnProduct({
  returnId,
  onUpdate,
}: AddReturnProductProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const { data: products } = fetchActiveProducts();
  const { data: categories } = fetchCategories();
  const { mutateAsync: insertReturnItems } = useInsertReturnItems();

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
      await insertReturnItems([
        {
          return_id: returnId,
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
        <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto">
          {filteredProducts?.map((product) => (
            <div
              key={product.id}
              className="flex justify-between items-center p-2 hover:bg-slate-100 rounded cursor-pointer"
              onClick={() => handleAddProduct(product)}
            >
              <span>{product.name}</span>
              <span>{product.price} Kč</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
