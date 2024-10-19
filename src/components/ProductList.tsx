import { useCartStore } from "@/providers/cartStore";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchCategoryById } from "@/hooks/useCategories";

export function ProductLisT({ categoryId }: { categoryId: number }) {
  const { data: products, isLoading, error } = fetchCategoryById(categoryId);

  const addItem = useCartStore((state) => state.addItem);

  if (isLoading) return <div>Loading products...</div>;
  if (error) return <div>Error loading products</div>;
  if (!products) return null; // Add this line

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {products.map((product) => (
        <Card key={product.id}>
          <CardHeader>
            <CardTitle>{product.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{product.description}</p>
            <p className="font-bold">${product.price.toFixed(2)}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => addItem(product)}>Add to Cart</Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
