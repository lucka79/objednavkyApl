import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCartStore } from "@/lib/supabase";
import { getProducts } from "@/api/cart";

export function Products() {
  const { error } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  });
  const addItem = useCartStore((state) => state.addItem);

  if (error) return <div>Error loading products</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product) => (
        <Card key={product.id}>
          <CardHeader>
            <CardTitle>{product.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{product.description}</p>
            <p className="font-bold mt-2">${product.price.toFixed(2)}</p>
          </CardContent>
          <CardFooter>
            <Button
              onClick={() =>
                addItem({
                  id: Date.now(),
                  productId: product.id,
                  quantity: 1,
                  price: product.price,
                })
              }
            >
              Add to Cart
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
