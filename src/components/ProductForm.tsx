"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import { fetchProductById } from "@/hooks/useProducts";
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
import { defaultProductImage } from "@/constants/Images";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import imageCompression from "browser-image-compression";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardFooter } from "./ui/card";
import { Loader2 } from "lucide-react";
import RemoteImage from "./RemoteImage";
import { Switch } from "@/components/ui/switch";

const productSchema = z.object({
  name: z.string().min(3, "Product name is required"),
  nameVi: z
    .string()
    .nullable()
    .transform((val) => val || ""),
  description: z.string().min(0, "Product description is required"),
  price: z.number().min(0, "Cena musí být větší než 0"),
  priceBuyer: z.number().min(0, "Cena musí být větší než 0"),
  priceMobil: z.number().min(0, "Mobilní cena musí být nezáporná"),
  vat: z.number().min(0, "DPH musí být nezáporná"),
  category_id: z.number().min(1, "Kategorie musí být vybrána"),
  image: z.union([z.instanceof(File), z.string()]).optional(),
  active: z.boolean().default(true),
  // store: z.boolean().default(false),
  // buyer: z.boolean().default(false),
  code: z
    .string()
    .nullable()
    .transform((val) => val || ""), // Transform null to empty string
  isChild: z.boolean().default(false),

  printId: z.number().nullable().optional(),
  koef: z.number().min(0, "Koeficient musí být nezáporný").default(1),
});

type ProductFormValues = z.infer<typeof productSchema>;
type ProductUpdateValues = Omit<ProductFormValues, "image"> & {
  id: number;
  image?: string | File | null;
};

interface ProductFormProps {
  onClose: () => void;
  productId?: number;
}

const updateProduct = async (data: ProductUpdateValues) => {
  console.log("Updating product with data:", data);
  const { error, data: updatedProduct } = await supabase
    .from("products")
    .update(data)
    .eq("id", data.id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("Error updating product:", error);
    throw new Error(error.message);
  }

  console.log("Product updated successfully:", updatedProduct);
  return updatedProduct;
};

const fetchParentProducts = async () => {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("isChild", false)
    .order("name");

  if (error) throw error;
  return data;
};

