import { useProductStore } from "@/providers/productStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "./ui/badge";

import { fetchProductById } from "@/hooks/useProducts";
import { Product } from "types";
import { fetchCategories } from "@/hooks/useCategories";
import { Loader2 } from "lucide-react";

export function ProductDetailsCard() {
  const { selectedProductId, setSelectedProductId } = useProductStore();
  const { data: categoriesData } = fetchCategories();
  const {
    data: productData,
    error,
    isLoading,
  } = fetchProductById(selectedProductId!);

  if (!selectedProductId) return null;
  if (isLoading)
    return <Loader2 className="animate-spin justify-center items-center" />;
  if (error) return <div>Error loading product details</div>;

  const product = productData as Product; // Assuming products is a single Product object
  const category = categoriesData?.find((c) => c.id === product.category_id);

  return (
    <div>
      <Card key={product.id}>
        <CardHeader>
          <CardTitle className="flex justify-between">
            {product.name}
            <Badge variant="outline">{category?.name}</Badge>
          </CardTitle>

          <CardDescription className="flex-col">
            {/* Order ID: {selectedOrderId} */}
            <p># {product.id}</p>
            <span className="text-muted-foreground">{product.description}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-between">
          <span className="text-sm font-semibold">
            Prodejní cena: {product.price.toFixed(2)} Kč
          </span>
          <span className="text-sm font-semibold">
            Mobilní cena: {product.priceMobil.toFixed(2)} Kč
          </span>
          {/* <OrderItems items={order.order_items} /> budou zde suroviny */}
        </CardContent>
      </Card>
    </div>
  );
}
