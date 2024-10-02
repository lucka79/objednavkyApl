import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

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

export default function ProductCatalog() {
  const {
    data: categories,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["categories", "products"],
    queryFn: fetchCategoriesAndProducts,
  });

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

                    <button className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors">
                      Add to Cart
                    </button>
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
