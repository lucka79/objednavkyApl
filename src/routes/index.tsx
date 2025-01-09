import { createFileRoute } from "@tanstack/react-router";
// import hero1 from "../assets/img/hero1.png";
// import hero2 from "../assets/img/hero2.png";
// import hero3 from "../assets/img/hero3.png";

// import ProductScrollCategory from "@/components/ProductScrollCategory";
// import { Card } from "@/components/ui/card";

// import { ImageSlider } from "@/components/ImageSlider";

// const HeroImages = [hero1, hero2, hero3];

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <>
      <main className="flex-1 items-start gap-2  sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
        {/* <ImageSlider imageUrl={HeroImages} /> */}
        {/* <Card><ProductScrollCategory /></Card> */}
      </main>
    </>
  );
}
