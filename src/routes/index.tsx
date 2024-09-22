//import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ImageSlider } from "../components/ImageSlider";
import hero1 from "../assets/img/hero1.png";
import hero2 from "../assets/img/hero2.png";
import hero3 from "../assets/img/hero3.png";
import ProductItem from "@/components/ProductItem";
import { useProductList } from "@/api/products";
import { ReloadIcon } from "@radix-ui/react-icons";
import { Label } from "@/components/ui/label";
import { Item } from "@radix-ui/react-select";

const HeroImages = [hero1, hero2, hero3];

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const { data: products, error, isLoading } = useProductList();

  if (isLoading) {
    return <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />;
  }

  if (error) {
    return <Label>Nepovedlo se získat data produktů.</Label>;
  }

  return (
    <div>
      {/* <ImageSlider imageUrl={HeroImages} /> */}
      {/* <ProductItem product={products[2]} /> */}
      <h1>Product List</h1>
      {products.map((product) => (
        <ProductItem key={product.id} product={product} />
      ))}
    </div>
  );
}
