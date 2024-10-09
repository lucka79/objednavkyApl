// ProductList.tsx
import React from "react";
import { useProducts } from "@/hooks/useProducts";
import { useCartStore } from "@/providers/cartStore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";

export const ProductList: React.FC = () => {
  const { data: products, isLoading, error } = useProducts();
  const addItem = useCartStore((state) => state.addItem);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {products?.map((product) => (
        <Card key={product.id}>
          <CardHeader>
            <CardTitle>{product.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* <p>{product.description}</p> */}
            <p className="font-bold">${product.price.toFixed(2)}</p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => addItem(product)}>
              <ShoppingCart />
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};
