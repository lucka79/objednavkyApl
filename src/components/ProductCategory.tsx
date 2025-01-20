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
import { Search } from "lucide-react";
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

  // Calculate rows based on screen size using Tailwind classes
  return (
    <div className="w-full rounded-md border p-2">
      <div className="hidden md:flex md:flex-col md:gap-2 xl:hidden">
        {/* 3 rows for medium to large screens */}
        {[
          [
            null,
            ...buyerCategories.slice(
              0,
              Math.ceil(buyerCategories.length / 3) - 1
            ),
          ],
          buyerCategories.slice(
            Math.ceil(buyerCategories.length / 3) - 1,
            Math.ceil(buyerCategories.length / 3) * 2 - 1
          ),
          buyerCategories.slice(Math.ceil(buyerCategories.length / 3) * 2 - 1),
        ].map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-4">
            {row.map((category) => (
              <Button
                key={category?.id ?? "all"}
                variant="outline"
                className={`w-32 hover:border-orange-400 ${
                  selectedCategory === (category?.id ?? null)
                    ? "bg-orange-400 text-white"
                    : ""
                }`}
                onClick={() => onSelectCategory(category?.id ?? null)}
              >
                {category?.name ?? "Vše"}
              </Button>
            ))}
          </div>
        ))}
      </div>

      <div className="hidden xl:flex xl:flex-col xl:gap-2">
        {/* 2 rows for xl screens (1290px+) */}
        {[
          [
            null,
            ...buyerCategories.slice(
              0,
              Math.ceil(buyerCategories.length / 2) - 1
            ),
          ],
          buyerCategories.slice(Math.ceil(buyerCategories.length / 2) - 1),
        ].map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-4">
            {row.map((category) => (
              <Button
                key={category?.id ?? "all"}
                variant="outline"
                className={`w-32 hover:border-orange-400 ${
                  selectedCategory === (category?.id ?? null)
                    ? "bg-orange-400 text-white"
                    : ""
                }`}
                onClick={() => onSelectCategory(category?.id ?? null)}
              >
                {category?.name ?? "Vše"}
              </Button>
            ))}
          </div>
        ))}
      </div>

      {/* Mobile layout */}
      <div className="flex flex-col gap-2 md:hidden">
        {[[null, ...buyerCategories]].map((row, rowIndex) => (
          <div key={rowIndex} className="flex flex-wrap gap-4">
            {row.map((category) => (
              <Button
                key={category?.id ?? "all"}
                variant="outline"
                className={`w-32 hover:border-orange-400 ${
                  selectedCategory === (category?.id ?? null)
                    ? "bg-orange-400 text-white"
                    : ""
                }`}
                onClick={() => onSelectCategory(category?.id ?? null)}
              >
                {category?.name ?? "Vše"}
              </Button>
            ))}
          </div>
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
        {filteredProducts?.map((product: Product) => (
          <Card
            key={product.id}
            onClick={() => addItem(product as any)}
            className="text-center h-36 flex flex-col cursor-pointer"
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
              {/* Empty div to push the footer to the bottom */}
              <div className="flex-grow"></div>
              {/* <CardContent className="pb-0 text-xs font-semibold"></CardContent> */}
              <CardFooter className="flex justify-end pb-2">
                <Badge variant="outline" className="text-xs">
                  {(user?.role === "admin" || user?.role === "expedition") && (
                    <div className="flex flex-col gap-1 text-sm text-green-800">
                      <span>{product.priceBuyer.toFixed(2)} Kč</span>
                      <span className="italic font-semibold text-orange-600">
                        {product.priceMobil.toFixed(2)} Kč
                      </span>
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
