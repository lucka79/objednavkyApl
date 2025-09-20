import { useState, useMemo, useEffect } from "react";
import XLSX from "xlsx-js-style";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  SquareMinus,
  SquarePlus,
  Plus,
  History,
  Trash2,
  Lock,
  Unlock,
  Edit,
  Upload,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  useUpdateOrderItems,
  useUpdateOrder,
  useDeleteOrderItem,
  useOrderItemHistory,
  useUpdateOrderTotal,
  // useUpdateStoredItems,
} from "@/hooks/useOrders";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { AddProduct } from "@/components/AddProduct";

import { useOrderItemsHistory } from "@/hooks/useOrders";
import { useAuthStore } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import { useIsOrderInvoiced } from "@/hooks/useInvoices";
import { useOrderLockStore } from "@/providers/orderLockStore";
import { useUpdateInvoiceTotal } from "@/hooks/useInvoices";
import { useQueryClient } from "@tanstack/react-query";
// import { removeDiacritics } from "@/utils/removeDiacritics";

interface OrderItem {
  id: number;
  product: {
    id: number;
    name: string;
    price: number;
    priceMobil: number;
    priceBuyer: number;
    code: string;
  };
  quantity: number;
  price: number;
  checked?: boolean;
}

interface UpdateCartProps {
  items: OrderItem[];
  orderId: number;
  onUpdate: () => Promise<void>;
  selectedUserId: string;
  order: {
    status: string;
    isLocked: boolean;
  };
}

// interface OrderHistory {
//   id: number;
//   old_quantity: number;
//   new_quantity: number;
//   changed_at: string;
//   product_name: string;
//   changed_by: { full_name: string }[];
//   order_item_id: number;
//   order_id: number;
// }

