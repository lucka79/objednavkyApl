import { Tables } from "../../types";
import { Label } from "@radix-ui/react-label";
import { defaultProductImage } from "@/constants/Images";

import { Card } from "./ui/card";
import RemoteImage from "./RemoteImage";

type ProductListItemProps = {
  product: Tables<"products">;

  // product: Product;
};

const ProductItem = ({ product }: ProductListItemProps) => {
  // console.log(segments);
  return (
    <div className="flex justify-center p-5">
      <Card className="w-[200px]">
        {/* <img
          src={product.image || defaultProductImage}
          style={{ height: 150, width: 150 }}
        /> */}
        <RemoteImage // <Image
          // source={{ uri: product.image || defaultProductImage }}
          path={product.image}
          fallback={defaultProductImage}
          style={{ height: "75%", width: "75%" }}
          resizeMode="contain"
        />
        <Label
          style={{
            fontSize: 18,
            fontWeight: "semibold",
            marginBottom: 10,
            marginTop: 10,
          }}
        >
          {product.name}
        </Label>
        <p>
          <Label style={{ color: "green", fontWeight: "bold" }}>
            $ {product.price}
          </Label>
        </p>
        <p>
          <Label style={{ color: "green", fontWeight: "bold" }}>
            {product.priceMobile} Kč
          </Label>
        </p>
      </Card>
    </div>
  );
};

export default ProductItem;
