import { fetchActiveProducts } from "@/hooks/useProducts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProductOrderFilterProps {
  onProductSelect: (productId: string | null) => void;
}

export function ProductOrderFilter({
  onProductSelect,
}: ProductOrderFilterProps) {
  const { data: products } = fetchActiveProducts();

  return (
    <Select
      onValueChange={(value) => onProductSelect(value === "all" ? null : value)}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Filter by product" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Products</SelectItem>
        {products?.map((product) => (
          <SelectItem key={product.id} value={product.id.toString()}>
            {product.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
