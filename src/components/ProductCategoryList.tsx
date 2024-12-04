import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";

import { Skeleton } from "./ui/skeleton";
import { Badge } from "./ui/badge";
import RemoteImage from "./RemoteImage";
import { defaultProductImage } from "@/constants/Images";
import { fetchActiveProducts } from "@/hooks/useProducts";
import { fetchCategories } from "@/hooks/useCategories";

export default function ProductCategoryList() {
  const { data: products, error, isLoading } = fetchActiveProducts();
  const {
    data: categories,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = fetchCategories();

  if (isLoading || categoriesLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-2/3" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[200px] w-full" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-4 w-1/3" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (error || categoriesError) {
    return <div className="text-center text-red-500">Error loading data</div>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
      {products?.map((product) => {
        const category = categories?.find((c) => c.id === product.category_id);
        return (
          <Card key={product.id} className="flex flex-col h-88">
            <CardHeader className="h-full h-max-16">
              <CardTitle>{product.name}</CardTitle>
              {category && <Badge variant="secondary">{category.name}</Badge>}
            </CardHeader>
            <CardContent className="h-full h-max-32">
              {/* <img
                src={product.image || "/placeholder.svg"}
                alt={product.name}
                className="w-full h-30 object-cover mb-2"
              /> */}
              <RemoteImage // <Image
                // source={{ uri: product.image || defaultProductImage }}
                path={product.image}
                fallback={defaultProductImage}
                // className="w-full h-42 object-cover mb-2"
              />
              <p className="text-sm text-muted-foreground">
                {product.description}
              </p>
            </CardContent>
            <CardFooter className="h-full h-max-32">
              <p className="font-bold">${product.price.toFixed(2)}</p>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
