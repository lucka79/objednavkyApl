import { createFileRoute } from "@tanstack/react-router";
// import hero1 from "../assets/img/hero1.png";
// import hero2 from "../assets/img/hero2.png";
// import hero3 from "../assets/img/hero3.png";

import ProductsByCategory from "@/components/ProductsByCategory";
import ProductScrollCategory from "@/components/ProductScrollCategory";

// import { ImageSlider } from "@/components/ImageSlider";

// const HeroImages = [hero1, hero2, hero3];

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <>
      {/* <ImageSlider imageUrl={HeroImages} /> */}
      <ProductScrollCategory />

      {/* <ProductGrid /> */}
      {/* <ProductsByCategory /> */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-4 gap-4">
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