const HistoryDialog = ({ itemId }: { itemId: number }) => {
  const { data: historyData } = useOrderItemHistory(itemId);

  if (!historyData || historyData.length === 0) {
    return (
      <div className="p-4 text-sm text-slate-500">
        No changes have been recorded for this item.
      </div>
    );
  }

  return (
    <div className="flex flex-col max-h-[400px] overflow-y-auto w-[400px]">
      {historyData.map((entry: any) => (
        <div
          key={entry.id}
          className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-2"
        >
          <div className="font-medium text-slate-900">
            {/* @ts-ignore */}
            {entry.order_items?.product?.name || "Unknown Product"}
          </div>
          <div className="text-xs text-slate-600">
            {" ID # "}
            {entry.order_item_id}
          </div>
          <div className="text-sm text-slate-600">
            Quantity: {entry.old_quantity} → {entry.new_quantity}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {/* @ts-ignore */}
            Changed by: {entry.profiles?.full_name || "Unknown User"}
          </div>
          <div className="text-xs text-slate-400">
            {new Date(entry.changed_at).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
};

const PriceEditDialog = ({
  item,
  isOpen,
  onClose,
  onSave,
  onOpenChange,
}: {
  item: OrderItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (itemId: number, newPrice: number) => void;
  onOpenChange?: (open: boolean) => void;
}) => {
  const [price, setPrice] = useState<number>(0);

  useEffect(() => {
    if (item) {
      setPrice(item.price);
    }
  }, [item]);

  const handleSave = () => {
    if (item && price >= 0) {
      onSave(item.id, price);
      onClose();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upravit cenu</DialogTitle>
          <DialogDescription>
            Změňte cenu pro položku: {item.product.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="price" className="w-20">
              Cena:
            </Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              onKeyDown={handleKeyPress}
              className="flex-1"
              autoFocus
            />
            <span className="text-sm text-muted-foreground">Kč</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Současná cena: {item.price.toFixed(2)} Kč
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Zrušit
          </Button>
          <Button onClick={handleSave} disabled={price < 0}>
            Uložit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function UpdateCart({
  items,
  orderId,
  onUpdate,
  // selectedUserId,
  order,
}: UpdateCartProps) {
  const [orderItems, setOrderItems] = useState<OrderItem[]>(items);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [editingPriceItem, setEditingPriceItem] = useState<OrderItem | null>(
    null
  );
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(
    null
  );
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const { mutate: updateOrderItems } = useUpdateOrderItems();
  const { mutate: updateOrder } = useUpdateOrder();
  const { mutate: updateOrderTotal } = useUpdateOrderTotal();
  // const { mutateAsync: updateStoredItems } = useUpdateStoredItems();
  const { mutateAsync: deleteOrderItem } = useDeleteOrderItem();
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);
  const { data: invoicedOrderIds } = useIsOrderInvoiced();
  const isLocked = invoicedOrderIds?.has(orderId);
  const { isOrderUnlocked, lockOrder, unlockOrder } = useOrderLockStore();
  const isReadOnly = isLocked && !isOrderUnlocked(orderId);
  const { mutate: updateInvoiceTotal } = useUpdateInvoiceTotal();
  const queryClient = useQueryClient();

  // @ts-ignore
  const { data: historyData, isLoading } = useOrderItemHistory(selectedItemId);
  const { data: allHistoryData } = useOrderItemsHistory(orderItems);

  const canUnlock = user?.role === "admin" || user?.role === "expedition";

  const toggleLock = () => {
    if (!canUnlock) return;
    const currentlyUnlocked = isOrderUnlocked(orderId);
    if (currentlyUnlocked) {
      lockOrder(orderId);
    } else {
      unlockOrder(orderId);
    }
    toast({
      title: currentlyUnlocked ? "Order locked" : "Order unlocked",
      description: currentlyUnlocked
        ? "The order has been locked"
        : "The order is now unlocked. You can make changes.",
      variant: currentlyUnlocked ? "default" : "destructive",
    });
  };

  // Memoize the combined and sorted items
  const processedItems = useMemo(() => {
    const combinedItems = items.reduce((acc: OrderItem[], curr) => {
      const existingItem = acc.find(
        (item) => item.product.id === curr.product.id
      );
      if (existingItem) {
        existingItem.quantity += curr.quantity;
        return acc;
      }
      return [...acc, curr];
    }, []);

    return combinedItems.sort((a, b) => {
      if ((a.quantity === 0) !== (b.quantity === 0)) {
        return a.quantity === 0 ? 1 : -1;
      }
      return a.product.name.localeCompare(b.product.name, "cs");
    });
  }, [items]);

  useEffect(() => {
    setOrderItems(processedItems);
  }, [processedItems]);

  // Call onUpdate when component unmounts or when there are significant changes
  useEffect(() => {
    return () => {
      // When component unmounts, ensure parent gets updated data
      onUpdate();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["expeditionOrders"] });
    };
  }, [onUpdate, queryClient]);

  const calculateTotal = () => {
    return orderItems.reduce((sum: number, item: OrderItem) => {
      return sum + item.quantity * item.price;
    }, 0);
  };

  const total = useMemo(() => calculateTotal(), [orderItems]);

  const handleDeleteItem = async (itemId: number) => {
    if (isReadOnly) {
      toast({
        title: "Order is locked",
        description: "This order is part of an invoice and cannot be modified.",
        variant: "destructive",
      });
      return;
    }
    try {
      // First delete history records - corrected table name
      await supabase
        .from("order_items_history")
        .delete()
        .eq("order_item_id", itemId);

      // Then delete the order item
      await deleteOrderItem({ itemId, orderId });
      await onUpdate();
      setOrderItems((prevItems) =>
        prevItems.filter((item) => item.id !== itemId)
      );
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      });
    }
  };

  const updateOrderQuantity = async (itemId: number, newQuantity: number) => {
    if (isLocked || order.isLocked) {
      return;
    }

    if (newQuantity < 0) return;

    try {
      const currentItem = orderItems.find((item) => item.id === itemId);
      if (!currentItem) return;

      // Update local state immediately for better UX
      setOrderItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId ? { ...item, quantity: newQuantity } : item
        )
      );

      // Batch database updates
      await Promise.all([
        updateOrderItems({
          id: itemId,
          updatedFields: { quantity: newQuantity },
        }),
        updateOrder({
          id: orderId,
          updatedFields: {
            total: orderItems.reduce(
              (sum, item) =>
                sum +
                (item.id === itemId ? newQuantity : item.quantity) * item.price,
              0
            ),
          },
        }),
      ]);

      if (isLocked) {
        const { data: invoice } = await supabase
          .from("invoices")
          .select("id")
          .contains("order_ids", [orderId])
          .single();

        if (invoice) {
          updateInvoiceTotal(invoice.id);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["expeditionOrders"] });
    } catch (error) {
      // Revert local state on error
      setOrderItems(items);
      console.error("Failed to update quantity:", error);
    }
  };

  const updateOrderPrice = async (itemId: number, newPrice: number) => {
    if (isLocked || order.isLocked) {
      return;
    }

    if (newPrice < 0) return;

    try {
      const currentItem = orderItems.find((item) => item.id === itemId);
      if (!currentItem) return;

      // Update local state immediately for better UX
      setOrderItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId ? { ...item, price: newPrice } : item
        )
      );

      // Update the order item price
      await updateOrderItems({
        id: itemId,
        updatedFields: { price: newPrice },
      });

      // Update the order total
      updateOrderTotal(orderId);

      if (isLocked) {
        const { data: invoice } = await supabase
          .from("invoices")
          .select("id")
          .contains("order_ids", [orderId])
          .single();

        if (invoice) {
          updateInvoiceTotal(invoice.id);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["expeditionOrders"] });
    } catch (error) {
      // Revert local state on error
      setOrderItems(items);
      console.error("Failed to update price:", error);
    }
  };

  const openPriceEditModal = (item: OrderItem) => {
    setEditingPriceItem(item);
  };

  const closePriceEditModal = async () => {
    setEditingPriceItem(null);

    // Update parent component and invalidate queries when modal closes
    await onUpdate();
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["expeditionOrders"] });
  };

  const handlePriceSave = async (itemId: number, newPrice: number) => {
    await updateOrderPrice(itemId, newPrice);
    closePriceEditModal();

    // Update parent component and invalidate queries
    await onUpdate();
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["expeditionOrders"] });
  };

  const handleCheckChange = async (itemId: number, checked: boolean) => {
    console.log("Starting status update...");
    if (
      isReadOnly &&
      !(user?.role === "store" && order?.status === "Přeprava")
    ) {
      console.log("Order is readonly, showing lock toast");
      toast({
        title: "Order is locked",
        description: "This order is part of an invoice and cannot be modified.",
        variant: "destructive",
      });
      return;
    }
    try {
      const currentItem = orderItems.find((item) => item.id === itemId);
      if (!currentItem) return;

      console.log("Current item:", currentItem);
      console.log(`Updating status to ${checked ? "Hotovo" : "Připravit"}`);

      // Try to update the item with timeout
      const updatePromise = new Promise(async (resolve, reject) => {
        try {
          await updateOrderItems({
            id: itemId,
            updatedFields: {
              checked,
            },
          });
          resolve(true);
        } catch (error) {
          reject(error);
        }
      });

      // Add timeout of 5 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Database operation timed out")),
          5000
        );
      });

      await Promise.race([updatePromise, timeoutPromise]);

      // If we get here, update was successful
      setOrderItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId ? { ...item, checked } : item
        )
      );

      toast({
        title: "Změna statusu",
        description: `${currentItem.product.name}: ${checked ? "Hotovo" : "Připravit"}`,
      });

      // Add this to ensure OrdersExpedition is updated
      queryClient.invalidateQueries({ queryKey: ["expeditionOrders"] });
    } catch (error) {
      console.error("Failed to update item check status:", error);

      // Revert the checkbox state in UI
      setOrderItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId ? { ...item, checked: !checked } : item
        )
      );

      toast({
        title: "Chyba",
        description:
          "Nepodařilo se uložit změnu statusu. Zkontrolujte připojení k internetu.",
        variant: "destructive",
      });
    }
  };

  const getCheckboxCounts = () => {
    const checked = orderItems.filter((item) => item.checked).length;
    const unchecked = orderItems.filter((item) => !item.checked).length;
    return { checked, unchecked };
  };

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  const addItemsToOrder = async (
    items: { quantity: number; product_id: number }[]
  ) => {
    if (isReadOnly) {
      addDebugLog("✗ Nelze přidat položky - objednávka je uzamčena");
      toast({
        title: "Order is locked",
        description: "This order is part of an invoice and cannot be modified.",
        variant: "destructive",
      });
      return;
    }

    try {
      addDebugLog(`Přidávám ${items.length} položek do objednávky...`);

      // Get product details for the items
      const productIds = items.map((item) => item.product_id);
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, price, priceMobil, priceBuyer")
        .in("id", productIds);

      if (productsError) {
        addDebugLog(
          `✗ Chyba při načítání detailů produktů: ${productsError.message}`
        );
        throw new Error("Failed to fetch product details");
      }

      addDebugLog(`Načteny detaily pro ${products?.length || 0} produktů`);

      // Combine duplicate products by summing quantities
      const combinedItems = new Map<
        number,
        { quantity: number; product_id: number }
      >();

      items.forEach((item) => {
        if (combinedItems.has(item.product_id)) {
          const existing = combinedItems.get(item.product_id)!;
          existing.quantity += item.quantity;
          addDebugLog(
            `Kombinuji duplicitní produkt ID ${item.product_id}: ${existing.quantity - item.quantity} + ${item.quantity} = ${existing.quantity}`
          );
        } else {
          combinedItems.set(item.product_id, { ...item });
        }
      });

      addDebugLog(
        `Zkombinováno ${items.length} položek do ${combinedItems.size} unikátních produktů`
      );

      // Create order items with appropriate pricing
      const orderItemsToInsert = Array.from(combinedItems.values())
        .map((item) => {
          const product = products?.find((p) => p.id === item.product_id);
          if (!product) {
            addDebugLog(`✗ Produkt nenalezen pro ID ${item.product_id}`);
            return null;
          }

          // Always use buyer price for uploaded products
          let price = product.priceBuyer;

          addDebugLog(
            `Používám kupní cenu: ${price} (běžná: ${product.price}, mobil: ${product.priceMobil}, kupní: ${product.priceBuyer})`
          );

          addDebugLog(
            `✓ Přidávám ${item.quantity}x ${product.name} (ID: ${item.product_id}) za ${price} Kč za kus`
          );

          return {
            order_id: orderId,
            product_id: item.product_id,
            quantity: item.quantity,
            price: price,
            checked: false,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      if (orderItemsToInsert.length === 0) {
        addDebugLog("✗ Žádné platné položky k vložení");
        return;
      }

      // First, delete existing order items for this order
      addDebugLog("Mažu existující položky objednávky...");
      const { error: deleteError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", orderId);

      if (deleteError) {
        addDebugLog(
          `✗ Chyba při mazání existujících položek objednávky: ${deleteError.message}`
        );
        throw new Error("Failed to delete existing order items");
      }

      addDebugLog("✓ Existující položky objednávky smazány");

      // Insert new order items
      const { error: insertError } = await supabase
        .from("order_items")
        .insert(orderItemsToInsert);

      if (insertError) {
        addDebugLog(
          `✗ Chyba při vkládání položek objednávky: ${insertError.message}`
        );
        throw new Error("Failed to insert order items");
      }

      addDebugLog(
        `✓ Úspěšně přidáno ${orderItemsToInsert.length} položek do objednávky`
      );

      // Update order total (replace total since we deleted all existing items)
      const newTotal = orderItemsToInsert.reduce(
        (sum, item) => sum + item.quantity * item.price,
        0
      );
      addDebugLog(
        `Nastavuji celkovou částku objednávky na ${newTotal} Kč (nahrazeny všechny položky)`
      );

      await updateOrder({
        id: orderId,
        updatedFields: {
          total: newTotal,
        },
      });

      // Refresh the order items
      await onUpdate();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["expeditionOrders"] });

      addDebugLog("✓ Objednávka úspěšně aktualizována");

      toast({
        title: "Položky přidány",
        description: `Úspěšně přidáno ${orderItemsToInsert.length} položek do objednávky.`,
        variant: "default",
      });
    } catch (error) {
      const err = error as Error;
      addDebugLog(`✗ Chyba při přidávání položek: ${err.message}`);
      console.error("Error adding items to order:", err);

      toast({
        title: "Chyba",
        description: "Nepodařilo se přidat položky do objednávky.",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = () => {
    setDebugLogs([]);
    setIsDebugOpen(true);
    if (fileInputRef) {
      fileInputRef.click();
    }
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        addDebugLog("Spouštím proces nahrávání souboru...");
        console.log("Starting file upload process...");

        // First, fetch all products from database
        addDebugLog("Načítám produkty z databáze...");
        console.log("Fetching products from database...");
        const { data: products, error: productsError } = await supabase
          .from("products")
          .select("id, name")
          .eq("active", true);

        if (productsError) {
          addDebugLog(`Chyba databáze: ${productsError.message}`);
          console.error("Database error:", productsError);
          throw new Error("Failed to fetch products");
        }

        addDebugLog(`Načteno ${products?.length || 0} produktů z databáze`);
        console.log("Fetched products:", products?.length || 0);

        // Products fetched for validation and logging
        addDebugLog(
          `Produkty načteny pro validaci: ${products?.length || 0} záznamů`
        );

        addDebugLog("Čtu Excel soubor...");
        console.log("Reading Excel file...");
        const data = await file.arrayBuffer();
        addDebugLog(`Velikost dat souboru: ${data.byteLength} bytů`);
        console.log("File data size:", data.byteLength);

        const workbook = XLSX.read(data, { type: "array" });
        addDebugLog(`Listy sešitu: ${workbook.SheetNames.join(", ")}`);
        console.log("Workbook sheets:", workbook.SheetNames);

        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        // Parse with headers to get proper column names
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        addDebugLog(`Načtena Excel data: ${jsonData.length} řádků`);
        console.log("Parsed Excel data:", jsonData.length, "rows");
        console.log("Sample row:", jsonData[0]);
        console.log("Available columns:", Object.keys(jsonData[0] || {}));

        // Show all available column names
        if (jsonData.length > 0) {
          const columnNames = Object.keys(jsonData[0] as Record<string, any>);
          addDebugLog(`Dostupné názvy sloupců: ${columnNames.join(", ")}`);
          console.log("All column names:", columnNames);
        }

        const items: { quantity: number; product_id: number }[] = [];
        const notFoundProducts: string[] = [];

        addDebugLog("Zpracovávám řádky...");
        console.log("Processing rows...");
        jsonData.forEach((row: any, index: number) => {
          // Skip the first row if it's the header row (contains "data-quantity")
          if (
            index === 0 &&
            String(Object.values(row)[0]).toLowerCase() === "data-quantity"
          ) {
            addDebugLog("⚠ Přeskakuji hlavičkový řádek (Řádek 1)");
            return;
          }

          // Get values from the row - your Excel has: data-quantity, product name, data-product-id
          const rowValues = Object.values(row);
          const quantity = parseInt(String(rowValues[0] || "0")); // First column: data-quantity
          const productName = String(rowValues[1] || "").trim(); // Second column: product name
          const productIdFromExcel = parseInt(String(rowValues[2] || "0")); // Third column: data-product-id

          addDebugLog(
            `Řádek ${index + 1}: množství=${quantity}, produkt="${productName}", ID_produktu=${productIdFromExcel}`
          );
          console.log(`Row ${index + 1}:`, {
            quantity,
            productName,
            productIdFromExcel,
            row,
            availableKeys: Object.keys(row),
            allValues: Object.values(row),
          });

          if (quantity > 0 && productIdFromExcel > 0) {
            // Find the product in the fetched products array using the ID from Excel
            const product = products?.find((p) => p.id === productIdFromExcel);

            if (product) {
              items.push({ quantity, product_id: product.id });
              addDebugLog(
                `✓ Přidána položka: ${quantity}x ID produktu ${product.id} (${product.name})`
              );
              console.log(
                `Added item: ${quantity}x product ID ${product.id} (${product.name})`
              );
            } else {
              notFoundProducts.push(
                `ID ${productIdFromExcel} (Název: ${productName})`
              );
              addDebugLog(
                `✗ Produkt nenalezen pro ID ${productIdFromExcel} (Název: "${productName}")`
              );
              console.log(
                `Product not found: ID ${productIdFromExcel} (Name: "${productName}")`
              );
            }
          } else {
            addDebugLog(
              `⚠ Přeskakuji řádek ${index + 1}: neplatné množství (${quantity}) nebo ID produktu (${productIdFromExcel})`
            );
            console.log(
              `Skipping row ${index + 1}: invalid quantity (${quantity}) or product ID (${productIdFromExcel})`
            );
          }
        });

        addDebugLog(
          `Zpracování dokončeno. Nalezeno ${items.length} položek, ${notFoundProducts.length} nenalezeno`
        );
        console.log("Processing complete. Results:", {
          itemsFound: items.length,
          notFoundProductsCount: notFoundProducts.length,
          parsedItems: items,
          notFoundProductsList: notFoundProducts,
        });

        if (items.length > 0) {
          addDebugLog(`✓ Úspěch! Zpracováno ${items.length} položek`);
          console.log("Parsed items:", items);

          // Add items to the order
          await addItemsToOrder(items);

          const message =
            notFoundProducts.length > 0
              ? `Nalezeno ${items.length} položek. Nenalezené produkty: ${notFoundProducts.join(", ")}`
              : `Nalezeno ${items.length} položek`;

          toast({
            title: "Soubor načten",
            description: message,
            variant: notFoundProducts.length > 0 ? "destructive" : "default",
          });
        } else {
          addDebugLog("✗ V souboru nebyly nalezeny žádné položky");
          console.log("No items found in file");
          toast({
            title: "Chyba při načítání",
            description:
              "Nenalezeny žádné položky v souboru. Zkontrolujte, že první sloupec obsahuje množství a druhý název produktu.",
            variant: "destructive",
          });
        }
      } catch (error) {
        const err = error as Error;
        addDebugLog(`✗ Chyba: ${err.message}`);
        console.error("Error details:", {
          error: err,
          message: err.message,
          stack: err.stack,
          type: err.constructor.name,
        });

        let errorMessage = "Nepodařilo se načíst soubor.";
        if (err.message.includes("Failed to fetch products")) {
          errorMessage = "Nepodařilo se načíst produkty z databáze.";
        } else if (err.message.includes("invalid zip")) {
          errorMessage =
            "Neplatný formát Excel souboru. Použijte prosím .xlsx formát.";
        }

        toast({
          title: "Chyba při načítání",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
    // Reset the input value so the same file can be selected again
    event.target.value = "";
  };

  // Add refetch interval effect
  useEffect(() => {
    // Refetch orders every 30 seconds while component is mounted
    const interval = setInterval(() => {
      console.log("Periodic refetch of orders");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    }, 30000); // 30 seconds

    // Cleanup on unmount
    return () => {
      console.log("UpdateCart unmounted, also refetching expeditionOrders");
      clearInterval(interval);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["expeditionOrders"] });
    };
  }, [queryClient]);

  return (
    <Card>
      <CardContent>
        <div className="flex flex-col">
          {/* Sticky header */}
          <div className="sticky top-0 z-10 bg-white pb-2 border-b mb-4">
            <div className="flex gap-2 pt-2 print:hidden">
              {isLocked && canUnlock && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleLock}
                  className={
                    isOrderUnlocked(orderId)
                      ? "text-red-600"
                      : "text-muted-foreground"
                  }
                >
                  {isOrderUnlocked(orderId) ? (
                    <Unlock className="h-4 w-4" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Badge variant="outline" className="border-green-500">
                Hotovo {getCheckboxCounts().checked}
              </Badge>
              <Badge variant="outline" className="border-amber-500">
                Připravit {getCheckboxCounts().unchecked}
              </Badge>
              <div className="flex gap-2 ml-auto">
                {user?.role === "admin" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFileUpload}
                    disabled={isReadOnly}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Nahrát
                  </Button>
                )}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isReadOnly}>
                      <Plus className="h-4 w-4 mr-2" />
                      Položka
                    </Button>
                  </DialogTrigger>
                  <DialogContent
                    className="max-w-6xl max-h-[90vh] overflow-y-auto"
                    aria-describedby="dialog-description"
                  >
                    <DialogTitle>Add Product to Order</DialogTitle>
                    <div id="dialog-description" className="sr-only">
                      Select products to add to the order
                    </div>
                    <AddProduct orderId={orderId} onUpdate={onUpdate} />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* Content */}
          <div>
            {!orderItems || orderItems.length === 0 ? (
              <div>No items in order.</div>
            ) : (
              orderItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex flex-row items-center pt-2 mb-2 ${
                    item.quantity === 0
                      ? "text-gray-400 scale-95 print:hidden"
                      : ""
                  } ${item.price === 0 ? "bg-yellow-50 33" : ""}`}
                >
                  {(user?.role === "admin" ||
                    user?.role === "expedition" ||
                    (user?.role === "store" &&
                      order?.status === "Přeprava")) && (
                    <Button
                      variant="ghost"
                      onClick={() => handleCheckChange(item.id, !item.checked)}
                      disabled={isReadOnly}
                      className={`mr-2 h-6 w-6 min-w-[1.5rem] min-h-[1.5rem] p-0 print:hidden ${
                        item.checked
                          ? "bg-green-500 hover:bg-green-600 text-white"
                          : "border-2 border-amber-500 hover:bg-amber-50"
                      }`}
                    >
                      {item.checked ? "✓" : ""}
                    </Button>
                  )}
                  <div className="text-xs w-10 text-left inline-block text-slate-500">
                    {item.product.code || "\u00A0"}
                  </div>
                  <div className="text-sm w-120 inline-block text-left mr-2">
                    {item.product.name}
                  </div>
                  <div className="text-sm flex-1 mr-2 text-end">
                    <div className="flex items-center justify-end gap-1">
                      <span>{item.price.toFixed(2)} Kč</span>
                      {user?.role === "admin" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openPriceEditModal(item)}
                          disabled={isReadOnly}
                          className="h-4 w-4 p-0 hover:bg-orange-50 text-orange-600"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center">
                    {(item.quantity || 0) > 0 && (
                      <SquareMinus
                        onClick={() =>
                          !item.checked &&
                          !isReadOnly &&
                          updateOrderQuantity(item.id, item.quantity - 1)
                        }
                        className={`cursor-pointer ${
                          item.checked || isReadOnly
                            ? "text-gray-200 cursor-not-allowed"
                            : "text-stone-300 hover:text-stone-400"
                        }`}
                      />
                    )}
                    <Input
                      type="number"
                      min="0"
                      value={item.quantity}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      onChange={(e) => {
                        if (isReadOnly) return;
                        const newItem = {
                          ...item,
                          quantity: parseInt(e.target.value) || 0,
                        };
                        setOrderItems((prev) =>
                          prev.map((i) => (i.id === item.id ? newItem : i))
                        );
                      }}
                      onBlur={(e) =>
                        !item.checked &&
                        !isReadOnly &&
                        updateOrderQuantity(
                          item.id,
                          parseInt(e.target.value) || 0
                        )
                      }
                      disabled={item.checked || isReadOnly}
                      className={`w-20 mx-2 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                        item.quantity === 0 ? "text-gray-600" : ""
                      }`}
                    />
                    <SquarePlus
                      onClick={() =>
                        !item.checked &&
                        !isReadOnly &&
                        updateOrderQuantity(item.id, item.quantity + 1)
                      }
                      className={`cursor-pointer ${
                        item.checked || isReadOnly
                          ? "text-gray-200 cursor-not-allowed"
                          : "text-stone-300 hover:text-stone-400"
                      }`}
                    />
                    <Label className="w-20 inline-block text-left mx-2">
                      {(item.price * item.quantity).toFixed(2)} Kč
                    </Label>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!allHistoryData?.includes(item.id)}
                          className={`ml-2 ${
                            !allHistoryData?.includes(item.id)
                              ? "opacity-30 cursor-not-allowed"
                              : "hover:bg-slate-50 text-orange-500"
                          }`}
                          onClick={() => setSelectedItemId(item.id)}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Historie položky</DialogTitle>
                        </DialogHeader>
                        <HistoryDialog itemId={item.id} />
                      </DialogContent>
                    </Dialog>
                    {user?.role === "admin" && (
                      <Trash2
                        onClick={() => !isReadOnly && handleDeleteItem(item.id)}
                        className={`h-4 w-4 cursor-pointer ml-2 ${
                          isReadOnly
                            ? "text-gray-200 cursor-not-allowed"
                            : "text-stone-300 hover:text-red-500"
                        }`}
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="flex flex-row justify-end font-bold text-slate-600 w-full mt-4">
          <span className="text-base">{total.toFixed(2)} Kč</span>
        </div>
      </CardContent>

      {/* Price Edit Dialog */}
      <PriceEditDialog
        item={editingPriceItem}
        isOpen={!!editingPriceItem}
        onClose={closePriceEditModal}
        onSave={handlePriceSave}
        onOpenChange={(open) => {
          if (!open) {
            closePriceEditModal();
          }
        }}
      />

      {/* Hidden file input */}
      <input
        type="file"
        ref={setFileInputRef}
        onChange={handleFileSelect}
        style={{ display: "none" }}
        accept=".xls,.xlsx"
      />

      {/* Debug Modal */}
      <Dialog open={isDebugOpen} onOpenChange={setIsDebugOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Ladění - Proces nahrávání souboru</DialogTitle>
            <DialogDescription>
              Logy v reálném čase pro proces nahrávání a zpracování souboru
            </DialogDescription>
          </DialogHeader>
          <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-[60vh] overflow-y-auto">
            {debugLogs.length === 0 ? (
              <div className="text-gray-500">Čekám na nahrání souboru...</div>
            ) : (
              debugLogs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const logsText = debugLogs.join("\n");
                navigator.clipboard.writeText(logsText);
                toast({
                  title: "Logy zkopírovány",
                  description: "Ladící logy zkopírovány do schránky",
                });
              }}
              disabled={debugLogs.length === 0}
            >
              Kopírovat logy
            </Button>
            <Button
              variant="outline"
              onClick={() => setDebugLogs([])}
              disabled={debugLogs.length === 0}
            >
              Vymazat logy
            </Button>
            <Button onClick={() => setIsDebugOpen(false)}>Zavřít</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
