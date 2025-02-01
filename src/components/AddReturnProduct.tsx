import { useState } from "react";
import { useInsertReturnItems } from "@/hooks/useReturns";
import { fetchActiveProducts } from "@/hooks/useProducts";
import { fetchCategories } from "@/hooks/useCategories";
import { Product } from "../../types";
import { Input } from "./ui/input";
import { Card, CardTitle, CardHeader, CardContent } from "./ui/card";
import { CategoryBadgesVertical } from "./CategoryBadgesVertical";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

  const filteredProducts = products?.filter((product: Product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory
      ? product.category_id === selectedCategory
      : product.category_id === 8 ||
        product.category_id === 14 ||
        product.category_id === 13;

    console.log(
      "Product:",
      product.name,
      "Category:",
      product.category_id,
      "Selected:",
      selectedCategory
    );

    return matchesSearch && matchesCategory;
  });

  const handleAddProduct = async (product: Product) => {
    try {
      // Check if item already exists
      const { data: existingItem } = await supabase
        .from("return_items")
        .select()
        .eq("return_id", returnId)
        .eq("product_id", product.id)
        .single();

      if (existingItem) {
        toast({
          variant: "destructive",
          title: "Product already exists",
          description: "This product is already in the return list.",
        });
        return;
      }

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
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add product to return.",
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

          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-2">
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
