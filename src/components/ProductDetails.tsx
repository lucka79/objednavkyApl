import { fetchProductById } from "@/hooks/useProducts";
import { fetchCategories } from "@/hooks/useCategories";

type ProductDetailsProps = {
  productId: number;
};

export function ProductDetails({ productId }: ProductDetailsProps) {
  const { data: categories } = fetchCategories();
  const { data: product, error, isLoading } = fetchProductById(productId);

  if (isLoading) return <div>Loading product details...</div>;
  if (error) return <div>Error loading product details</div>;
  if (!product) return <div>Product not found</div>;

  return (
    <>
      <h1 className="text-2xl font-bold">{product.name}</h1>
      <p>{product.description}</p>
      <p className="text-xl font-semibold">${product.price.toFixed(2)}</p>

      <p>
        Category: {categories?.find((c) => c.id === product.category_id)?.name}
      </p>
    </>
  );
}
