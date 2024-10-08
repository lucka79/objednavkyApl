import { ProductList } from "@/components/ProductList";
import { Products } from "@/components/Products";
import ProductsByCategory from "@/components/ProductsByCategory";
import { createFileRoute } from "@tanstack/react-router";
import { Category, Product } from "types";

export const Route = createFileRoute("/user/products")({
  component: UserProducts,
});

function UserProducts() {
  return (
    <>
      <ProductList />
      {/* <ProductsByCategory /> */}
    </>
  );
}
