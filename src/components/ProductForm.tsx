"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { insertProduct } from "@/hooks/useProducts";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { fetchCategories } from "@/hooks/useCategories";
import { useNavigate } from "@tanstack/react-router";

const productSchema = z.object({
  name: z.string().min(3, "Product name is required"),
  description: z.string().min(5, "Product description is required"),
  price: z.number().min(0.01, "Cena musí být větší než 0"),
  category_id: z.number().min(1, "Kategorie musí být vybrána"),
});

type ProductFormValues = z.infer<typeof productSchema>;

export function ProductForm() {
  const queryClient = useQueryClient();
  // const { productId } = useParams({ from: "/admin/products/$productId" });
  const navigate = useNavigate();
  const { data: categories, isLoading: categoriesLoading } = fetchCategories();
  // const { data: product, isLoading: productLoading } = fetchProductById(id);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      category_id: 1,
    },
  });

  const insertProductMutation = useMutation({
    mutationFn: insertProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate({ to: "/user/products" });
      toast({
        title: "Výrobek vytvořen",
        description: "Výrobek byl úspěšně vytvořen.",
      });
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Při vytváření výrobku nastala chyba. Zkuste to znovu.",
        variant: "destructive",
      });
      console.error("Chyba při vytváření výrobku:", error);
    },
  });

  const onSubmit = (data: ProductFormValues) => {
    insertProductMutation.mutate(data);
  };

  if (categoriesLoading) return <div>Načítání kategorií...</div>;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-2/3 space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Název výrobku" {...field} />
              </FormControl>
              <FormDescription>
                This is your public display name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kategorie výrobku</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(parseInt(value))}
                defaultValue={field.value.toString()}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte kategorii" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories?.map((category) => (
                    <SelectItem
                      key={category.id}
                      value={category.id.toString()}
                    >
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Krátký popis ..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormDescription>Krátký popis výrobku.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prodejní cena</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="Enter product price"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                />
              </FormControl>
              <FormDescription>Cena výrobku v Kč s DPH.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          variant="outline"
          type="submit"
          disabled={insertProductMutation.isPending}
          className="w-full"
        >
          {insertProductMutation.isPending ? "Vkládám..." : "Vložit výrobek"}
        </Button>
      </form>
    </Form>
  );
}
