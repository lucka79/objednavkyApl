import React, { useState, useRef, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Package, FileText, ArrowRightLeft } from "lucide-react";
import { useCreateTransfer, TransferInsert } from "@/hooks/useTransfers";
import { useIngredients } from "@/hooks/useIngredients";
import { useUsers } from "@/hooks/useProfiles";
import { useAuthStore } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { removeDiacritics } from "@/utils/removeDiacritics";

interface TransferItem {
  ingredient_id: number;
  quantity: number;
}

interface TransferFormProps {
  onSuccess?: () => void;
}

function IngredientPickerModal({
  open,
  onClose,
  onPick,
  ingredients,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (ingredientId: number, quantity: number) => void;
  ingredients: any[];
  categories: any[];
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = ingredients.filter((ing) =>
    removeDiacritics(ing.name)
      .toLowerCase()
      .includes(removeDiacritics(search).toLowerCase())
  );

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedId(null);
      setQuantity(1);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

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
              <ul>
                {filtered.map((ing) => {
                  const category = categories.find(
                    (cat) => cat.id === ing.category_id
                  );
                  const categoryName = category
                    ? category.name
                    : "Uncategorized";

                  return (
                    <li
                      key={ing.id}
                      className={`px-3 py-2 cursor-pointer hover:bg-orange-50 rounded flex items-center gap-2 ${selectedId === ing.id ? "bg-orange-100" : ""}`}
                      onClick={() => setSelectedId(ing.id)}
                    >
                      <div className="flex-1">
                        <span className="font-medium">{ing.name}</span>
                        <div className="text-xs text-muted-foreground">
                          {categoryName} • Balení:
                          {ing.package && `  ${ing.package}`} {ing.unit}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0.001}
              step={0.001}
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
              onFocus={(e) => e.target.select()}
              className="w-24 no-spinner"
              placeholder="Množství"
              inputMode="decimal"
              disabled={!selectedId}
            />
            <Button
              type="button"
              onClick={() => {
                if (selectedId && quantity > 0) {
                  onPick(selectedId, quantity);
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

export default function TransferForm({ onSuccess }: TransferFormProps) {
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [senderId, setSenderId] = useState<string>("");
  const [receiverId, setReceiverId] = useState<string>("");
  const [transferDate, setTransferDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const { data: ingredientsData } = useIngredients();
  const { data: profiles = [] } = useUsers();

  const ingredients = ingredientsData?.ingredients || [];
  const categories = ingredientsData?.categories || [];
  const createTransfer = useCreateTransfer();

  // Filter profiles to show only store users
  const availableReceivers = profiles.filter(
    (profile) =>
      profile.id !== user?.id &&
      profile.id !== senderId &&
      profile.role === "store"
  );

  // Available senders (store users and expedition)
  const availableSenders = profiles.filter((profile) =>
    ["store"].includes(profile.role)
  );

  // Set default sender to the store user
  useEffect(() => {
    if (!senderId) {
      setSenderId("e597fcc9-7ce8-407d-ad1a-fdace061e42f");
    }
  }, [senderId]);

  // Ingredient management functions
  const removeTransferItem = (index: number) => {
    setTransferItems(transferItems.filter((_, i) => i !== index));
  };

  const updateTransferItem = (
    index: number,
    field: keyof TransferItem,
    value: any
  ) => {
    setTransferItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleAddIngredient = (ingredientId: number, quantity: number) => {
    setTransferItems((prev) => [
      ...prev,
      {
        ingredient_id: ingredientId,
        quantity,
      },
    ]);
  };

  // Calculate totals
  const calculateTotals = () => {
    let totalWeight = 0;
    let totalPrice = 0;

    transferItems.forEach((item) => {
      if (item.ingredient_id && item.quantity > 0) {
        const ingredient = ingredients.find(
          (ing) => ing.id === item.ingredient_id
        );
        if (ingredient) {
          const weightInKg = item.quantity * ingredient.kiloPerUnit;
          totalWeight += weightInKg;

          if (ingredient.price) {
            totalPrice += weightInKg * ingredient.price;
          }
        }
      }
    });

    return { totalWeight, totalPrice };
  };

  const { totalWeight, totalPrice } = calculateTotals();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!senderId) {
      toast({
        title: "Chyba",
        description: "Prosím vyberte odesílatele",
        variant: "destructive",
      });
      return;
    }

    if (!receiverId) {
      toast({
        title: "Chyba",
        description: "Prosím vyberte příjemce",
        variant: "destructive",
      });
      return;
    }

    if (transferItems.length === 0) {
      toast({
        title: "Chyba",
        description: "Prosím přidejte alespoň jednu položku",
        variant: "destructive",
      });
      return;
    }

    const validItems = transferItems.filter(
      (item) => item.ingredient_id > 0 && item.quantity > 0
    );

    if (validItems.length === 0) {
      toast({
        title: "Chyba",
        description: "Prosím přidejte platné položky transferu",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const transferData: TransferInsert = {
        date: transferDate,
        sender_id: senderId,
        receiver_id: receiverId,
        transfer_items: validItems.map((item) => ({
          ...item,
          transfer_id: 0,
        })),
      };

      await createTransfer.mutateAsync(transferData);

      toast({
        title: "Úspěch",
        description: "Převod surovin byl úspěšně vytvořen",
      });

      // Reset form
      setSenderId("e597fcc9-7ce8-407d-ad1a-fdace061e42f");
      setReceiverId("");
      setTransferDate(new Date().toISOString().split("T")[0]);
      setTransferItems([]);
      setIsOpen(false);

      onSuccess?.();
    } catch (error) {
      console.error("Error creating transfer:", error);
      toast({
        title: "Chyba",
        description:
          "Nepodařilo se vytvořit převod surovin. Zkuste to prosím znovu.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setIsOpen(false);
      setSenderId("e597fcc9-7ce8-407d-ad1a-fdace061e42f");
      setReceiverId("");
      setTransferItems([]);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Vytvořit převod surovin
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Nový převod surovin
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Informace o převodu surovin
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="receiver">Příjemce *</Label>
                    <Select value={receiverId} onValueChange={setReceiverId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Vyberte příjemce" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableReceivers.map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.full_name || profile.username} (
                            {profile.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date">Datum převodu surovin </Label>
                    <Input
                      id="date"
                      type="date"
                      value={transferDate}
                      onChange={(e) => setTransferDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Sender Selection */}
                <div className="space-y-2">
                  <Label htmlFor="sender">Odesílatel</Label>
                  <Select value={senderId} onValueChange={setSenderId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte odesílatele" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSenders.map((sender) => (
                        <SelectItem key={sender.id} value={sender.id}>
                          <div className="flex items-center gap-2">
                            <span>{sender.full_name || sender.username}</span>
                            <Badge variant="outline" className="text-xs">
                              {sender.role}
                            </Badge>
                            {sender.id ===
                              "e597fcc9-7ce8-407d-ad1a-fdace061e42f" && (
                              <Badge variant="secondary" className="text-xs">
                                Výchozí
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Transfer Items Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Položky převodu surovin
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsPickerOpen(true)}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    <Plus className="h-4 w-4" />
                    Přidat položku
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 bg-orange-50/50 rounded-lg p-4 border border-orange-100">
                {transferItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Zatím nejsou přidány žádné položky</p>
                    <p className="text-sm">
                      Klikněte na "Přidat položku" pro začátek
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="hidden md:grid grid-cols-12 gap-2 px-2 pb-2 text-xs font-semibold text-orange-900/80">
                      <div className="col-span-3">Surovina</div>
                      <div className="col-span-2">Množství</div>
                      <div className="col-span-1">Jednotka</div>
                      <div className="col-span-2 text-right">Hmotnost (kg)</div>
                      <div className="col-span-2 text-right">Cena</div>
                      <div className="col-span-2">Kategorie</div>
                      <div className="col-span-1">Akce</div>
                    </div>
                    <div className="space-y-2">
                      {transferItems
                        .slice()
                        .sort((a, b) => {
                          const ingredientA = ingredients.find(
                            (ing) => ing.id === a.ingredient_id
                          );
                          const ingredientB = ingredients.find(
                            (ing) => ing.id === b.ingredient_id
                          );

                          // Move ingredients with unit "L" or "l" to bottom
                          const isLiterA =
                            ingredientA?.unit?.toLowerCase() === "l";
                          const isLiterB =
                            ingredientB?.unit?.toLowerCase() === "l";

                          if (isLiterA && !isLiterB) return 1;
                          if (!isLiterA && isLiterB) return -1;

                          // Sort by quantity (descending) within the same unit type
                          return b.quantity - a.quantity;
                        })
                        .map((item, index) => {
                          const selectedIngredient = ingredients.find(
                            (ing) => ing.id === item.ingredient_id
                          );
                          // const category = categories.find(
                          //   (cat) => cat.id === selectedIngredient?.category_id
                          // );

                          return (
                            <div
                              key={index}
                              className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-white/80 rounded border border-orange-100 px-2 py-2 shadow-sm"
                            >
                              <div className="md:col-span-3 font-medium truncate">
                                {selectedIngredient ? (
                                  <div className="flex items-center gap-2">
                                    <span>{selectedIngredient.name}</span>
                                    {selectedIngredient.element &&
                                      selectedIngredient.element.trim() !==
                                        "" && (
                                        <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                      )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">
                                    (neznámá surovina)
                                  </span>
                                )}
                              </div>
                              <div className="md:col-span-2 flex items-center gap-2">
                                <Input
                                  type="number"
                                  step="0.001"
                                  value={
                                    item.quantity === 0 ? "" : item.quantity
                                  }
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === "") {
                                      updateTransferItem(index, "quantity", 0);
                                    } else {
                                      const numValue = parseFloat(value);
                                      if (!isNaN(numValue) && numValue >= 0) {
                                        updateTransferItem(
                                          index,
                                          "quantity",
                                          numValue
                                        );
                                      }
                                    }
                                  }}
                                  className={`mt-1 w-24 appearance-none no-spinner ${
                                    user?.role !== "expedition" &&
                                    user?.role !== "admin"
                                      ? "bg-gray-100 cursor-not-allowed"
                                      : ""
                                  }`}
                                  placeholder="0"
                                  disabled={
                                    user?.role !== "expedition" &&
                                    user?.role !== "admin"
                                  }
                                />
                              </div>
                              <div className="md:col-span-1 text-sm text-muted-foreground">
                                {selectedIngredient
                                  ? selectedIngredient.unit
                                  : ""}
                              </div>
                              <div className="md:col-span-2 text-right text-sm text-orange-900/80 font-semibold">
                                {selectedIngredient && item.quantity > 0
                                  ? `${(item.quantity * selectedIngredient.kiloPerUnit).toFixed(3)} kg`
                                  : "0.000 kg"}
                              </div>
                              <div className="md:col-span-2 text-right text-sm text-orange-900/80 font-semibold">
                                {selectedIngredient &&
                                selectedIngredient.price &&
                                item.quantity > 0
                                  ? `${(item.quantity * selectedIngredient.kiloPerUnit * selectedIngredient.price).toFixed(2)} Kč`
                                  : "0.00 Kč"}
                              </div>
                              {/* <div className="md:col-span-2">
                                <Badge variant="outline" className="text-xs">
                                  {category ? category.name : "Uncategorized"}
                                </Badge>
                              </div> */}
                              <div className="md:col-span-1 flex justify-end items-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeTransferItem(index)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Calculation Summary */}
                {transferItems.length > 0 && (
                  <div className="mt-6 p-4 bg-orange-100 border border-orange-200 rounded-md">
                    <h4 className="font-semibold text-orange-800 mb-2">
                      Souhrn převodu surovin
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">
                          Celková hmotnost:
                        </span>
                        <div className="font-semibold">
                          {totalWeight.toFixed(3)} kg
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Celková hodnota:
                        </span>
                        <div className="font-semibold">
                          {totalPrice.toFixed(2)} Kč
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Počet položek:
                        </span>
                        <div className="font-semibold">
                          {transferItems.length} položek
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Zrušit
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting || !receiverId || transferItems.length === 0
                }
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isSubmitting ? "Vytváření..." : "Vytvořit objednávku"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <IngredientPickerModal
        open={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onPick={handleAddIngredient}
        ingredients={ingredients}
        categories={categories}
      />
    </>
  );
}