export function ProductForm({ onClose, productId }: ProductFormProps) {
  if (!productId || isNaN(Number(productId))) {
    console.error("ProductForm requires a valid productId");
    onClose();
    return null;
  }

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: categories, isLoading: categoriesLoading } = fetchCategories();
  const { data: product, isLoading: productLoading } = fetchProductById(
    productId,
    {
      enabled: true, // Always fetch since we know productId exists
    }
  );

  const { data: parentProducts } = useQuery({
    queryKey: ["parentProducts"],
    queryFn: fetchParentProducts,
  });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      nameVi: "",
      description: "",
      price: 0,
      priceBuyer: 0,
      priceMobil: 0,
      vat: 12,
      category_id: 1,
      active: true,

      code: "",
      isChild: false,

      printId: null,
      koef: 1,
    },
  });

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        nameVi: product.nameVi,
        description: product.description,
        price: product.price,
        priceBuyer: product.priceBuyer,
        priceMobil: product.priceMobil,
        vat: product.vat,
        category_id: product.category_id,
        active: product.active,

        code: product.code,
        isChild: product.isChild ?? false,

        printId: product.printId ?? null,
        koef: product.koef ?? 1,
      });
    }
  }, [product, form]);

  const productMutation = useMutation({
    mutationFn: (data: ProductUpdateValues) =>
      updateProduct(data as ProductUpdateValues),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({
        queryKey: ["product", productId],
      });
      navigate({ to: "/admin/create" });
      toast({
        title: "Výrobek aktualizován",
        description: "Výrobek byl úspěšně aktualizován.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Při aktualizaci výrobku nastala chyba. Zkuste to znovu.`,
        variant: "destructive",
      });
      console.error(`Chyba při aktualizaci výrobku:`, error);
    },
  });

  const onSubmit = async (data: ProductFormValues) => {
    try {
      // Set printId to productId if isChild is false
      const updatedData = {
        ...data,
        printId: data.isChild ? data.printId : productId,
      };

      if (data.image instanceof File) {
        // Compression of image
        const compressedImage = await imageCompression(data.image, {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
        });
        const arrayBuffer = await compressedImage.arrayBuffer();
        const filePath = `${crypto.randomUUID()}.png`; // `/slozka/${crypto.randomUUID()}.png`;
        const contentType = "image/png";

        const { data: dataImage, error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(filePath, arrayBuffer, {
            contentType,
            upsert: false,
          });

        if (uploadError) throw uploadError;
        if (dataImage) {
          productMutation.mutate({
            ...updatedData,
            id: productId,
            image: dataImage.path,
          });
        }
      } else {
        productMutation.mutate({ ...updatedData, id: productId });
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

  if (categoriesLoading || productLoading)
    return (
      <div>
        <Loader2 />
      </div>
    );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <div tabIndex={-1} />
        <DialogHeader>
          <DialogTitle>
            {productId ? "Upravit výrobek" : "Nový výrobek"}
          </DialogTitle>
        </DialogHeader>

        <Card className="relative w-[480px] mx-auto justify-center border-none">
          {/* <CardContent> */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1">
              <CardContent className="grid grid-cols-2 gap-2 py-2">
                <FormField
                  control={form.control}
                  name="image"
                  render={({ field: { onChange, value, ...field } }) => (
                    <FormItem>
                      {/* <FormLabel>Obrázek</FormLabel> */}
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
                <RemoteImage
                  path={product?.image}
                  fallback={defaultProductImage}
                />
              </CardContent>
              <CardContent className="grid grid-cols-1 gap-2 py-2">
                <div className="grid grid-cols-[2fr,1fr] gap-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
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
                    name="koef"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.5"
                            placeholder="Koeficient"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormDescription>Koeficient výrobku</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
              <CardContent className="grid grid-cols-1 gap-2 py-2">
                <FormField
                  control={form.control}
                  name="nameVi"
                  render={({ field }) => (
                    <FormItem>
                      {/* <FormLabel>Name</FormLabel> */}
                      <FormControl>
                        <Input placeholder="Vietnam název výrobku" {...field} />
                      </FormControl>
                      <FormDescription>
                        Název výrobku i hmotnost v g!!
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardContent className="grid grid-cols-2 gap-2 py-1">
                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      {/* <FormLabel>Kategorie výrobku</FormLabel> */}
                      <Select
                        onValueChange={(value) =>
                          field.onChange(parseInt(value))
                        }
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
                      {/* <FormDescription>
                      Vyberte kategorii výrobku.
                    </FormDescription> */}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      {/* <FormLabel>Name</FormLabel> */}
                      <FormControl>
                        <Input placeholder="Kód výrobku" {...field} />
                      </FormControl>
                      {/* <FormDescription>Kód výrobku</FormDescription> */}
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
                      {/* <FormLabel>Description</FormLabel> */}
                      <FormControl>
                        <Textarea
                          placeholder="Krátký popis ..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      {/* <FormDescription>Krátký popis výrobku.</FormDescription> */}
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
                      <FormDescription>
                        Cena výrobku v Kč s DPH.
                      </FormDescription>
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
                          step="0.01"
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
                      <FormDescription>
                        Cena výrobku v Kč s DPH.
                      </FormDescription>
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
                        onValueChange={(value) =>
                          field.onChange(parseInt(value))
                        }
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
              <CardContent className="grid grid-cols-2 gap-2 py-1">
                <FormField
                  control={form.control}
                  name="isChild"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Podřízený výrobek
                        </FormLabel>
                        <FormDescription>
                          Označte, pokud má tento výrobek nadřazený výrobek
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {form.watch("isChild") && (
                  <>
                    <FormField
                      control={form.control}
                      name="printId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nadřazený výrobek</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              const parentProduct = parentProducts?.find(
                                (p) => p.id === parseInt(value)
                              );
                              const printIdToUse =
                                parentProduct?.printId ?? field.value;
                              field.onChange(printIdToUse);
                            }}
                            defaultValue={parentProducts
                              ?.find((p) => p.printId === field.value)
                              ?.id.toString()}
                            onOpenChange={() => setSearchQuery("")}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={
                                    parentProducts?.find(
                                      (p) => p.printId === field.value
                                    )?.name || "Vyberte nadřazený výrobek"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <Input
                                placeholder="Hledat produkt..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="sticky top-0 bg-background z-10 border-orange-600 hover:border-orange-600 focus-visible:ring-orange-600 mx-2 w-[calc(100%-16px)] pr-8"
                                onKeyDown={(e) => e.stopPropagation()}
                              />
                              {searchQuery && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-3 top-1.5 h-6 w-6 p-0"
                                  onClick={() => setSearchQuery("")}
                                >
                                  ×
                                </Button>
                              )}
                              {parentProducts
                                ?.filter((product) =>
                                  product.name
                                    .toLowerCase()
                                    .includes(searchQuery.toLowerCase())
                                )
                                .map((product) => (
                                  <SelectItem
                                    key={product.id}
                                    value={product.id.toString()}
                                  >
                                    {product.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {parentProducts?.find(
                              (p) => p.id === Number(field.value)
                            )
                              ? `Parent Print ID: ${
                                  parentProducts.find(
                                    (p) => p.printId === field.value
                                  )?.printId ?? field.value
                                } | New Print ID: ${form.watch("printId")}`
                              : "Nové Print ID: " + form.watch("printId")}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </CardContent>

              <CardFooter>
                <Button
                  variant="outline"
                  type="submit"
                  disabled={productMutation.isPending}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {productMutation.isPending ? "Ukládám..." : "Uložit změny"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
