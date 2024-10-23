import { ProductDetails } from "@/components/ProductDetails";
import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useParams } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/products/$productId")({
  component: ProductDetailsPage,
});

function ProductDetailsPage() {
  const { productId: idString } = useParams({
    from: "/admin/products/$productId",
  });
  const productId = parseFloat(
    typeof idString === "string" ? idString : idString[0]
  );

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <Link to="/">
          <Button variant="outline">Back to Products</Button>
        </Link>
      </div>
      <h1 className="text-3xl font-bold mb-4">Product Details</h1>
      <ProductDetails productId={productId} />
    </div>
  );
}
