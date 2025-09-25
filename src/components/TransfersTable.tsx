import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Trash2,
  Search,
  Calendar,
  User,
  Package,
  ArrowRightLeft,
  Printer,
  Plus,
} from "lucide-react";
import {
  useTransfers,
  useDeleteTransfer,
  useUpdateTransferItem,
  useAddTransferItem,
  Transfer,
} from "@/hooks/useTransfers";
import { useIngredients } from "@/hooks/useIngredients";
import { removeDiacritics } from "@/utils/removeDiacritics";
import { useAuthStore } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

interface TransferDetailsDialogProps {
  transfer: Transfer | null;
  isOpen: boolean;
  onClose: () => void;
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
            <div className="flex flex-col gap-1">
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
              <span className="text-xs text-muted-foreground">
                Množství zadejte v kilogramech
              </span>
            </div>
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

function TransferDetailsDialog({
  transfer,
  isOpen,
  onClose,
}: TransferDetailsDialogProps) {
  const { user } = useAuthStore();
  const updateTransferItem = useUpdateTransferItem();
  const addTransferItem = useAddTransferItem();
  const { data: ingredientsData } = useIngredients();
  const [savingItem, setSavingItem] = useState<number | null>(null);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(
    transfer
  );

  if (!transfer) return null;

  // Check if user can edit (expedition or admin)
  const canEdit = user?.role === "expedition" || user?.role === "admin";

  const ingredients = ingredientsData?.ingredients || [];
  const categories = ingredientsData?.categories || [];

  // Handle quantity change and save
  const queryClient = useQueryClient();

  const handleQuantityChange = async (itemId: number, quantity: number) => {
    try {
      setSavingItem(itemId);
      await updateTransferItem.mutateAsync({
        id: itemId,
        updatedFields: { quantity },
      });
      setNeedsRefresh(true);
      // Invalidate and refetch transfers query to get updated data
      await queryClient.invalidateQueries({ queryKey: ["transfers"] });
    } catch (error) {
      console.error("Error updating quantity:", error);
      toast({
        title: "Chyba",
        description:
          "Nepodařilo se aktualizovat množství. Zkuste to prosím znovu.",
        variant: "destructive",
      });
    } finally {
      setSavingItem(null);
    }
  };

  // Handle adding new item to transfer
  const handleAddItem = async (ingredientId: number, quantity: number) => {
    try {
      await addTransferItem.mutateAsync({
        transfer_id: transfer.id,
        ingredient_id: ingredientId,
        quantity: quantity,
      });
      setNeedsRefresh(true);
      // Invalidate and refetch transfers query to get updated data
      await queryClient.invalidateQueries({ queryKey: ["transfers"] });

      toast({
        title: "Úspěch",
        description: "Položka byla úspěšně přidána do převodu",
      });
    } catch (error) {
      console.error("Error adding item:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se přidat položku. Zkuste to prosím znovu.",
        variant: "destructive",
      });
    }
  };

