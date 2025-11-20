import React, { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  FileText,
  Search,
  Calendar,
  Package,
  User,
  Eye,
  Trash2,
  Edit,
  Save,
  X,
  Plus,
  TrendingUp,
  Printer,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";

import { useUsers } from "@/hooks/useProfiles";
import {
  useReceivedInvoices,
  useDeleteReceivedInvoice,
  useUpdateReceivedInvoice,
  ReceivedInvoice,
} from "@/hooks/useReceivedInvoices";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { AddReceivedInvoiceForm } from "./AddReceivedInvoiceForm";
import { useIngredients } from "@/hooks/useIngredients";
import { removeDiacritics } from "@/utils/removeDiacritics";
import { IngredientPriceFluctuation } from "./IngredientPriceFluctuation";

// MAKRO supplier ID (weight-based layout)
const MAKRO_SUPPLIER_ID = "16293f61-b9e8-4016-9882-0b8fa90125e4";
// Pešek supplier ID (table layout without colors)
const PESEK_SUPPLIER_ID = "908cc15c-1055-4e22-9a09-c61fef1e0b9c";
// Albert supplier ID (weight-based layout with kg units)
const ALBERT_SUPPLIER_ID = "cf433a0c-f55d-4935-8941-043b13cea7a3";

// Add Item Modal Component
function AddItemModal({
  open,
  onClose,
  onAdd,
  ingredients,
  supplierId,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (ingredientId: number, quantity: number, unitPrice: number) => void;
  ingredients: any[];
  supplierId?: string;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);

  const filtered = ingredients.filter((ing) => {
    const searchLower = removeDiacritics(search).toLowerCase();
    const internalName = removeDiacritics(ing.name).toLowerCase();

    // Check supplier-specific name if available
    const supplierCode = ing.ingredient_supplier_codes?.find(
      (code: any) => code.supplier_id === supplierId
    ) as any;
    const supplierName = supplierCode?.supplier_ingredient_name
      ? removeDiacritics(supplierCode.supplier_ingredient_name).toLowerCase()
      : "";

    // Match against both internal name and supplier name
    return (
      internalName.includes(searchLower) || supplierName.includes(searchLower)
    );
  });

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
                const supplierCode = ing.ingredient_supplier_codes?.find(
                  (code: any) => code.supplier_id === supplierId
                );

                // Prioritize supplier code, fallback to ingredient
                const displayPackage = supplierCode?.package || ing.package;
                const displayPrice = supplierCode?.price || ing.price;

                return (
                  <li
                    key={ing.id}
                    className={`px-3 py-2 cursor-pointer hover:bg-orange-50 flex items-center gap-2 ${
                      selectedId === ing.id ? "bg-orange-100" : ""
                    }`}
                    onClick={() => setSelectedId(ing.id)}
                  >
                    <div className="flex-1 flex items-center gap-2">
                      <div className="w-1/2 truncate">
                        <span className="font-medium">
                          {supplierCode?.supplier_ingredient_name || ing.name}
                        </span>
                      </div>
                      <span className="text-blue-600 w-1/4 text-center">
                        {displayPackage || "—"}
                      </span>
                      <span className="font-medium text-orange-500 w-1/4 text-right">
                        {displayPrice ? `${displayPrice.toFixed(2)} Kč` : "—"}
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
              const supplierCode = ingredient?.ingredient_supplier_codes?.find(
                (code: any) => code.supplier_id === supplierId
              );
              const unitPrice = supplierCode?.price || ingredient?.price || 0;

              onAdd(selectedId, quantity, unitPrice);
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
              const supplierCode = ingredient?.ingredient_supplier_codes?.find(
                (code: any) => code.supplier_id === supplierId
              );
              const unitPrice = supplierCode?.price || ingredient?.price || 0;

              onAdd(selectedId, quantity, unitPrice);
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
  );
}

export function ReceivedInvoices() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutation for updating invoice items
  const updateInvoiceItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      quantity,
      unitPrice,
      invoiceId,
      faktMn,
      cenaJed,
    }: {
      itemId: string;
      quantity: number;
      unitPrice: number;
      invoiceId: string;
      faktMn?: number;
      cenaJed?: number;
    }) => {
      const lineTotal = Math.round(quantity * unitPrice * 100) / 100; // Round to 2 decimal places

      // Update the item
      const updateData: any = {
        quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
      };

      // Add Zeelandia fields if provided
      if (faktMn !== undefined) {
        updateData.fakt_mn = faktMn;
      }
      if (cenaJed !== undefined) {
        updateData.cena_jed = cenaJed;
      }

      const { data: itemData, error: itemError } = await supabase
        .from("items_received")
        .update(updateData)
        .eq("id", itemId)
        .select()
        .single();

      if (itemError) {
        throw itemError;
      }

      // Get all items for this invoice to recalculate total
      const { data: allItems, error: itemsError } = await supabase
        .from("items_received")
        .select("line_total")
        .eq("invoice_received_id", invoiceId);

      if (itemsError) {
        throw itemsError;
      }

      // Calculate new total amount
      const newTotalAmount =
        allItems?.reduce((sum, item) => sum + (item.line_total || 0), 0) || 0;

      // Update the invoice's total_amount
      const { error: invoiceError } = await supabase
        .from("invoices_received")
        .update({ total_amount: newTotalAmount })
        .eq("id", invoiceId);

      if (invoiceError) {
        throw invoiceError;
      }

      return { itemData, newTotalAmount };
    },
    onSuccess: (result) => {
      // Update the selected invoice with the new data
      if (selectedInvoice && result.itemData) {
        const updatedItems = selectedInvoice.items?.map((item) => {
          if (item.id === result.itemData.id) {
            return {
              ...item,
              quantity: result.itemData.quantity,
              unit_price: result.itemData.unit_price,
              line_total: result.itemData.line_total,
              fakt_mn: result.itemData.fakt_mn,
              cena_jed: result.itemData.cena_jed,
            };
          }
          return item;
        });

        setSelectedInvoice({
          ...selectedInvoice,
          items: updatedItems,
          total_amount: result.newTotalAmount,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["receivedInvoices"] });
      toast({
        title: "Úspěch",
        description: "Položka faktury byla aktualizována",
      });
    },
    onError: (error) => {
      toast({
        title: "Chyba",
        description: `Chyba při aktualizaci: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation for adding new items to existing invoice
  const addInvoiceItemMutation = useMutation({
    mutationFn: async ({
      invoiceId,
      ingredientId,
      quantity,
      unitPrice,
    }: {
      invoiceId: string;
      ingredientId: number;
      quantity: number;
      unitPrice: number;
    }) => {
      const lineTotal = quantity * unitPrice;

      // Add the new item
      const { data: itemData, error: itemError } = await supabase
        .from("items_received")
        .insert({
          invoice_received_id: invoiceId,
          matched_ingredient_id: ingredientId,
          quantity,
          unit_price: unitPrice,
          line_total: lineTotal,
          unit_of_measure: null,
          manual_match: true,
        })
        .select("*, ingredient:matched_ingredient_id(id, name)")
        .single();

      if (itemError) {
        throw itemError;
      }

      // Get all items for this invoice to recalculate total
      const { data: allItems, error: itemsError } = await supabase
        .from("items_received")
        .select("line_total")
        .eq("invoice_received_id", invoiceId);

      if (itemsError) {
        throw itemsError;
      }

      // Calculate new total amount
      const newTotalAmount =
        allItems?.reduce((sum, item) => sum + (item.line_total || 0), 0) || 0;

      // Update the invoice's total_amount
      const { error: invoiceError } = await supabase
        .from("invoices_received")
        .update({ total_amount: newTotalAmount })
        .eq("id", invoiceId);

      if (invoiceError) {
        throw invoiceError;
      }

      return { itemData, newTotalAmount };
    },
    onSuccess: (result) => {
      // Update the selected invoice to include the new item
      if (selectedInvoice && result.itemData) {
        const updatedItems = [
          ...(selectedInvoice.items || []),
          result.itemData,
        ];

        setSelectedInvoice({
          ...selectedInvoice,
          items: updatedItems,
          total_amount: result.newTotalAmount,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["receivedInvoices"] });
      toast({
        title: "Úspěch",
        description: "Položka byla přidána do faktury",
      });
    },
    onError: (error) => {
      toast({
        title: "Chyba",
        description: `Chyba při přidávání položky: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Mutation for deleting invoice items
  const deleteInvoiceItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      invoiceId,
    }: {
      itemId: string;
      invoiceId: string;
    }) => {
      // Delete the item
      const { error: itemError } = await supabase
        .from("items_received")
        .delete()
        .eq("id", itemId);

      if (itemError) {
        throw itemError;
      }

      // Get remaining items for this invoice to recalculate total
      const { data: allItems, error: itemsError } = await supabase
        .from("items_received")
        .select("line_total")
        .eq("invoice_received_id", invoiceId);

      if (itemsError) {
        throw itemsError;
      }

      // Calculate new total amount
      const newTotalAmount =
        allItems?.reduce((sum, item) => sum + (item.line_total || 0), 0) || 0;

      // Update the invoice's total_amount
      const { error: invoiceError } = await supabase
        .from("invoices_received")
        .update({ total_amount: newTotalAmount })
        .eq("id", invoiceId);

      if (invoiceError) {
        throw invoiceError;
      }

      return { itemId, newTotalAmount };
    },
    onSuccess: (result) => {
      // Update the selected invoice to remove the deleted item
      if (selectedInvoice) {
        const updatedItems = selectedInvoice.items?.filter(
          (item) => item.id !== result.itemId
        );

        setSelectedInvoice({
          ...selectedInvoice,
          items: updatedItems,
          total_amount: result.newTotalAmount,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["receivedInvoices"] });
      toast({
        title: "Úspěch",
        description: "Položka byla odstraněna z faktury",
      });
    },
    onError: (error) => {
      toast({
        title: "Chyba",
        description: `Chyba při mazání položky: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [receiverFilter, setReceiverFilter] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  // const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] =
    useState<ReceivedInvoice | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    invoice_number: "",
    receiver_id: "",
    total_amount: 0,
    invoice_due: "",
  });
  const [isEditItemDialogOpen, setIsEditItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editItemForm, setEditItemForm] = useState({
    quantity: 0,
    unit_price: 0,
  });
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [isPriceFluctuationOpen, setIsPriceFluctuationOpen] = useState(false);
  const [invoiceFileUrl, setInvoiceFileUrl] = useState<string | null>(null);

  const { data: allUsers } = useUsers();
  const { data: invoices, isLoading } = useReceivedInvoices();
  const { data: allIngredients } = useIngredients();

  // Function to fix invoice total amounts
  const fixInvoiceTotals = async () => {
    if (!invoices) return;

    for (const invoice of invoices) {
      if (invoice.items && invoice.items.length > 0) {
        const itemsSum = invoice.items.reduce((sum, item) => {
          return sum + (item.line_total || 0);
        }, 0);

        const difference = Math.abs((invoice.total_amount || 0) - itemsSum);

        if (difference > 0.01) {
          try {
            const { error } = await supabase
              .from("invoices_received")
              .update({ total_amount: itemsSum })
              .eq("id", invoice.id);

            if (error) {
              throw error;
            }
          } catch (error) {
            // Error handling is done silently
          }
        }
      }
    }

    // Refresh the data
    queryClient.invalidateQueries({ queryKey: ["receivedInvoices"] });
  };

  // Console log received invoices data
  useEffect(() => {
    if (invoices && invoices.length > 0) {
      console.log("📋 Received Invoices Data:", {
        count: invoices.length,
        firstInvoice: invoices[0],
        allInvoices: invoices.map((inv) => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date,
          invoice_due: (inv as any).invoice_due,
          supplier: inv.supplier?.full_name,
          total_amount: inv.total_amount,
        })),
      });
    }
  }, [invoices]);
  const deleteInvoiceMutation = useDeleteReceivedInvoice();
  const updateInvoiceMutation = useUpdateReceivedInvoice();

  // Filter users by role
  const storeUsers = allUsers?.filter((user) => user.role === "store") || [];
  const supplierUsers =
    allUsers?.filter((user) => user.role === "supplier") || [];

  // Filter invoices based on search and filters
  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];

    return invoices.filter((invoice) => {
      const matchesSearch =
        invoice.invoice_number
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (invoice.supplier?.full_name || invoice.supplier_name || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (invoice.receiver?.full_name || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesSupplier =
        supplierFilter === "all" || invoice.supplier_id === supplierFilter;

      const matchesReceiver =
        receiverFilter === "all" || invoice.receiver_id === receiverFilter;

      const matchesDate = (() => {
        const invoiceDate = invoice.invoice_date
          ? new Date(invoice.invoice_date)
          : null;
        if (!invoiceDate) return false;

        // Check if invoice date is within the selected month
        return (
          invoiceDate.getFullYear() === selectedMonth.getFullYear() &&
          invoiceDate.getMonth() === selectedMonth.getMonth()
        );
      })();

      // const matchesStatus =
      //   statusFilter === "all" || invoice.processing_status === statusFilter;

      return matchesSearch && matchesSupplier && matchesReceiver && matchesDate;
    });
  }, [invoices, searchTerm, supplierFilter, receiverFilter, selectedMonth]);

  // Calculate totals
  const totals = useMemo(() => {
    if (!filteredInvoices) return { count: 0, totalAmount: 0 };

    const count = filteredInvoices.length;
    const totalAmount = filteredInvoices.reduce((sum, invoice) => {
      // Calculate subtotal from items (without VAT)
      const subtotal = (invoice.items || []).reduce(
        (itemSum, item) => itemSum + (item.line_total || 0),
        0
      );
      return sum + subtotal;
    }, 0);

    return { count, totalAmount: Math.round(totalAmount) };
  }, [filteredInvoices]);

  const handleViewInvoice = async (invoice: ReceivedInvoice) => {
    setSelectedInvoice(invoice);
    const invoiceAny = invoice as any;
    setEditForm({
      invoice_number: invoice.invoice_number || "",
      receiver_id: invoice.receiver_id || "",
      total_amount: invoice.total_amount || 0,
      invoice_due: invoiceAny.invoice_due || "",
    });
    setIsEditing(false);
    setIsDetailDialogOpen(true);

    // Try to get file URL if file_path exists
    if (
      invoiceAny.file_path ||
      invoiceAny.storage_path ||
      invoiceAny.document_path
    ) {
      const filePath =
        invoiceAny.file_path ||
        invoiceAny.storage_path ||
        invoiceAny.document_path;
      try {
        const { data } = await supabase.storage
          .from("documents")
          .createSignedUrl(filePath, 3600); // 1 hour expiry

        if (data?.signedUrl) {
          setInvoiceFileUrl(data.signedUrl);
        } else {
          setInvoiceFileUrl(null);
        }
      } catch (error) {
        console.error("Error fetching invoice file:", error);
        setInvoiceFileUrl(null);
      }
    } else {
      setInvoiceFileUrl(null);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      await deleteInvoiceMutation.mutateAsync(invoiceId);
      toast({
        title: "Úspěch",
        description: "Faktura byla úspěšně smazána",
      });
    } catch (error) {
      toast({
        title: "Chyba",
        description: "Nepodařilo se smazat fakturu",
        variant: "destructive",
      });
    }
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    if (isEditing) {
      // Reset form when canceling edit
      const invoiceAny = selectedInvoice as any;
      setEditForm({
        invoice_number: selectedInvoice?.invoice_number || "",
        receiver_id: selectedInvoice?.receiver_id || "",
        total_amount: selectedInvoice?.total_amount || 0,
        invoice_due: invoiceAny?.invoice_due || "",
      });
    }
  };

  const handleUpdateInvoice = async () => {
    if (!selectedInvoice) return;

    console.log("🔍 handleUpdateInvoice - START", {
      selectedInvoice,
      editForm,
    });

    try {
      const updateData: any = {
        id: selectedInvoice.id,
        invoice_number: editForm.invoice_number,
        receiver_id: editForm.receiver_id,
        total_amount: editForm.total_amount,
      };

      // Add invoice_due if it exists and is not empty (PostgreSQL doesn't accept empty strings for date fields)
      if (editForm.invoice_due && editForm.invoice_due.trim() !== "") {
        updateData.invoice_due = editForm.invoice_due;
        console.log("✅ Adding invoice_due to update:", editForm.invoice_due);
      } else {
        // If empty, explicitly set to null to clear the due date
        updateData.invoice_due = null;
        console.log("⚠️ Setting invoice_due to null (empty field)");
      }

      console.log("📤 Sending update data:", updateData);

      await updateInvoiceMutation.mutateAsync(updateData);

      // Update the selected invoice with new data
      setSelectedInvoice({
        ...selectedInvoice,
        invoice_number: editForm.invoice_number,
        receiver_id: editForm.receiver_id,
        total_amount: editForm.total_amount,
        invoice_due: editForm.invoice_due || null,
      });

      console.log("✅ Local state updated:", {
        invoice_number: editForm.invoice_number,
        receiver_id: editForm.receiver_id,
        total_amount: editForm.total_amount,
        invoice_due: editForm.invoice_due || null,
      });

      setIsEditing(false);
      toast({
        title: "Úspěch",
        description: "Faktura byla úspěšně aktualizována",
      });
    } catch (error: any) {
      toast({
        title: "Chyba",
        description:
          error?.message ||
          "Nepodařilo se aktualizovat fakturu. Zkontrolujte, zda je sloupec receiver_id přidán do databáze.",
        variant: "destructive",
      });
    }
  };

  const handleEditItem = (item: any) => {
    setEditingItem(item);
    setEditItemForm({
      quantity: item.quantity || 0,
      unit_price: item.unit_price || 0,
    });
    setIsEditItemDialogOpen(true);
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;

    try {
      await updateInvoiceItemMutation.mutateAsync({
        itemId: editingItem.id,
        quantity: editItemForm.quantity,
        unitPrice: editItemForm.unit_price,
        invoiceId: selectedInvoice?.id || "",
      });

      // Update the selectedInvoice state to reflect the changes
      if (selectedInvoice) {
        const updatedItems = selectedInvoice.items?.map((item) => {
          if (item.id === editingItem.id) {
            return {
              ...item,
              quantity: editItemForm.quantity,
              unit_price: editItemForm.unit_price,
              line_total: editItemForm.quantity * editItemForm.unit_price,
            };
          }
          return item;
        });

        // Recalculate total amount as sum of line totals (before taxes)
        const newTotalAmount =
          updatedItems?.reduce(
            (sum, item) => sum + (item.line_total || 0),
            0
          ) || 0;

        setSelectedInvoice({
          ...selectedInvoice,
          items: updatedItems,
          total_amount: newTotalAmount,
        });
      }

      setIsEditItemDialogOpen(false);
      setEditingItem(null);
      toast({
        title: "Úspěch",
        description: "Položka byla úspěšně aktualizována",
      });
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: "Nepodařilo se aktualizovat položku",
        variant: "destructive",
      });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!selectedInvoice) return;

    if (!confirm("Opravdu chcete odstranit tuto položku z faktury?")) {
      return;
    }

    try {
      await deleteInvoiceItemMutation.mutateAsync({
        itemId,
        invoiceId: selectedInvoice.id,
      });
    } catch (error: any) {
      // Error handled silently
    }
  };

  const handlePrintInvoice = () => {
    if (!selectedInvoice || !storeUsers) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const sortedItems = [...(selectedInvoice.items || [])].sort((a, b) => {
      const aLineNumber = a.line_number ?? 999999;
      const bLineNumber = b.line_number ?? 999999;
      return aLineNumber - bLineNumber;
    });

    const subtotal = sortedItems.reduce(
      (sum, item) => sum + (item.line_total || 0),
      0
    );

    const invoiceDate = selectedInvoice.invoice_date
      ? new Date(selectedInvoice.invoice_date).toLocaleDateString("cs-CZ")
      : "Neznámé datum";

    const printContent = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Faktura ${selectedInvoice.invoice_number}</title>
    <style>
      @page {
        size: A4;
        margin: 2cm;
      }
      body {
        font-family: Arial, sans-serif;
        font-size: 12px;
        line-height: 1.4;
      }
      .header {
        margin-bottom: 30px;
      }
      .header h1 {
        font-size: 24px;
        margin-bottom: 20px;
      }
      .info-section {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 30px;
        margin-bottom: 30px;
      }
      .info-box h3 {
        font-size: 14px;
        font-weight: bold;
        margin-bottom: 10px;
        border-bottom: 1px solid #000;
        padding-bottom: 5px;
      }
      .info-box p {
        margin: 5px 0;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
      }
      th {
        background-color: #f5f5f5;
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
        font-weight: bold;
      }
      td {
        border: 1px solid #ddd;
        padding: 8px;
      }
      .text-right {
        text-align: right;
      }
      .text-center {
        text-align: center;
      }
      .total-row {
        font-weight: bold;
        background-color: #f9f9f9;
      }
      .footer {
        margin-top: 30px;
        padding-top: 20px;
        border-top: 2px solid #000;
      }
      .footer-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
      }
      .footer-total {
        font-size: 16px;
        font-weight: bold;
      }
      @media print {
        body {
          margin: 0;
        }
        .no-print {
          display: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>FAKTURA - DAŇOVÝ DOKLAD</h1>
    </div>

    <div class="info-section">
      <div class="info-box">
        <h3>Dodavatel</h3>
        <p>${selectedInvoice.supplier?.full_name || selectedInvoice.supplier_name || "Neznámý dodavatel"}</p>
      </div>
      <div class="info-box">
        <h3>Příjemce</h3>
        <p>${storeUsers.find((u) => u.id === selectedInvoice.receiver_id)?.full_name || "Není nastaven"}</p>
      </div>
    </div>

    <div class="info-section">
      <div class="info-box">
        <p><strong>Číslo faktury:</strong> ${selectedInvoice.invoice_number}</p>
        <p><strong>Datum vystavení:</strong> ${invoiceDate}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 5%">#</th>
          <th style="width: 10%">Kód</th>
          <th style="width: 30%">Surovina</th>
          <th style="width: 15%" class="text-right">Množství</th>
          <th style="width: 15%" class="text-right">Jednotková cena</th>
          <th style="width: 15%" class="text-right">Celková cena</th>
        </tr>
      </thead>
      <tbody>
        ${sortedItems
          .map((item, index) => {
            const ingredient = item.ingredient;
            // Get supplier-specific ingredient name for this invoice's supplier
            // (not the active supplier, but the one matching the invoice)
            const supplierCode = (
              ingredient as any
            )?.ingredient_supplier_codes?.find(
              (code: any) => code.supplier_id === selectedInvoice.supplier_id
            );
            // Always use supplier-specific name if available, otherwise fallback to main name
            const supplierIngredientName =
              supplierCode?.supplier_ingredient_name ||
              ingredient?.name ||
              "Neznámá surovina";
            const productCode = supplierCode?.product_code || "";

            const quantity = (item.quantity || 0).toFixed(
              selectedInvoice?.supplier_id === MAKRO_SUPPLIER_ID ||
                selectedInvoice?.supplier_id === ALBERT_SUPPLIER_ID
                ? 3
                : 1
            );
            const unit = item.unit_of_measure || item.ingredient?.unit || "";
            const unitPrice = (item.unit_price || 0).toLocaleString("cs-CZ", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            const lineTotal = (item.line_total || 0).toLocaleString("cs-CZ", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });

            return `
                <tr>
                  <td>${index + 1}</td>
                  <td><code style="background: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-family: monospace;">${productCode}</code></td>
                  <td>${supplierIngredientName}</td>
                  <td class="text-right">${quantity} ${unit}</td>
                  <td class="text-right">${unitPrice} Kč</td>
                  <td class="text-right">${lineTotal} Kč</td>
                </tr>
              `;
          })
          .join("")}
        <tr class="total-row">
          <td colspan="5" class="text-right"><strong>Celkem:</strong></td>
          <td class="text-right">${subtotal.toLocaleString("cs-CZ", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} Kč</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <div class="footer-row">
        <div><strong>Celková částka bez DPH:</strong></div>
        <div>${subtotal.toLocaleString("cs-CZ", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} Kč</div>
      </div>
      <div class="footer-row footer-total">
        <div><strong>Celková částka:</strong></div>
        <div>${(selectedInvoice.total_amount || 0).toLocaleString("cs-CZ", {
          minimumFractionDigits:
            selectedInvoice.supplier_id === PESEK_SUPPLIER_ID ? 2 : 0,
          maximumFractionDigits:
            selectedInvoice.supplier_id === PESEK_SUPPLIER_ID ? 2 : 0,
        })} Kč</div>
      </div>
    </div>
  </body>
</html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();

    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Přijaté faktury
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPriceFluctuationOpen(true)}
                className="flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Vývoj cen
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fixInvoiceTotals}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Opravit celkové částky
              </Button>
              <AddReceivedInvoiceForm />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Hledat podle čísla faktury, dodavatele, příjemce..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Dodavatel</Label>
                <Select
                  value={supplierFilter}
                  onValueChange={setSupplierFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Všichni dodavatelé" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všichni dodavatelé</SelectItem>
                    {(supplierUsers || []).map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Příjemce</Label>
                <Select
                  value={receiverFilter}
                  onValueChange={setReceiverFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Všichni příjemci" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všichni příjemci</SelectItem>
                    {storeUsers.map((receiver) => (
                      <SelectItem key={receiver.id} value={receiver.id}>
                        {receiver.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Měsíc</Label>
                <Select
                  value={`${selectedMonth.getFullYear()}-${selectedMonth.getMonth()}`}
                  onValueChange={(value) => {
                    const [year, month] = value.split("-");
                    setSelectedMonth(
                      new Date(parseInt(year), parseInt(month), 1)
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(() => {
                        const months = [
                          "Leden",
                          "Únor",
                          "Březen",
                          "Duben",
                          "Květen",
                          "Červen",
                          "Červenec",
                          "Srpen",
                          "Září",
                          "Říjen",
                          "Listopad",
                          "Prosinec",
                        ];
                        return `${months[selectedMonth.getMonth()]} ${selectedMonth.getFullYear()}`;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const months = [
                        "Leden",
                        "Únor",
                        "Březen",
                        "Duben",
                        "Květen",
                        "Červen",
                        "Červenec",
                        "Srpen",
                        "Září",
                        "Říjen",
                        "Listopad",
                        "Prosinec",
                      ];
                      const currentYear = new Date().getFullYear();
                      const options = [];

                      // Add current year months
                      for (let month = 0; month < 12; month++) {
                        options.push(
                          <SelectItem
                            key={`${currentYear}-${month}`}
                            value={`${currentYear}-${month}`}
                          >
                            {months[month]} {currentYear}
                          </SelectItem>
                        );
                      }

                      // Add previous year months
                      for (let month = 0; month < 12; month++) {
                        options.push(
                          <SelectItem
                            key={`${currentYear - 1}-${month}`}
                            value={`${currentYear - 1}-${month}`}
                          >
                            {months[month]} {currentYear - 1}
                          </SelectItem>
                        );
                      }

                      return options;
                    })()}
                  </SelectContent>
                </Select>
              </div>

              {/* <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Všechny statusy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všechny statusy</SelectItem>
                    <SelectItem value="pending">Čekající</SelectItem>
                    <SelectItem value="approved">Schváleno</SelectItem>
                    <SelectItem value="rejected">Zamítnuto</SelectItem>
                    <SelectItem value="processed">Zpracováno</SelectItem>
                    <SelectItem value="failed">Chyba</SelectItem>
                  </SelectContent>
                </Select>
              </div> */}

              <div className="space-y-2">
                <Label>Statistiky</Label>
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-md">
                  <div className="text-sm">
                    <span className="font-medium">{totals.count}</span> faktur
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">
                      Celkem bez DPH:{" "}
                    </span>
                    <span className="font-medium">
                      {totals.totalAmount.toLocaleString("cs-CZ", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      Kč
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices List */}
      <Card>
        <CardContent>
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Žádné faktury nebyly nalezeny.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Číslo faktury</TableHead>
                    <TableHead>Dodavatel</TableHead>
                    <TableHead>Příjemce</TableHead>
                    <TableHead>Datum přijetí</TableHead>
                    <TableHead>Datum splatnosti</TableHead>
                    <TableHead>Částka bez DPH</TableHead>
                    {/* <TableHead>Status</TableHead> */}
                    <TableHead>Položky</TableHead>
                    <TableHead className="text-right">Akce</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      onClick={() => handleViewInvoice(invoice)}
                      className="cursor-pointer hover:bg-orange-50 transition-colors"
                      style={{ userSelect: "none" }}
                    >
                      <TableCell className="font-medium">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {invoice.supplier?.full_name ||
                            invoice.supplier_name ||
                            "Neznámý dodavatel"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {invoice.receiver?.full_name || "Neznámý příjemce"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {invoice.invoice_date
                            ? new Date(invoice.invoice_date).toLocaleDateString(
                                "cs-CZ"
                              )
                            : "Neznámé datum"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {(() => {
                            const invoiceAny = invoice as any;
                            const dueDate = invoiceAny.invoice_due;
                            if (!dueDate)
                              return <span className="text-gray-400">—</span>;

                            const dueDateObj = new Date(dueDate);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            dueDateObj.setHours(0, 0, 0, 0);

                            const isOverdue = dueDateObj < today;
                            const isDueSoon =
                              dueDateObj <=
                                new Date(
                                  today.getTime() + 7 * 24 * 60 * 60 * 1000
                                ) && !isOverdue;

                            return (
                              <span
                                className={
                                  isOverdue
                                    ? "text-red-600 font-semibold"
                                    : isDueSoon
                                      ? "text-orange-600 font-semibold"
                                      : ""
                                }
                              >
                                {dueDateObj.toLocaleDateString("cs-CZ")}
                              </span>
                            );
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const subtotal = (invoice.items || []).reduce(
                              (sum, item) => sum + (item.line_total || 0),
                              0
                            );
                            return Math.round(subtotal).toLocaleString(
                              "cs-CZ",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            );
                          })()}{" "}
                          Kč
                        </div>
                      </TableCell>
                      {/* <TableCell>
                        <Badge
                          variant={
                            invoice.processing_status === "approved"
                              ? "default"
                              : invoice.processing_status === "rejected"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {invoice.processing_status === "pending" &&
                            "Čekající"}
                          {invoice.processing_status === "approved" &&
                            "Schváleno"}
                          {invoice.processing_status === "rejected" &&
                            "Zamítnuto"}
                          {!invoice.processing_status && "Neznámý"}
                        </Badge>
                      </TableCell> */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {invoice.items?.length || 0} položek
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex justify-end gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewInvoice(invoice);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteInvoice(invoice.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Detail Dialog */}
      <Dialog
        open={isDetailDialogOpen}
        onOpenChange={(open) => {
          setIsDetailDialogOpen(open);
          if (!open) {
            setInvoiceFileUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detail faktury
            </DialogTitle>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-6">
              {/* Debug: Log invoice detail data */}
              {(() => {
                console.log("=== DETAIL FAKTURY DATA ===");
                console.log("Selected Invoice:", selectedInvoice);
                console.log("Invoice ID:", selectedInvoice.id);
                console.log("Invoice Number:", selectedInvoice.invoice_number);
                console.log("Supplier:", selectedInvoice.supplier);
                console.log("Receiver:", selectedInvoice.receiver);
                console.log("Total Amount:", selectedInvoice.total_amount);
                console.log("Items Count:", selectedInvoice.items?.length || 0);
                console.log("Items:", selectedInvoice.items);
                console.log("QR Codes:", selectedInvoice.qr_codes);
                console.log("=== END DETAIL FAKTURY DATA ===");
                return null;
              })()}
              {/* Invoice Info */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Informace o faktuře
                    </CardTitle>
                    <div className="flex gap-2">
                      {!isEditing ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePrintInvoice}
                            className="flex items-center gap-2"
                          >
                            <Printer className="h-4 w-4" />
                            Tisk
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleEditToggle}
                            className="flex items-center gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            Upravit
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleEditToggle}
                            className="flex items-center gap-2"
                          >
                            <X className="h-4 w-4" />
                            Zrušit
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleUpdateInvoice}
                            className="flex items-center gap-2"
                            disabled={updateInvoiceMutation.isPending}
                          >
                            <Save className="h-4 w-4" />
                            Uložit
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">
                        Číslo faktury
                      </Label>
                      {isEditing ? (
                        <Input
                          value={editForm.invoice_number}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              invoice_number: e.target.value,
                            }))
                          }
                          className="text-lg font-semibold"
                        />
                      ) : (
                        <p className="text-lg font-semibold">
                          {selectedInvoice.invoice_number}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Dodavatel</Label>
                      <p className="text-lg">
                        {selectedInvoice.supplier?.full_name ||
                          selectedInvoice.supplier_name ||
                          "Neznámý dodavatel"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">
                        Datum faktury
                      </Label>
                      <p>
                        {selectedInvoice.invoice_date
                          ? new Date(
                              selectedInvoice.invoice_date
                            ).toLocaleDateString("cs-CZ")
                          : "Neznámé datum"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">
                        Datum splatnosti
                      </Label>
                      {isEditing ? (
                        <Input
                          type="date"
                          value={editForm.invoice_due}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              invoice_due: e.target.value,
                            }))
                          }
                          className="text-lg"
                        />
                      ) : (
                        <p>
                          {(() => {
                            const invoiceAny = selectedInvoice as any;
                            const dueDate = invoiceAny.invoice_due;
                            if (!dueDate)
                              return (
                                <span className="text-gray-400">
                                  Není nastaveno
                                </span>
                              );

                            const dueDateObj = new Date(dueDate);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            dueDateObj.setHours(0, 0, 0, 0);

                            const isOverdue = dueDateObj < today;
                            const isDueSoon =
                              dueDateObj <=
                                new Date(
                                  today.getTime() + 7 * 24 * 60 * 60 * 1000
                                ) && !isOverdue;

                            return (
                              <span
                                className={
                                  isOverdue
                                    ? "text-red-600 font-semibold"
                                    : isDueSoon
                                      ? "text-orange-600 font-semibold"
                                      : ""
                                }
                              >
                                {dueDateObj.toLocaleDateString("cs-CZ")}
                              </span>
                            );
                          })()}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium">
                        Celková částka bez DPH
                      </Label>
                      <p className="text-lg font-semibold text-gray-700">
                        {(() => {
                          const subtotal = (selectedInvoice.items || []).reduce(
                            (sum, item) => sum + (item.line_total || 0),
                            0
                          );
                          return subtotal.toLocaleString("cs-CZ", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          });
                        })()}{" "}
                        Kč
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">
                        Celková částka s DPH
                      </Label>
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={editForm.total_amount}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                total_amount: parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="no-spinner text-right w-40"
                          />
                          <span className="text-sm text-muted-foreground">
                            Kč
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <p className="text-lg font-semibold text-green-600">
                            {(() => {
                              // Calculate total with VAT (same as table "Celkem s DPH")
                              const totalWithVAT = (
                                selectedInvoice.items || []
                              ).reduce((sum, item) => {
                                const lineTotal = item.line_total || 0;
                                const vatRate =
                                  item.tax_rate ?? item.ingredient?.vat ?? 12;
                                const vatMultiplier = 1 + vatRate / 100;
                                const itemWithVat = lineTotal * vatMultiplier;
                                return sum + itemWithVat;
                              }, 0);

                              return totalWithVAT.toLocaleString("cs-CZ", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              });
                            })()}{" "}
                            Kč
                          </p>
                          {/* QR Code next to Celková částka */}
                          {selectedInvoice.qr_codes &&
                            selectedInvoice.qr_codes.length > 0 &&
                            selectedInvoice.qr_codes[0].type === "QRCODE" && (
                              <div className="flex-shrink-0">
                                <div className="bg-white p-1 rounded border border-gray-200">
                                  <QRCodeSVG
                                    value={selectedInvoice.qr_codes[0].data}
                                    size={100}
                                    level="M"
                                    includeMargin={true}
                                  />
                                </div>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Příjemce</Label>
                      {isEditing ? (
                        <Select
                          value={editForm.receiver_id}
                          onValueChange={(value) =>
                            setEditForm((prev) => ({
                              ...prev,
                              receiver_id: value,
                            }))
                          }
                        >
                          <SelectTrigger>
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
                      ) : (
                        <p className="text-lg">
                          {selectedInvoice.receiver_id
                            ? storeUsers.find(
                                (user) =>
                                  user.id === selectedInvoice.receiver_id
                              )?.full_name || "Neznámý příjemce"
                            : "Není nastaven"}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Invoice File Display */}
              {invoiceFileUrl && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Dokument faktury</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(() => {
                        // Get file extension from invoice file path if available
                        const invoiceAny = selectedInvoice as any;
                        const filePath =
                          invoiceAny.file_path ||
                          invoiceAny.storage_path ||
                          invoiceAny.document_path ||
                          "";
                        const fileExtension =
                          filePath.split(".").pop()?.toLowerCase() ||
                          invoiceFileUrl.split(".").pop()?.toLowerCase() ||
                          "";
                        const isPDF = fileExtension === "pdf";
                        const isImage =
                          fileExtension === "jpg" ||
                          fileExtension === "jpeg" ||
                          fileExtension === "png" ||
                          fileExtension === "gif" ||
                          fileExtension === "webp" ||
                          fileExtension === "heic" ||
                          fileExtension === "heif";

                        if (isPDF) {
                          return (
                            <div className="w-full border rounded-lg overflow-hidden">
                              <iframe
                                src={invoiceFileUrl}
                                className="w-full h-[600px]"
                                title="Invoice PDF"
                              />
                            </div>
                          );
                        } else if (isImage) {
                          return (
                            <div className="w-full border rounded-lg overflow-hidden">
                              <img
                                src={invoiceFileUrl}
                                alt="Invoice"
                                className="w-full h-auto max-h-[800px] object-contain"
                              />
                            </div>
                          );
                        } else {
                          return (
                            <div className="p-4 bg-gray-50 rounded-lg">
                              <p className="text-sm text-muted-foreground">
                                Formát souboru není podporován pro zobrazení.
                              </p>
                              <a
                                href={invoiceFileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline mt-2 inline-block"
                              >
                                Otevřít soubor
                              </a>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Invoice Items */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Položky faktury</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddItemDialogOpen(true)}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Přidat položku
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="border rounded-md">
                      <div className="px-3 py-2 bg-gray-50 border-b text-xs text-muted-foreground font-medium">
                        <div className="grid grid-cols-12 gap-4">
                          <span className="col-span-1">Kód</span>
                          <span className="col-span-3">Surovina</span>
                          <span className="col-span-2 text-right">
                            Množství (jednotka)
                          </span>
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
                        {selectedInvoice.items
                          ?.slice()
                          .sort((a, b) => {
                            // Sort by line_number to maintain OCR order
                            const aLineNumber = a.line_number ?? 999999;
                            const bLineNumber = b.line_number ?? 999999;
                            return aLineNumber - bLineNumber;
                          })
                          .map((item) => (
                            <div
                              key={item.id}
                              className="px-3 py-2 hover:bg-gray-50"
                            >
                              <div className="grid grid-cols-12 gap-4 items-center">
                                <div className="col-span-1">
                                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-700">
                                    {(() => {
                                      const ingredient = item.ingredient;
                                      if (!ingredient) return "-";

                                      const supplierCode = (
                                        ingredient as any
                                      ).ingredient_supplier_codes?.find(
                                        (code: any) =>
                                          code.supplier_id ===
                                          selectedInvoice.supplier_id
                                      );

                                      return supplierCode?.product_code || "-";
                                    })()}
                                  </code>
                                </div>
                                <div className="col-span-3 font-medium">
                                  {(() => {
                                    const ingredient = item.ingredient;
                                    if (!ingredient) return "Neznámá surovina";

                                    // Get supplier-specific ingredient name for this invoice's supplier
                                    // (not the active supplier, but the one matching the invoice)
                                    const supplierCode = (
                                      ingredient as any
                                    ).ingredient_supplier_codes?.find(
                                      (code: any) =>
                                        code.supplier_id ===
                                        selectedInvoice.supplier_id
                                    );

                                    // Always use supplier-specific name if available, otherwise fallback to main name
                                    return (
                                      supplierCode?.supplier_ingredient_name ||
                                      ingredient.name
                                    );
                                  })()}
                                </div>
                                <div className="col-span-2 pr-2">
                                  <span className="text-sm Consolas font-semibold text-right block">
                                    {(item.quantity || 0).toFixed(
                                      selectedInvoice?.supplier_id ===
                                        MAKRO_SUPPLIER_ID ||
                                        selectedInvoice?.supplier_id ===
                                          ALBERT_SUPPLIER_ID
                                        ? 3
                                        : 1
                                    )}{" "}
                                    <span className="text-gray-500">
                                      {item.unit_of_measure ||
                                        item.ingredient?.unit ||
                                        ""}
                                    </span>
                                  </span>
                                </div>
                                <div className="col-span-2 pl-2">
                                  <span className="text-sm Consolas font-semibold text-blue-900 text-right block">
                                    {(item.unit_price || 0).toLocaleString(
                                      "cs-CZ",
                                      {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      }
                                    )}{" "}
                                    Kč
                                  </span>
                                </div>
                                <div className="col-span-3 text-right font-medium pr-6">
                                  {(item.line_total || 0).toLocaleString(
                                    "cs-CZ",
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    }
                                  )}{" "}
                                  Kč
                                </div>
                                <div className="col-span-1 flex justify-end gap-1 pl-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditItem(item)}
                                    className="text-blue-600 hover:text-blue-700"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="text-red-600 hover:text-red-700"
                                    disabled={
                                      deleteInvoiceItemMutation.isPending
                                    }
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                      {/* Sum row - without VAT */}
                      <div className="px-3 py-2 bg-gray-50 border-t-2 border-gray-300 font-semibold">
                        <div className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-1"></div>
                          <div className="col-span-3">
                            <span className="text-sm font-medium text-gray-700">
                              Celkem bez DPH
                            </span>
                          </div>
                          <div className="col-span-2"></div>
                          <div className="col-span-2"></div>
                          <div className="col-span-3 text-right font-semibold text-blue-700 pr-6">
                            {(() => {
                              const total = (
                                selectedInvoice.items || []
                              ).reduce(
                                (sum, item) => sum + (item.line_total || 0),
                                0
                              );
                              return total.toLocaleString("cs-CZ", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              });
                            })()}{" "}
                            Kč
                          </div>
                          <div className="col-span-1"></div>
                        </div>
                      </div>
                      {/* Sum row - with VAT */}
                      <div className="px-3 py-2 bg-green-50 border-t font-semibold">
                        <div className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-1"></div>
                          <div className="col-span-3">
                            <span className="text-sm font-medium text-gray-700">
                              Celkem s DPH
                            </span>
                          </div>
                          <div className="col-span-2"></div>
                          <div className="col-span-2"></div>
                          <div className="col-span-3 text-right font-semibold text-green-700 pr-6">
                            {(() => {
                              console.log("=== VAT Calculation Debug ===");
                              const totalWithVAT = (
                                selectedInvoice.items || []
                              ).reduce((sum, item) => {
                                // line_total is WITHOUT VAT (base price)
                                const lineTotal = item.line_total || 0;
                                // Get VAT rate from item.tax_rate or ingredient.vat, default 12%
                                const vatRate =
                                  item.tax_rate ?? item.ingredient?.vat ?? 12;
                                console.log(
                                  `Item: ${item.ingredient?.name || "Unknown"}`
                                );
                                console.log(
                                  `  line_total (without VAT): ${lineTotal}`
                                );
                                console.log(
                                  `  item.tax_rate: ${item.tax_rate}`
                                );
                                console.log(
                                  `  ingredient.vat: ${item.ingredient?.vat}`
                                );
                                console.log(`  vatRate used: ${vatRate}%`);
                                // Calculate total WITH VAT: base_price * (1 + vat_rate/100)
                                const vatMultiplier = 1 + vatRate / 100;
                                const itemWithVat = lineTotal * vatMultiplier;
                                console.log(`  total with VAT: ${itemWithVat}`);
                                return sum + itemWithVat;
                              }, 0);
                              console.log(`Total with VAT: ${totalWithVAT}`);
                              console.log("=== End VAT Debug ===");
                              return totalWithVAT.toLocaleString("cs-CZ", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              });
                            })()}{" "}
                            Kč
                          </div>
                          <div className="col-span-1"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog
        open={isEditItemDialogOpen}
        onOpenChange={setIsEditItemDialogOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Upravit položku
            </DialogTitle>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Surovina</Label>
                {(() => {
                  const ingredient = editingItem.ingredient;
                  if (!ingredient) {
                    return (
                      <p className="text-lg font-semibold">Neznámá surovina</p>
                    );
                  }

                  // Get supplier-specific ingredient name for this invoice's supplier
                  // (not the active supplier, but the one matching the invoice)
                  const supplierCode = (
                    ingredient as any
                  ).ingredient_supplier_codes?.find(
                    (code: any) =>
                      code.supplier_id === selectedInvoice?.supplier_id
                  );

                  // Always use supplier-specific name if available, otherwise fallback to main name
                  const supplierIngredientName =
                    supplierCode?.supplier_ingredient_name;

                  return (
                    <p className="text-lg font-semibold">
                      {supplierIngredientName || ingredient.name}
                    </p>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Množství</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.001"
                    value={editItemForm.quantity}
                    onChange={(e) =>
                      setEditItemForm((prev) => ({
                        ...prev,
                        quantity: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="no-spinner text-right"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit_price">Jednotková cena (Kč)</Label>
                  <Input
                    id="unit_price"
                    type="number"
                    step="0.01"
                    value={editItemForm.unit_price}
                    onChange={(e) =>
                      setEditItemForm((prev) => ({
                        ...prev,
                        unit_price: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="no-spinner text-right"
                  />
                </div>
              </div>

              {/* Zeelandia-specific fields */}
              {/* <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fakt_mn">Fakt. mn. (kg)</Label>
                  <Input
                    id="fakt_mn"
                    type="number"
                    step="0.001"
                    value={editItemForm.fakt_mn}
                    onChange={(e) =>
                      setEditItemForm((prev) => ({
                        ...prev,
                        fakt_mn: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="no-spinner text-right"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cena_jed">Cena/jed (Kč/kg)</Label>
                  <Input
                    id="cena_jed"
                    type="number"
                    step="0.01"
                    value={editItemForm.cena_jed}
                    onChange={(e) =>
                      setEditItemForm((prev) => ({
                        ...prev,
                        cena_jed: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="no-spinner text-right"
                  />
                </div>
              </div> */}

              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Celková cena</div>
                <div className="text-lg font-semibold">
                  {(editItemForm.quantity * editItemForm.unit_price).toFixed(2)}{" "}
                  Kč
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsEditItemDialogOpen(false)}
                >
                  Zrušit
                </Button>
                <Button
                  onClick={handleUpdateItem}
                  disabled={updateInvoiceItemMutation.isPending}
                >
                  {updateInvoiceItemMutation.isPending
                    ? "Ukládám..."
                    : "Uložit"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Přidat položku
            </DialogTitle>
          </DialogHeader>

          {selectedInvoice && (
            <AddItemModal
              open={isAddItemDialogOpen}
              onClose={() => setIsAddItemDialogOpen(false)}
              onAdd={(ingredientId, quantity, unitPrice) => {
                addInvoiceItemMutation.mutate({
                  invoiceId: selectedInvoice.id,
                  ingredientId,
                  quantity,
                  unitPrice,
                });
                setIsAddItemDialogOpen(false);
              }}
              ingredients={(allIngredients?.ingredients || []).filter(
                (ingredient: any) =>
                  ingredient.ingredient_supplier_codes?.some(
                    (code: any) =>
                      code.supplier_id === selectedInvoice.supplier_id
                  )
              )}
              supplierId={selectedInvoice.supplier_id || undefined}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Price Fluctuation Dialog */}
      <IngredientPriceFluctuation
        open={isPriceFluctuationOpen}
        onClose={() => setIsPriceFluctuationOpen(false)}
        selectedMonth={selectedMonth}
        supplierId={supplierFilter !== "all" ? supplierFilter : undefined}
        receiverId={receiverFilter !== "all" ? receiverFilter : undefined}
      />
    </div>
  );
}
