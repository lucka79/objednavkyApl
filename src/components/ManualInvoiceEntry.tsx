import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useIngredientStore } from "@/stores/ingredientStore";
import { Plus, Trash2, Calculator } from "lucide-react";

interface InvoiceItem {
  id: string;
  ingredientId: number;
  ingredientName: string;
  quantity: number;
  unit: string;
  price: number;
  total: number;
  supplierCode?: string;
}

interface ManualInvoiceData {
  supplier: string;
  invoiceNumber: string;
  date: string;
  totalAmount: number;
  items: InvoiceItem[];
}

interface ManualInvoiceEntryProps {
  supplierId: string;
  onSave: (invoiceData: ManualInvoiceData) => void;
  onCancel: () => void;
}

export function ManualInvoiceEntry({
  supplierId,
  onSave,
  onCancel,
}: ManualInvoiceEntryProps) {
  const { ingredients, fetchIngredients } = useIngredientStore();
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [selectedIngredient, setSelectedIngredient] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [price, setPrice] = useState<string>("");

  // Load ingredients on mount
  useEffect(() => {
    fetchIngredients();
  }, [fetchIngredients]);

  // Get supplier name - simplified for now
  const supplierName =
    supplierId === "pesek-rambousek" ? "Pešek - Rambousek" : "Dodavatel";

  // Add new item
  const handleAddItem = () => {
    if (!selectedIngredient || !quantity || !price) return;

    const ingredient = ingredients?.find(
      (ing: any) => ing.id.toString() === selectedIngredient
    );
    if (!ingredient) return;

    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      quantity: parseFloat(quantity),
      unit: ingredient.unit,
      price: parseFloat(price),
      total: parseFloat(quantity) * parseFloat(price),
    };

    setItems([...items, newItem]);
    setSelectedIngredient("");
    setQuantity("");
    setPrice("");
  };

  // Remove item
  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter((item) => item.id !== itemId));
  };

  // Calculate total
  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

  // Save invoice
  const handleSave = () => {
    if (items.length === 0) return;

    const invoiceData: ManualInvoiceData = {
      supplier: supplierName,
      invoiceNumber: invoiceNumber || `MAN-${Date.now()}`,
      date: invoiceDate,
      totalAmount,
      items,
    };

    onSave(invoiceData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manuální zadání faktury - {supplierName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invoice Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="invoice-number">Číslo faktury</Label>
            <Input
              id="invoice-number"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Zadejte číslo faktury"
            />
          </div>
          <div>
            <Label htmlFor="invoice-date">Datum faktury</Label>
            <Input
              id="invoice-date"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Badge variant="outline" className="text-lg font-semibold">
              Celkem: {totalAmount.toFixed(2)} Kč
            </Badge>
          </div>
        </div>

        {/* Add New Item */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Přidat položku</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="ingredient-select">Surovina</Label>
                <Select
                  value={selectedIngredient}
                  onValueChange={setSelectedIngredient}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte surovinu" />
                  </SelectTrigger>
                  <SelectContent>
                    {ingredients?.map((ingredient: any) => (
                      <SelectItem
                        key={ingredient.id}
                        value={ingredient.id.toString()}
                      >
                        {ingredient.name} ({ingredient.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="quantity">Množství</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="price">Cena za jednotku</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleAddItem} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Přidat
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items Table */}
        {items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Položky faktury</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Surovina</TableHead>
                    <TableHead className="text-right">Množství</TableHead>
                    <TableHead>Jednotka</TableHead>
                    <TableHead className="text-right">Cena</TableHead>
                    <TableHead className="text-right">Celkem</TableHead>
                    <TableHead className="text-right">Akce</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.ingredientName}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.quantity}
                      </TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right">
                        {item.price.toFixed(2)} Kč
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {item.total.toFixed(2)} Kč
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>
            Zrušit
          </Button>
          <Button
            onClick={handleSave}
            disabled={items.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            <Calculator className="h-4 w-4 mr-2" />
            Uložit fakturu
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
