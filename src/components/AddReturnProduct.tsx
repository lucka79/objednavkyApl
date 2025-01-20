import { useState } from "react";
import { useInsertReturnItems } from "@/hooks/useReturns";
import { fetchActiveProducts } from "@/hooks/useProducts";
import { fetchCategories } from "@/hooks/useCategories";
import { Product } from "../../types";
import { Input } from "./ui/input";
import { Card, CardTitle, CardHeader } from "./ui/card";
import { CategoryBadgesVertical } from "./CategoryBadgesVertical";
import { supabase } from "@/lib/supabase";

interface AddReturnProductProps {
  returnId: number;
  onUpdate: () => Promise<void>;
}

export function AddReturnProduct({
  returnId,
  onUpdate,
}: AddReturnProductProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(8);
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
    // Determine price based on user's role

    try {
      // Get the return's user role first
      const { data: returnData } = await supabase
        .from("returns")
        .select(
          `*,
          user:profiles!inner(role)
        `
        )
        .eq("id", returnId)
        .single();

      // Determine price based on user's role
      const price =
        returnData?.user?.role === "mobil" ? product.priceMobil : product.price;
      await insertReturnItems([
        {
          return_id: returnId,
          product_id: product.id,
          quantity: 0,
          price: price,
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
        <div className="flex gap-4">
          <div className="w-36">
            <CategoryBadgesVertical
              categories={categories || []}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
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
      </div>
    </Card>
  );
}
