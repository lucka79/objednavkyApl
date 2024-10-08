import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { addItem, useCartStore } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchCategoriesAndProducts } from "@/api/categories";
import RemoteImage from "./RemoteImage";
import { defaultProductImage } from "@/constants/Images";
import { Button } from "./ui/button";
import { useToast } from "@/hooks/use-toast";
export default function ProductsByCategory() {
  const {
    data: categories,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["categories", "products"],
    queryFn: fetchCategoriesAndProducts,
  });
  const addItem = useCartStore((state: { addItem: any }) => state.addItem);
  const { toast } = useToast();
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500">Error: {error.message}</div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {categories?.map((category) => (
        <div key={category.id} className="mb-8">
          <h2 className="text-2xl font-bold mb-4">{category.name}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {category.products.map((product) => (
              <Card key={product.id} className="flex flex-col">
                <CardHeader>
                  {/* <Image
                    src={product.image_url}
                    alt={product.name}
                    width={300}
                    height={200}
                    className="object-cover w-full h-48 rounded-t-lg"
                  /> */}
                  <RemoteImage // <Image
                    // source={{ uri: product.image || defaultProductImage }}
                    path={product.image}
                    fallback={defaultProductImage}
                    className="object-cover w-full h-48 rounded-t-lg"
                  />
                </CardHeader>
                <CardContent className="flex-grow">
                  <CardTitle className="text-lg mb-2">{product.name}</CardTitle>
                  <p className="text-sm text-gray-600 mb-2">
                    {product.description}
                  </p>
                </CardContent>
                <CardFooter className="flex justify-between items-center">
                  <p>
                    <Badge variant="secondary">
                      ${product.price.toFixed(2)}
                    </Badge>

                    <Button
                      onClick={() =>
                        addItem({
                          id: Date.now(),
                          productId: product.id,
                          name: product.name,
                          quantity: 1,
                          price: product.price,
                        })
                      }
                    >
                      Add to Cart
                    </Button>
                  </p>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
