//import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ImageSlider } from "../components/ImageSlider";
import hero1 from "../assets/img/hero1.png";
import hero2 from "../assets/img/hero2.png";
import hero3 from "../assets/img/hero3.png";
import { fetchProducts } from "@/api/products";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import ProductGrid from "@/components/ProductCategoryList";
import ProductCatalog from "@/components/ProductsByCategory";
import ProductCatalog2 from "@/components/ProductScrollCategory";
import ProductItem from "@/components/ProductItem";

const HeroImages = [hero1, hero2, hero3];

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const { data: products, error, isLoading } = fetchProducts();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className=" mr-2 h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <Label>Nepovedlo se získat data produktů.</Label>;
  }

  return (
    <>
      <ProductCatalog2 />
      {/* <ProductGrid /> */}
      <ProductCatalog />
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-4 gap-4">
          {/* <ImageSlider imageUrl={HeroImages} /> */}
          {/* <ProductItem product={products[2]} /> */}
          {/* <h1>Product List</h1>
          {products.map((product) => (
            <ProductItem key={product.id} product={product} />
          ))} */}
        </div>
      </div>
    </>
  );
}
