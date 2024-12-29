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
// import { useNavigate } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";

import { supabase } from "@/lib/supabase"; // Adjust the import path as needed
// import { Progress } from "@/components/ui/progress";
import imageCompression from "browser-image-compression";

const productSchema = z.object({
  name: z.string().min(3, "Product name is required"),
  description: z.string().min(0, "Popis je povinný"),
  price: z.number().min(0, "Cena musí být nezáporná"),
  priceBuyer: z.number().min(0, "Cena musí být větší než 0").optional(),
  priceMobil: z.number().min(0, "Mobilní cena musí být nezáporná"),
  vat: z.number().min(0, "DPH musí být nezáporná"),
  category_id: z.number().min(1, "Kategorie musí být vybrána"),
  image: z.union([z.instanceof(File), z.string()]).optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

export function CreateProductForm() {
  const queryClient = useQueryClient();
  // const { productId } = useParams({ from: "/admin/products/$productId" });
  // const navigate = useNavigate();
  const { data: categories, isLoading: categoriesLoading } = fetchCategories();
  // const { data: product, isLoading: productLoading } = fetchProductById(id);
  const onClose = () => {
    form.reset();
  };

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      priceBuyer: 0,
      priceMobil: 0,
      vat: 12,
      category_id: 1,
      // image: "",
    },
  });

  const insertProductMutation = useMutation({
    mutationFn: insertProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: "Výrobek vytvořen",
        description: "Výrobek byl úspěšně vytvořen.",
      });
      form.reset({
        name: "",
        description: "",
        price: 0,
        priceBuyer: 0,
        priceMobil: 0,
        vat: 12,
        category_id: 1,
      });
      onClose();
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

  const onSubmit = async (data: ProductFormValues) => {
    try {
      if (data.image instanceof File) {
        const compressedImage = await imageCompression(data.image, {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
        });
        const arrayBuffer = await compressedImage.arrayBuffer();
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
          // @ts-ignore
          insertProductMutation.mutate({ ...data, image: dataImage.path });
        }
      } else {
        // @ts-ignore
        insertProductMutation.mutate(data);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Error",
        description: "Při nahrávání obrázku nastala chyba.",
        variant: "destructive",
      });
    }
  };

  if (categoriesLoading) return <div>Načítání kategorií...</div>;

  return (
    <>
      <Card className="relative w-[480px] mx-auto justify-center border-none">
        <CardHeader>
          <CardTitle>Nový výrobek</CardTitle>
        </CardHeader>
        {/* <CardContent> */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1">
            <CardContent className="grid grid-cols-2 gap-2 py-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    {/* <FormLabel>Name</FormLabel> */}
                    <FormControl>
                      <Input placeholder="Název výrobku" {...field} />
                    </FormControl>
                    <FormDescription>
                      Název výrobku i hmotnost v g!!
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
                    {/* <FormLabel>Kategorie výrobku</FormLabel> */}
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
                        {categories?.map(
                          (category: { id: number; name: string }) => (
                            <SelectItem
                              key={category.id}
                              value={category.id.toString()}
                            >
                              {category.name}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Vyberte kategorii výrobku.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardContent className="grid grid-cols-1 gap-2 py-2">
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
            </CardContent>
            <CardContent className="grid grid-cols-2 gap-2 py-2">
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
                name="priceBuyer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nákupní cena</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="Enter product price"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Cena výrobku v Kč bez DPH.
                    </FormDescription>
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
                name="vat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DPH</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      defaultValue={field.value.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Vyberte DPH" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">0%</SelectItem>
                        <SelectItem value="12">12%</SelectItem>

                        <SelectItem value="21">21%</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Sazba DPH v %.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardContent className="grid grid-cols-2 gap-2 py-2"></CardContent>
            <CardContent className="py-2">
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
            </CardContent>

            <CardFooter>
              <Button
                variant="outline"
                type="submit"
                disabled={insertProductMutation.isPending}
                className="w-full"
              >
                {insertProductMutation.isPending
                  ? "Vkládám..."
                  : "Vložit výrobek"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </>
  );
}
