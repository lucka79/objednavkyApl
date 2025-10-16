import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useIngredients } from "@/hooks/useIngredients";
import { useUsers } from "@/hooks/useProfiles";
// import { useAuthStore } from "@/lib/supabase";
import { Plus, Trash2, Package } from "lucide-react";
import { removeDiacritics } from "@/utils/removeDiacritics";

interface InvoiceItem {
  ingredient_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface InvoiceFormData {
  invoice_number: string;
  supplier_id: string;
  receiver_id: string;
  received_date: string;
  notes: string;
  items: InvoiceItem[];
}

const initialFormData: InvoiceFormData = {
  invoice_number: "",
  supplier_id: "",
  receiver_id: "e597fcc9-7ce8-407d-ad1a-fdace061e42f",
  received_date: new Date().toISOString().split("T")[0],
  notes: "",
  items: [],
};

function IngredientPickerModal({
  open,
  onClose,
  onPick,
  ingredients,
  supplierId,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (ingredientId: number, quantity: number, unitPrice: number) => void;
  ingredients: any[];
  supplierId?: string;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);

  const filtered = ingredients.filter((ing) =>
    removeDiacritics(ing.name)
      .toLowerCase()
      .includes(removeDiacritics(search).toLowerCase())
  );

  React.useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedId(null);
      setQuantity(1);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Focus quantity field when ingredient is selected
  React.useEffect(() => {
    if (selectedId && quantityRef.current) {
      setTimeout(() => quantityRef.current?.focus(), 100);
    }
  }, [selectedId]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Přidat surovinu</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            ref={inputRef}
            placeholder="Hledat surovinu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-60 overflow-y-auto border rounded">
            {filtered.length === 0 ? (
              <div className="p-4 text-muted-foreground text-center">
                Nenalezeno
              </div>
            ) : (
              <>
                <div className="px-3 py-2 bg-gray-50 border-b text-xs text-muted-foreground font-medium">
                  <div className="flex items-center gap-2">
                    <span className="w-1/2">Název</span>
                    <span className="w-1/4">Balení</span>
                    <span className="w-1/4">Cena</span>
                  </div>
                </div>
                <ul>
                  {filtered.map((ing) => {
                    const supplierPrice = ing.ingredient_supplier_codes?.find(
                      (code: any) => code.supplier_id === supplierId
                    )?.price;

                    return (
                      <li
                        key={ing.id}
                        className={`px-3 py-2 cursor-pointer hover:bg-orange-50 flex items-center gap-2 ${
                          selectedId === ing.id ? "bg-orange-100" : ""
                        }`}
                        onClick={() => setSelectedId(ing.id)}
                      >
                        <div className="flex-1 flex items-center gap-2">
                          <span className="font-medium w-1/2 truncate">
                            {ing.name}
                          </span>
                          <span className="text-blue-600 w-1/4 text-center">
                            {ing.package || "—"}
                          </span>
                          <span className="font-medium text-orange-500 w-1/4 text-right">
                            {supplierPrice
                              ? `${supplierPrice.toFixed(2)} Kč`
                              : "—"}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Input
              ref={quantityRef}
              type="number"
              min={0.001}
              step={0.001}
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter" && selectedId && quantity > 0) {
                  const ingredient = ingredients.find(
                    (ing) => ing.id === selectedId
                  );
                  const supplierPrice =
                    ingredient?.ingredient_supplier_codes?.find(
                      (code: any) => code.supplier_id === supplierId
                    )?.price || 0;

                  onPick(selectedId, quantity, supplierPrice);
                  onClose();
                }
              }}
              className="w-24 no-spinner [&::-moz-appearance]:textfield"
              placeholder="Množství"
              inputMode="decimal"
              disabled={!selectedId}
            />
            <Button
              type="button"
              onClick={() => {
                if (selectedId && quantity > 0) {
                  const ingredient = ingredients.find(
                    (ing) => ing.id === selectedId
                  );
                  const supplierPrice =
                    ingredient?.ingredient_supplier_codes?.find(
                      (code: any) => code.supplier_id === supplierId
                    )?.price || 0;

                  onPick(selectedId, quantity, supplierPrice);
                  onClose();
                }
              }}
              disabled={!selectedId || quantity <= 0}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Přidat
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Zrušit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AddReceivedInvoiceForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<InvoiceFormData>(initialFormData);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const { data: allIngredients } = useIngredients();
  const { data: allUsers } = useUsers();
  // const user = useAuthStore((state) => state.user);

  // Filter for store users only
  const storeUsers = allUsers?.filter((user) => user.role === "store") || [];

  // Filter for supplier users only
  const supplierUsers =
    allUsers?.filter((user) => user.role === "supplier") || [];

  // Filter ingredients by selected supplier using ingredient_supplier_codes
  const availableIngredients =
    allIngredients?.ingredients.filter((ingredient) => {
      if (!formData.supplier_id) return true;

      // Check if ingredient has supplier codes for the selected supplier
      return ingredient.ingredient_supplier_codes?.some(
        (code) => code.supplier_id === formData.supplier_id
      );
    }) || [];

  // For the picker modal, show all ingredients if no supplier is selected
  const pickerIngredients = formData.supplier_id
    ? availableIngredients
    : allIngredients?.ingredients || [];

  const addInvoiceMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      // Calculate total amount
      const total_amount = data.items.reduce(
        (sum, item) => sum + item.total_price,
        0
      );

      // Insert invoice using the correct field names for the existing database
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices_received")
        .insert({
          invoice_number: data.invoice_number,
          supplier_id: data.supplier_id,
          receiver_id: data.receiver_id,
          invoice_date: data.received_date,
          total_amount,
          supplier_name: null, // Will be populated from supplier lookup
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Insert items using the correct field names for the existing database
      if (data.items.length > 0) {
        const itemsData = data.items.map((item) => ({
          invoice_received_id: invoice.id,
          matched_ingredient_id: item.ingredient_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.total_price,
          unit_of_measure: null, // Will be populated from ingredient
          manual_match: true, // Mark as manually created
        }));

        const { error: itemsError } = await supabase
          .from("items_received")
          .insert(itemsData);

        if (itemsError) throw itemsError;
      }

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receivedInvoices"] });
      toast({
        title: "Úspěch",
        description: "Faktura byla úspěšně přidána",
      });
      handleClose();
    },
    onError: (warning) => {
      toast({
        title: "Chyba",
        description: warning.message,
        variant: "destructive",
      });
    },
  });

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.invoice_number.trim()) {
      errors.invoice_number = "Číslo faktury je povinné";
    }

    if (!formData.supplier_id) {
      errors.supplier_id = "Dodavatel je povinný";
    }

    if (!formData.receiver_id) {
      errors.receiver_id = "Příjemce je povinný";
    }

    if (!formData.received_date) {
      errors.received_date = "Datum přijetí je povinné";
    }

    if (formData.items.length === 0) {
      errors.items = "Faktura musí obsahovat alespoň jednu položku";
    }

    // Validate items
    formData.items.forEach((item, index) => {
      if (!item.ingredient_id) {
        errors[`item_${index}_ingredient`] = "Surovina je povinná";
      }
      if (item.quantity <= 0) {
        errors[`item_${index}_quantity`] = "Množství musí být větší než 0";
      }
      if (item.unit_price <= 0) {
        errors[`item_${index}_unit_price`] =
          "Jednotková cena musí být větší než 0";
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    addInvoiceMutation.mutate(formData);
  };

  const handleClose = () => {
    setIsOpen(false);
    setFormData(initialFormData);
    setValidationErrors({});
  };

  const handleInputChange = (field: keyof InvoiceFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleAddIngredient = (
    ingredientId: number,
    quantity: number,
    unitPrice: number
  ) => {
    // Find the ingredient to get supplier price
    const ingredient = allIngredients?.ingredients.find(
      (ing) => ing.id === ingredientId
    );
    const supplierPrice = ingredient?.ingredient_supplier_codes?.find(
      (code) => code.supplier_id === formData.supplier_id
    )?.price;

    const newItem: InvoiceItem = {
      ingredient_id: ingredientId,
      quantity: quantity,
      unit_price: supplierPrice || unitPrice, // Use supplier price if available, otherwise use entered price
      total_price: quantity * (supplierPrice || unitPrice),
    };
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  };

  const removeItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };

      // Recalculate total_price
      if (field === "quantity" || field === "unit_price") {
        newItems[index].total_price =
          newItems[index].quantity * newItems[index].unit_price;
      }

      return { ...prev, items: newItems };
    });
  };

  const getTotalAmount = () => {
    return formData.items.reduce((sum, item) => sum + item.total_price, 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-orange-600 hover:bg-orange-700">
          <Plus className="h-4 w-4 mr-2" />
          Přidat fakturu
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Přidat novou fakturu
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Základní informace</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice_number">Číslo faktury *</Label>
                  <Input
                    id="invoice_number"
                    value={formData.invoice_number}
                    onChange={(e) =>
                      handleInputChange("invoice_number", e.target.value)
                    }
                    placeholder="např. F2024-001"
                    className={
                      validationErrors.invoice_number ? "border-red-500" : ""
                    }
                  />
                  {validationErrors.invoice_number && (
                    <p className="text-sm text-red-500">
                      {validationErrors.invoice_number}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplier">Dodavatel *</Label>
                  <Select
                    value={formData.supplier_id}
                    onValueChange={(value) =>
                      handleInputChange("supplier_id", value)
                    }
                  >
                    <SelectTrigger
                      className={
                        validationErrors.supplier_id ? "border-red-500" : ""
                      }
                    >
                      <SelectValue placeholder="Vyberte dodavatele" />
                    </SelectTrigger>
                    <SelectContent>
                      {supplierUsers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {validationErrors.supplier_id && (
                    <p className="text-sm text-red-500">
                      {validationErrors.supplier_id}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="receiver">Příjemce *</Label>
                  <Select
                    value={formData.receiver_id}
                    onValueChange={(value) =>
                      handleInputChange("receiver_id", value)
                    }
                  >
                    <SelectTrigger
                      className={
                        validationErrors.receiver_id ? "border-red-500" : ""
                      }
                    >
                      <SelectValue placeholder="Vyberte příjemce" />
                    </SelectTrigger>
                    <SelectContent>
                      {storeUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {validationErrors.receiver_id && (
                    <p className="text-sm text-red-500">
                      {validationErrors.receiver_id}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="received_date">Datum přijetí *</Label>
                  <Input
                    id="received_date"
                    type="date"
                    value={formData.received_date}
                    onChange={(e) =>
                      handleInputChange("received_date", e.target.value)
                    }
                    className={
                      validationErrors.received_date ? "border-red-500" : ""
                    }
                  />
                  {validationErrors.received_date && (
                    <p className="text-sm text-red-500">
                      {validationErrors.received_date}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Poznámky</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  placeholder="Volitelné poznámky k faktuře..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Invoice Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Položky faktury</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPickerOpen(true)}
                  disabled={
                    !!formData.supplier_id && availableIngredients.length === 0
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Přidat surovinu
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {formData.supplier_id && availableIngredients.length === 0 ? (
                    <div>
                      <p>
                        Pro vybraného dodavatele nejsou k dispozici žádné
                        suroviny.
                      </p>
                      <p className="text-sm mt-2">
                        Zkuste vybrat jiného dodavatele nebo přidejte kódy
                        dodavatele pro suroviny.
                      </p>
                    </div>
                  ) : (
                    <p>
                      Žádné suroviny. Klikněte na "Přidat surovinu" pro začátek.
                    </p>
                  )}
                </div>
              ) : (
                <div className="border rounded-md">
                  <div className="px-3 py-2 bg-gray-50 border-b text-xs text-muted-foreground font-medium">
                    <div className="grid grid-cols-12 gap-4">
                      <span className="col-span-3">Surovina</span>
                      <span className="col-span-1 text-center">Balení</span>
                      <span className="col-span-2 text-right">Množství</span>
                      <span className="col-span-2 text-right">
                        Jednotková cena
                      </span>
                      <span className="col-span-3 text-right pr-6">
                        Celková cena
                      </span>
                      <span className="col-span-1 text-right">Akce</span>
                    </div>
                  </div>
                  <div className="divide-y">
                    {formData.items.map((item, index) => {
                      const ingredient = allIngredients?.ingredients.find(
                        (ing) => ing.id === item.ingredient_id
                      );

                      return (
                        <div key={index} className="px-3 py-2 hover:bg-gray-50">
                          <div className="grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-3 font-medium">
                              {ingredient?.name || "Neznámá surovina"}
                            </div>
                            <div className="col-span-1 text-center text-sm text-blue-600">
                              <div>{ingredient?.package || "—"}</div>
                              <div className="text-xs text-muted-foreground">
                                {ingredient?.unit || ""}
                              </div>
                            </div>
                            <div className="col-span-2 pr-2">
                              <Input
                                type="number"
                                step="0.001"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItem(
                                    index,
                                    "quantity",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                placeholder="0.000"
                                className="w-full no-spinner text-right"
                              />
                            </div>
                            <div className="col-span-2 pl-2">
                              <Input
                                type="number"
                                step="0.01"
                                value={item.unit_price}
                                onChange={(e) =>
                                  updateItem(
                                    index,
                                    "unit_price",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                placeholder="0.00"
                                className="w-full no-spinner text-right"
                              />
                            </div>
                            <div className="col-span-3 text-right font-medium pr-6">
                              {item.total_price.toFixed(2)} Kč
                            </div>
                            <div className="col-span-1 flex justify-end gap-1 pl-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(index)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {validationErrors.items && (
                <p className="text-sm text-red-500">{validationErrors.items}</p>
              )}

              {/* Total Amount */}
              <div className="flex justify-end">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-sm text-green-700">Celková částka</div>
                  <div className="text-2xl font-bold text-green-800">
                    {getTotalAmount().toFixed(2)} Kč
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleClose}>
              Zrušit
            </Button>
            <Button
              type="submit"
              disabled={addInvoiceMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {addInvoiceMutation.isPending ? "Ukládám..." : "Přidat fakturu"}
            </Button>
          </div>
        </form>
        <IngredientPickerModal
          open={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          onPick={handleAddIngredient}
          ingredients={pickerIngredients}
          supplierId={formData.supplier_id}
        />
      </DialogContent>
    </Dialog>
  );
}