  // Handle print transfer details
  const handlePrint = () => {
    // Add a small delay to ensure the dialog is fully rendered
    setTimeout(() => {
      // Create a new window for printing
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        const dialogContent = document.querySelector('[role="dialog"]');
        if (dialogContent) {
          printWindow.document.write(`
            <html>
              <head>
                 <title>Převod #${selectedTransfer?.id || transfer.id}</title>
                <style>
                  body { font-family: Arial, sans-serif; margin: 20px; }
                  .print-container { max-width: none; }
                  .card { border: 1px solid #ccc; margin: 10px 0; padding: 15px; }
                  .card-header { font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 10px 0; }
                  .grid-item { margin: 5px 0; }
                  .label { font-weight: bold; color: #666; font-size: 12px; }
                  .value { font-size: 14px; }
                  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                  th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                  th { background-color: #f5f5f5; font-weight: bold; }
                  .text-right { text-align: right; }
                  .text-center { text-align: center; }
                  .badge { background-color: #e5e5e5; padding: 2px 6px; border-radius: 3px; font-size: 11px; }
                  .category-section { margin: 15px 0; }
                  .category-title { font-weight: bold; margin: 10px 0 5px 0; }
                </style>
              </head>
              <body>
                <div class="print-container">
                   <h1>Detaily převodu #${selectedTransfer?.id || transfer.id}</h1>
                  
                  <div class="card">
                    <div class="card-header">Informace o převodu</div>
                    <div class="grid">
                      <div class="grid-item">
                        <div class="label">Datum</div>
                         <div class="value">${format(new Date(selectedTransfer?.date || transfer.date), "PPP", { locale: cs })}</div>
                      </div>
                      <div class="grid-item">
                        <div class="label">Odesílatel</div>
                        <div class="value">${selectedTransfer?.sender.full_name || selectedTransfer?.sender.username || transfer.sender.full_name || transfer.sender.username} (${selectedTransfer?.sender.role || transfer.sender.role})</div>
                      </div>
                      <div class="grid-item">
                        <div class="label">Příjemce</div>
                        <div class="value">${selectedTransfer?.receiver.full_name || selectedTransfer?.receiver.username || transfer.receiver.full_name || transfer.receiver.username} (${selectedTransfer?.receiver.role || transfer.receiver.role})</div>
                      </div>
                    </div>
                  </div>

                  <div class="card">
                    <div class="card-header">Převody surovin (${selectedTransfer?.transfer_items.length || transfer.transfer_items.length}) - Celkem: ${totalWeight.toFixed(3)} kg</div>
                    ${Object.entries(groupedItems)
                      .map(
                        ([categoryName, items]) => `
                      <div class="category-section">
                        <div class="category-title">${categoryName} (${items.length} položek)</div>
                        <table>
                          <thead>
                            <tr>
                              <th>Surovina</th>
                              <th>Jednotka</th>
                              <th class="text-right">Množství</th>
                              <th class="text-right">Hmotnost (kg)</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${items
                              .map(
                                (item) => `
                              <tr>
                                <td>${item.ingredient.name}</td>
                                <td><span class="badge">${item.ingredient.unit}</span></td>
                                <td class="text-right">${item.quantity}</td>
                                <td class="text-right">${(item.quantity * item.ingredient.kiloPerUnit).toFixed(3)}</td>
                              </tr>
                            `
                              )
                              .join("")}
                          </tbody>
                        </table>
                      </div>
                    `
                      )
                      .join("")}
                  </div>
                </div>
              </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.print();
          printWindow.close();
        }
      }
    }, 100);
  };

  // Group transfer items by ingredient category
  const groupedItems = (selectedTransfer || transfer).transfer_items.reduce(
    (acc, item) => {
      const categoryName =
        (item.ingredient as any).ingredient_categories?.name || "Uncategorized";

      if (!acc[categoryName]) {
        acc[categoryName] = [];
      }
      acc[categoryName].push(item);
      return acc;
    },
    {} as Record<string, typeof transfer.transfer_items>
  );

  // Calculate total weight
  const totalWeight = (selectedTransfer || transfer).transfer_items.reduce(
    (sum, item) => {
      return sum + item.quantity * item.ingredient.kiloPerUnit;
    },
    0
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto print:max-w-none print:h-auto print:overflow-visible">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Detaily převodu #{transfer.id}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 print:space-y-4">
          {/* Transfer Info */}
          <Card className="print:shadow-none print:border-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                Informace o převodu
              </CardTitle>
              {needsRefresh ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const updatedTransfers = await queryClient.fetchQuery<
                        Transfer[]
                      >({
                        queryKey: ["transfers"],
                      });
                      const updatedTransfer = updatedTransfers.find(
                        (t) => t.id === transfer.id
                      );
                      if (updatedTransfer) {
                        setSelectedTransfer(updatedTransfer);
                        setNeedsRefresh(false);
                        toast({
                          title: "Úspěch",
                          description: "Data byla aktualizována",
                        });
                      }
                    } catch (error) {
                      console.error("Error refreshing data:", error);
                      toast({
                        title: "Chyba",
                        description:
                          "Nepodařilo se aktualizovat data. Zkuste to prosím znovu.",
                        variant: "destructive",
                      });
                    }
                  }}
                  className="flex items-center gap-2 print:hidden"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  Aktualizovat
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="flex items-center gap-2 print:hidden"
                >
                  <Printer className="h-4 w-4" />
                  Tisknout
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Datum
                  </Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      {format(new Date(transfer.date), "PPP", { locale: cs })}
                    </p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Odesílatel
                  </Label>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {transfer.sender.full_name || transfer.sender.username}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {transfer.sender.role}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Příjemce
                  </Label>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {transfer.receiver.full_name ||
                        transfer.receiver.username}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {transfer.receiver.role}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transfer Items by Category */}
          <Card className="print:shadow-none print:border-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Převody surovin ({transfer.transfer_items.length})
                <Badge variant="secondary" className="ml-auto">
                  Celkem: {totalWeight.toFixed(3)} kg
                </Badge>
              </CardTitle>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddItemOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Přidat položku
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(groupedItems).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Žádné položky v tomto převodu</p>
                </div>
              ) : (
                Object.entries(groupedItems).map(([categoryName, items]) => (
                  <div key={categoryName} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm text-muted-foreground">
                        {categoryName}
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        {items.length} položek
                      </Badge>
                    </div>

                    <div className="border rounded-lg overflow-hidden print:border-2 print:rounded-none">
                      <Table className="print:text-sm">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-1/3">Surovina</TableHead>
                            <TableHead className="w-1/6">Jednotka</TableHead>
                            <TableHead className="w-1/6 text-right">
                              Množství
                            </TableHead>
                            <TableHead className="w-1/6 text-right">
                              Hmotnost (kg)
                            </TableHead>
                            {canEdit && (
                              <TableHead className="w-1/6 text-center print:hidden">
                                Akce
                              </TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                {item.ingredient.name}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {item.ingredient.unit}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {canEdit ? (
                                  <Input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    defaultValue={item.quantity}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (
                                        value === "" ||
                                        !isNaN(parseFloat(value))
                                      ) {
                                        e.target.value = value;
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        const value = e.currentTarget.value;
                                        const numValue = parseFloat(value);
                                        if (!isNaN(numValue) && numValue >= 0) {
                                          handleQuantityChange(
                                            item.id,
                                            numValue
                                          );
                                        } else {
                                          handleQuantityChange(item.id, 0);
                                        }
                                      }
                                    }}
                                    onBlur={(e) => {
                                      const value = e.currentTarget.value;
                                      const numValue = parseFloat(value);
                                      if (!isNaN(numValue) && numValue >= 0) {
                                        handleQuantityChange(item.id, numValue);
                                      } else {
                                        handleQuantityChange(item.id, 0);
                                      }
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    className="w-20 text-right no-spinner"
                                  />
                                ) : (
                                  item.quantity
                                )}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {(
                                  item.quantity * item.ingredient.kiloPerUnit
                                ).toFixed(3)}
                              </TableCell>
                              {canEdit && (
                                <TableCell className="text-center print:hidden">
                                  <span className="text-xs text-muted-foreground">
                                    {savingItem === item.id
                                      ? "Ukládání..."
                                      : ""}
                                  </span>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>

      {/* Add Item Modal */}
      <IngredientPickerModal
        open={isAddItemOpen}
        onClose={() => setIsAddItemOpen(false)}
        onPick={handleAddItem}
        ingredients={ingredients}
        categories={categories}
      />
    </Dialog>
  );
}

interface TransfersTableProps {
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    senderId?: string;
    receiverId?: string;
  };
}

export default function TransfersTable({ filters = {} }: TransfersTableProps) {
  const { user } = useAuthStore();
  const { data: transfers = [], isLoading, error } = useTransfers();
  const deleteTransfer = useDeleteTransfer();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(
    null
  );
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // First filter by user role
  const userTransfers = transfers.filter((transfer) => {
    // Admin sees all transfers
    if (user?.role === "admin") return true;

    // Other users only see transfers where they are sender or receiver
    return (
      user?.id &&
      (transfer.sender.id === user.id || transfer.receiver.id === user.id)
    );
  });

  const filteredTransfers = userTransfers.filter((transfer) => {
    const searchLower = searchTerm.toLowerCase();

    // Search filter
    const matchesSearch =
      transfer.sender.full_name?.toLowerCase().includes(searchLower) ||
      transfer.sender.username?.toLowerCase().includes(searchLower) ||
      transfer.receiver.full_name?.toLowerCase().includes(searchLower) ||
      transfer.receiver.username?.toLowerCase().includes(searchLower) ||
      transfer.id.toString().includes(searchLower);

    // Date filters
    const transferDate = new Date(transfer.date);
    const matchesDateFrom =
      !filters.dateFrom || transferDate >= new Date(filters.dateFrom);
    const matchesDateTo =
      !filters.dateTo || transferDate <= new Date(filters.dateTo + "T23:59:59");

    // Sender filter
    const matchesSender =
      !filters.senderId || transfer.sender.id === filters.senderId;

    // Receiver filter
    const matchesReceiver =
      !filters.receiverId || transfer.receiver.id === filters.receiverId;

    return (
      matchesSearch &&
      matchesDateFrom &&
      matchesDateTo &&
      matchesSender &&
      matchesReceiver
    );
  });

  const handleViewDetails = (transfer: Transfer) => {
    setSelectedTransfer(transfer);
    setIsDetailsOpen(true);
  };

  const handleDelete = async (transferId: number) => {
    if (
      window.confirm(
        "Jste si jisti, že chcete smazat tento převod? Tuto akci nelze vrátit zpět."
      )
    ) {
      try {
        await deleteTransfer.mutateAsync(transferId);
        toast({
          title: "Úspěch",
          description: "Převod byl úspěšně smazán",
        });
      } catch (error) {
        console.error("Error deleting transfer:", error);
        toast({
          title: "Chyba",
          description: "Nepodařilo se smazat převod. Zkuste to prosím znovu.",
          variant: "destructive",
        });
      }
    }
  };

  const canDelete = () => {
    // Only allow deletion if user is admin
    return user?.role === "admin";
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Načítání převodů...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">
            Chyba při načítání převodů: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Převody
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Hledat převody podle odesílatele, příjemce nebo ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredTransfers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Žádné převody nenalezeny</p>
              {searchTerm && (
                <p className="text-sm">Zkuste upravit vyhledávací termíny</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Odesílatel</TableHead>
                  <TableHead>Příjemce</TableHead>
                  <TableHead>Položky</TableHead>
                  <TableHead className="text-right">Akce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.map((transfer) => (
                  <TableRow
                    key={transfer.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleViewDetails(transfer)}
                  >
                    <TableCell className="font-medium">
                      #{transfer.id}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(transfer.date), "MMM dd, yyyy", {
                          locale: cs,
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {transfer.sender.full_name ||
                            transfer.sender.username}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {transfer.sender.role}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {transfer.receiver.full_name ||
                            transfer.receiver.username}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {transfer.receiver.role}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span>{transfer.transfer_items.length} položek</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div
                        className="flex items-center justify-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canDelete() && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(transfer.id);
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Smazat
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TransferDetailsDialog
        transfer={selectedTransfer}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedTransfer(null);
        }}
      />
    </div>
  );
}
