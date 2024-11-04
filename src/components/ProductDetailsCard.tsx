import { useProductStore } from "@/providers/productStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "./ui/badge";

import { fetchProductById } from "@/hooks/useProducts";
import { Product } from "types";
import { fetchCategories } from "@/hooks/useCategories";
import { FilePenLine, Loader2 } from "lucide-react";
import { useState } from "react";
import { ProductForm } from "@/components/ProductForm";
import RemoteImage from "./RemoteImage";
import kolac from "@/assets/img/kolac.png";
import fresh from "@/assets/img/fresh.png";
import chleb from "@/assets/img/chleb.png";
import donut from "@/assets/img/donut.png";
import { defaultProductImage } from "@/constants/Images";

export function ProductDetailsCard() {
  const { selectedProductId } = useProductStore();
  const { data: categoriesData } = fetchCategories();
  const {
    data: productData,
    error,
    isLoading,
  } = fetchProductById(selectedProductId!);

  const [isEditing, setIsEditing] = useState(false);

  if (!selectedProductId) return null;
  if (isLoading)
    return <Loader2 className="animate-spin justify-center items-center" />;
  if (error) return <div>Error loading product details</div>;

  const product = productData as Product; // Assuming products is a single Product object
  const category = categoriesData?.find((c) => c.id === product.category_id);

  if (isEditing) {
    return (
      <ProductForm
        productId={selectedProductId}
        onClose={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div>
      <Card key={product.id}>
        <CardHeader>
          <CardTitle className="flex justify-between">
            {product.name}
            <div className="flex gap-2">
              <Badge variant="outline">{category?.name}</Badge>
              <Badge variant="outline">
                <FilePenLine size={12} onClick={() => setIsEditing(true)} />
              </Badge>
            </div>
          </CardTitle>

          <CardDescription className="flex justify-between">
            {/* Order ID: {selectedOrderId} */}
            <span className="flex-col text-muted-foreground">
              # {product.id}
            </span>
            <span>{new Date(product.created_at).toLocaleDateString()}</span>
          </CardDescription>
          <CardDescription className="flex justify-between">
            <span className="flex-row text-muted-foreground">
              {product.description}
            </span>
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
        <CardFooter>
          <RemoteImage
            path={product.image}
            fallback={
              product.category_id === 4
                ? donut
                : product.category_id === 6
                  ? kolac
                  : product.category_id === 7
                    ? chleb
                    : product.category_id === 8
                      ? fresh
                      : defaultProductImage
            }
          />
        </CardFooter>
      </Card>
    </div>
  );
}
