// ProductList.tsx
import React, { useState } from "react";
import { fetchActiveProducts } from "@/hooks/useProducts";
import { useCartStore } from "@/providers/cartStore";

import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "./ui/badge";
import { Category } from "types";
import { Skeleton } from "./ui/skeleton";
import { useAuthStore } from "@/lib/supabase";
import { fetchCategories } from "@/hooks/useCategories";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, ShoppingCart } from "lucide-react";
import { Switch } from "@/components/ui/switch";

// Category badges component
const CategoryBadges = ({
  categories,
  selectedCategory,
  onSelectCategory,
}: {
  categories: Category[];
  selectedCategory: number | null;
  onSelectCategory: (id: number | null) => void;
}) => {
  const buyerCategories = categories.filter((category) => category.buyer);

  return (
    <div className="w-full rounded-md border p-2">
      {/* Grid layout for all screen sizes */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-8">
        <Button
          key="all"
          variant="outline"
          className={`w-full hover:border-orange-400 ${
            selectedCategory === null ? "bg-orange-400 text-white" : ""
          }`}
          onClick={() => onSelectCategory(null)}
        >
          Vše
        </Button>
        {buyerCategories.map((category) => (
          <Button
            key={category?.id}
            variant="outline"
            className={`w-full hover:border-orange-400 ${
              selectedCategory === category?.id
                ? "bg-orange-400 text-white"
                : ""
            }`}
            onClick={() => onSelectCategory(category?.id)}
          >
            {category?.name}
          </Button>
        ))}
      </div>
    </div>
  );
};

interface Product {
  id: number;
  name: string;
  nameVi?: string;
  category_id: number;
  priceBuyer: number;
  priceMobil: number;
  code: string;
  price: number;
  vat: number;
  active: boolean;
  created_at: string;
  buyer: boolean;
  store: boolean;
}

export const ProductCategory: React.FC = () => {
  const { data: products, isLoading, error } = fetchActiveProducts();
  const { data: categories, isLoading: categoriesLoading } = fetchCategories();

  const addItem = useCartStore((state) => state.addItem);
  const user = useAuthStore((state) => state.user);

  const [selectedCategory, setSelectedCategory] = useState<number | null>(8);
  const [priceFilter, setPriceFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [useVietnamese, setUseVietnamese] = useState(false);

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

  const filteredProducts = products
    ?.filter((product: Product) => {
      // First apply category filter
      if (selectedCategory && product.category_id !== selectedCategory) {
        return false;
      }
      // Then apply price filter
      switch (priceFilter) {
        case "mobilOnly":
          return product.priceMobil > 0;
        case "buyerOnly":
          return product.priceBuyer > 0;
        default:
          return true;
      }
    })
    .filter((product: Product) => {
      // Finally apply search filter
      if (searchQuery.trim() === "") return true;
      return product.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

  // Use filteredProducts instead of products when rendering
  return (
    <Card className="p-4 print:hidden">
      <div className="container mx-auto p-2">
        <div className="flex flex-col gap-2">
          {/* Categories row */}
          <CategoryBadges
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />

          {/* Price filter and search row */}
          <div className="flex justify-between items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Hledat výrobek..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">CZ</span>
              <Switch
                checked={useVietnamese}
                onCheckedChange={setUseVietnamese}
                className="data-[state=checked]:bg-orange-500"
              />
              <span className="text-sm">VI</span>
            </div>
            <Select value={priceFilter} onValueChange={setPriceFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by price" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny ceny</SelectItem>
                <SelectItem value="mobilOnly">Pouze mobilní ceny</SelectItem>
                <SelectItem value="buyerOnly">Pouze nákupní ceny</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Products grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6 gap-2 p-2">
        {filteredProducts
          ?.sort((a, b) => a.name.localeCompare(b.name))
          .map((product: Product) => (
            <Card
              key={product.id}
              onClick={(e: React.MouseEvent) => {
                if (e.target === e.currentTarget) {
                  const input = e.currentTarget.querySelector("input");
                  const quantity = Number(input?.value || 1);
                  if (quantity > 0) {
                    addItem({ ...product, isAdmin: false }, quantity);
                    if (input) {
                      (input as HTMLInputElement).value = "1";
                    }
                  }
                }
              }}
              className="text-center h-36 flex flex-col"
            >
              <div className="flex-1">
                <CardHeader className="h-full px-1">
                  <CardTitle className="text-sm line-clamp-2 mx-1 hover:line-clamp-3">
                    {useVietnamese
                      ? product.nameVi || product.name
                      : product.name}
                  </CardTitle>
                </CardHeader>
              </div>

              {/* Second half - Prices and Button */}
              <div className="flex-1 flex flex-col justify-between">
                <div className="flex-grow"></div>
                <CardFooter className="flex justify-end items-center gap-2 pb-2">
                  <Input
                    type="number"
                    min="1"
                    defaultValue={1}
                    className="w-16 h-8 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      (e.target as HTMLInputElement).select();
                    }}
                  />

                  <Badge
                    variant="outline"
                    className="text-xs cursor-pointer bg-orange-500 text-white hover:bg-grey-100 hover:text-gray-400"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      const input =
                        e.currentTarget.parentElement?.querySelector("input");
                      const quantity = Number(input?.value || 1);
                      if (quantity > 0) {
                        addItem({ ...product, isAdmin: false }, quantity);
                        if (input) {
                          (input as HTMLInputElement).value = "1";
                        }
                      }
                    }}
                  >
                    {(user?.role === "admin" ||
                      user?.role === "expedition") && (
                      <div className="flex flex-col gap-1 text-sm">
                        <ShoppingCart size={20} />
                      </div>
                    )}
                  </Badge>
                </CardFooter>
              </div>
            </Card>
          ))}
      </div>
    </Card>
  );
};
