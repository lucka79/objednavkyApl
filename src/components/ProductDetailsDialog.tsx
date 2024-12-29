import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProductStore } from "@/providers/productStore";
import { Badge } from "./ui/badge";
import { fetchProductById } from "@/hooks/useProducts";
import { fetchCategories } from "@/hooks/useCategories";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { ProductForm } from "@/components/ProductForm";
import RemoteImage from "./RemoteImage";
import { defaultProductImage } from "@/constants/Images";
import kolac from "@/assets/img/kolac.png";
import fresh from "@/assets/img/fresh.png";
import chleb from "@/assets/img/chleb.png";
import donut from "@/assets/img/donut.png";

export function ProductDetailsDialog() {
  const { selectedProductId, setSelectedProductId } = useProductStore();
  const { data: categoriesData } = fetchCategories();
  const {
    data: productData,
    error,
    isLoading,
  } = fetchProductById(selectedProductId!, {
    enabled: !!selectedProductId,
  });

  const [isEditing, setIsEditing] = useState(false);

  if (!selectedProductId) return null;

  if (isLoading)
    return <Loader2 className="animate-spin justify-center items-center" />;
  if (error) return <div>Error loading product details</div>;

  const product = productData;
  const category = categoriesData?.find((c) => c.id === product?.category_id);

  if (isEditing) {
    return <ProductForm onClose={() => setIsEditing(false)} />;
  }

  return (
    <Dialog
      open={!!selectedProductId}
      onOpenChange={() => setSelectedProductId(null)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex justify-between">
            {product?.name}
            <div className="flex gap-2">
              <Badge variant="outline">{category?.name}</Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>#{product?.id}</span>
            <span>{new Date(product?.created_at).toLocaleDateString()}</span>
          </div>

          <p className="text-sm text-muted-foreground">
            {product?.description}
          </p>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <span className="text-sm">
                Prodejní cena: {product?.price.toFixed(2)} Kč
              </span>
              <span className="text-sm">
                Mobilní cena: {product?.priceMobil.toFixed(2)} Kč
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">
                Nákupní cena: {product?.priceBuyer.toFixed(2)} Kč
              </span>
              <span className="text-sm">DPH: {product?.vat}%</span>
            </div>
          </div>

          <div className="flex justify-center">
            <RemoteImage
              path={product?.image}
              fallback={
                product?.category_id === 4
                  ? donut
                  : product?.category_id === 6
                    ? kolac
                    : product?.category_id === 7
                      ? chleb
                      : product?.category_id === 8
                        ? fresh
                        : defaultProductImage
              }
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
