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
import {
  fetchProductById,
  insertProduct,
  updateProduct,
} from "@/hooks/useProducts";
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
import { useProductStore } from "@/providers/productStore";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase";

const productSchema = z.object({
  name: z.string().min(3, "Product name is required"),
  description: z.string().min(0, "Product description is required"),
  price: z.number().min(0.01, "Cena musí být větší než 0"),
  priceMobil: z.number().min(0, "Mobilní cena musí být nezáporná"),
  category_id: z.number().min(1, "Kategorie musí být vybrána"),
  image: z.union([z.instanceof(File), z.string()]).optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductFormProps {
  onClose: () => void;
}

export function ProductForm({ onClose }: ProductFormProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { selectedProductId } = useProductStore();
  const { data: categories, isLoading: categoriesLoading } = fetchCategories();
  const { data: product, isLoading: productLoading } = fetchProductById(
    selectedProductId ?? 0
  );

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      priceMobil: 0,
      category_id: 1,
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        description: product.description,
        price: product.price,
        priceMobil: product.priceMobil,
        category_id: product.category_id,
      });
    }
  }, [product, form]);

  const productMutation = useMutation({
    mutationFn: (data: ProductFormValues & { id?: number }) =>
      selectedProductId
        ? updateProduct(data as ProductFormValues & { id: number })
        : insertProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({
        queryKey: ["product", selectedProductId],
      });
      navigate({ to: "/admin/products" });
      toast({
        title: selectedProductId ? "Výrobek aktualizován" : "Výrobek vytvořen",
        description: selectedProductId
          ? "Výrobek byl úspěšně aktualizován."
          : "Výrobek byl úspěšně vytvořen.",
      });
      form.reset();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Při ${selectedProductId ? "aktualizaci" : "vytváření"} výrobku nastala chyba. Zkuste to znovu.`,
        variant: "destructive",
      });
      console.error(
        `Chyba při ${selectedProductId ? "aktualizaci" : "vytváření"} výrobku:`,
        error
      );
    },
  });

  const onSubmit = async (data: ProductFormValues) => {
    try {
      if (data.image instanceof File) {
        const arrayBuffer = await data.image.arrayBuffer();
        const filePath = `${crypto.randomUUID()}.png`;
        const contentType = "image/png";

        const { data: dataImage, error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(filePath, arrayBuffer, {
            contentType,
            upsert: false,
          });

        if (uploadError) throw uploadError;
        if (dataImage) {
          productMutation.mutate(
            selectedProductId
              ? { ...data, id: selectedProductId, image: dataImage.path }
              : { ...data, image: dataImage.path }
          );
        }
      } else {
        productMutation.mutate(
          selectedProductId ? { ...data, id: selectedProductId } : data
        );
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Error",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (categoriesLoading || productLoading) return <div>Načítání...</div>;

  return (
    <>
      <Card className="relative">
        <CardHeader>
          <CardTitle>Aktualizace výrobku</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="w-2/3 space-y-2"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Název výrobku" {...field} />
                    </FormControl>
                    {/* <FormDescription>
                      This is your public display name.
                    </FormDescription> */}
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
                      value={field.value.toString()}
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
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormDescription>Cena výrobku v Kč s DPH.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priceMobil"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobilní cena</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Mobilní cena..."
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormDescription>Cena výrobku v Kč s DPH.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="image"
                render={({ field: { onChange, value, ...field } }) => (
                  <FormItem>
                    <FormLabel>Obrázek</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) onChange(file);
                        }}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Nahrát obrázek výrobku.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                variant="outline"
                type="submit"
                disabled={productMutation.isPending}
                className="w-full"
              >
                {productMutation.isPending
                  ? "Aktualizuji..."
                  : "Aktualizovat výrobek"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}
