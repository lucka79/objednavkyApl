import { useState, useRef, useEffect } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { Textarea } from "@/components/ui/textarea";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import { Progress } from "@/components/ui/progress";

import { Alert, AlertDescription } from "@/components/ui/alert";

import { Upload, FileText, CheckCircle, X, Pencil } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useToast } from "@/hooks/use-toast";

import { useSupplierUsers, useStoreUsers } from "@/hooks/useProfiles";

import { useDocumentAI } from "@/hooks/useDocumentAI";

import { useInvoiceTemplates } from "@/hooks/useInvoiceTemplates";

import { AddReceivedInvoiceForm } from "./AddReceivedInvoiceForm";

interface ParsedInvoiceItem {
  id: string;

  name: string;

  quantity: number;

  unit: string;

  price: number;

  total: number;

  supplierCode?: string;

  confidence: number;

  matchStatus?: string;

  ingredientId?: number | null;

  ingredientName?: string | null;

  // Weight-based fields (for MAKRO and similar suppliers)

  packageWeightKg?: number;

  totalWeightKg?: number;

  pricePerKg?: number;

  basePrice?: number;

  unitsInMu?: number;
}

interface ParsedInvoice {
  id: string;

  supplier: string;

  invoiceNumber: string;

  date: string;

  totalAmount: number;

  subtotal?: number;

  paymentType?: string;
  items: ParsedInvoiceItem[];

  confidence: number;

  status: "pending" | "reviewed" | "approved" | "rejected";

  unmappedCount?: number;

  templateUsed?: string;

  qrCodes?: Array<{ data: string; type: string; page: number }>;
}

// MAKRO supplier ID (weight-based layout)

const MAKRO_SUPPLIER_ID = "16293f61-b9e8-4016-9882-0b8fa90125e4";

// Zeelandia supplier ID (Zeelandia-specific layout)
const ZEELANDIA_SUPPLIER_ID = "52a93272-88b5-40c2-8c49-39d51250a64a";

export function InvoiceUploadDialog() {
  const [isOpen, setIsOpen] = useState(false);

  const [uploading, setUploading] = useState(false);

  const [uploadProgress, setUploadProgress] = useState(0);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [parsedInvoice, setParsedInvoice] = useState<ParsedInvoice | null>(
    null
  );

  const [selectedSupplier, setSelectedSupplier] = useState<string>("");

  const [invoiceSupplier, setInvoiceSupplier] = useState<string>("");

  const [selectedReceiver, setSelectedReceiver] = useState<string>("");

  const [currentUserRole, setCurrentUserRole] = useState<string>("");

  const [notes, setNotes] = useState("");

  const [currentStep, setCurrentStep] = useState<
    "supplier" | "upload" | "manual" | "review"
  >("supplier");

  const [editedDescriptions, setEditedDescriptions] = useState<{
    [key: string]: string;
  }>({});

  const [editedTotalWeights, setEditedTotalWeights] = useState<{
    [key: string]: number;
  }>({});
  const [editedPrices, setEditedPrices] = useState<{
    [key: string]: number;
  }>({});
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);

  // Calculate subtotal using edited values for Zeelandia
  const calculateSubtotal = () => {
    if (!parsedInvoice) return 0;

    const isZeelandia =
      selectedSupplier === ZEELANDIA_SUPPLIER_ID ||
      invoiceSupplier === ZEELANDIA_SUPPLIER_ID;

    if (isZeelandia) {
      return parsedInvoice.items.reduce((sum, item) => {
        const finalTotalWeight =
          editedTotalWeights[item.id] ?? item.totalWeightKg ?? 0;
        const finalPrice = editedPrices[item.id] ?? item.price ?? 0;
        return sum + parseFloat((Math.floor(finalTotalWeight) * Math.floor(finalPrice)).toFixed(2));
      }, 0);
    }

    // For non-Zeelandia, use original calculation
    return parsedInvoice.items.reduce((sum, item) => {
      const itemTotal = item.total || item.quantity * item.price || 0;
      return sum + itemTotal;
    }, 0);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  const queryClient = useQueryClient();

  const { data: supplierUsers } = useSupplierUsers();

  const { data: storeUsers } = useStoreUsers();

  const { processDocumentWithTemplate } = useDocumentAI();

  const { templates } = useInvoiceTemplates(); // Fetch all templates to check which suppliers have them

  // Get current user and set default receiver

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { supabase } = await import("@/lib/supabase");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase

          .from("profiles")

          .select("role")

          .eq("id", user.id)

          .single();

        if (profile) {
          setCurrentUserRole(profile.role);

          // If admin, set default receiver_id

          if (profile.role === "admin") {
            setSelectedReceiver("e597fcc9-7ce8-407d-ad1a-fdace061e42f");
          }
        }
      }
    };

    fetchCurrentUser();
  }, []);

  const handleSupplierSelect = (supplierId: string) => {
    setInvoiceSupplier(supplierId);

    setCurrentStep("upload");
  };

  // Helper function to check if supplier has an active template

  const hasActiveTemplate = (supplierId: string) => {
    return templates?.some(
      (template) => template.supplier_id === supplierId && template.is_active
    );
  };

  const handleManualEntry = () => {
    setCurrentStep("manual");
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
        toast({
          title: "Chyba",

          description: "Podporované formáty: PDF, JPG, PNG",

          variant: "destructive",
        });

        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !invoiceSupplier) return;

    setUploading(true);

    setUploadProgress(0);

    try {
      // Simulate upload progress

      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);

            return 90;
          }

          return prev + 10;
        });
      }, 200);

      // Use the NEW template-based processor with auto-matching

      const result = await processDocumentWithTemplate(
        selectedFile,

        invoiceSupplier
      );

      if (result.success && result.data) {
        clearInterval(progressInterval);

        setUploadProgress(100);

        setCurrentStep("review");

        // Map extracted items with ingredient matching info

        const items = result.data.items.map((item: any, index: number) => ({
          id: (index + 1).toString(),

          name: item.description || item.name,

          quantity: item.quantity,

          unit: item.unit_of_measure || item.unit,

          price: item.unit_price || item.price,

          total: item.total_price || item.total || item.line_total,

          supplierCode: item.product_code || item.supplierCode,

          confidence: item.match_confidence || item.confidence || 0,

          matchStatus: item.match_status,

          ingredientId: item.matched_ingredient_id,

          ingredientName: item.matched_ingredient_name,

          // Weight-based fields

          packageWeightKg: item.package_weight_kg,

          totalWeightKg: item.total_weight_kg,

          pricePerKg: item.price_per_kg,

          basePrice: item.base_price,

          unitsInMu: item.units_in_mu,
        }));

        // Calculate subtotal (without VAT) from line items

        const subtotal = items.reduce((sum: number, item: any) => {
          const itemTotal = item.total || item.quantity * item.price || 0;

          return sum + itemTotal;
        }, 0);

        // Use the extracted total from invoice (includes VAT)

        const extractedTotal = result.data.totalAmount || 0;

        // Get supplier name

        const supplierName =
          supplierUsers?.find((s: any) => s.id === invoiceSupplier)
            ?.full_name || invoiceSupplier;

        setParsedInvoice({
          id: `inv_${Date.now()}`,

          supplier: supplierName,

          invoiceNumber: result.data.invoiceNumber,

          date: result.data.date,

          totalAmount: extractedTotal, // Total with VAT

          subtotal: subtotal, // Total without VAT (calculated from items)

          paymentType: result.data.paymentType,
          items,

          confidence: result.data.confidence / 100 || 0,

          status: "pending",

          unmappedCount: result.data.unmapped_codes || 0,

          templateUsed: result.data.template_used,

          qrCodes: result.data.qr_codes,
        });

        // Auto-select the supplier in the dropdown

        setSelectedSupplier(invoiceSupplier);

        const unmappedCount = items.filter(
          (i: any) => i.matchStatus === "unmapped"
        ).length;

        toast({
          title: "✅ Faktura zpracována!",

          description:
            unmappedCount > 0
              ? `Extrahováno ${items.length} položek (${unmappedCount} nenamapováno)`
              : `Všech ${items.length} položek úspěšně namapováno`,
        });
      } else {
        throw new Error(result.error || "Failed to process document");
      }
    } catch (error) {
      toast({
        title: "Chyba",

        description: "Nepodařilo se zpracovat fakturu",

        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleApprove = async () => {
    if (!parsedInvoice) return;

    // Validate that a supplier is selected

    const supplierId = selectedSupplier || invoiceSupplier;

    if (!supplierId) {
      toast({
        title: "Chyba",

        description: "Vyberte prosím dodavatele před uložením faktury",

        variant: "destructive",
      });

      return;
    }

    try {
      // Check if invoice with this number already exists

      const { supabase } = await import("@/lib/supabase");

      console.log("🔍 Checking for duplicate invoice:", {
        invoiceNumber: parsedInvoice.invoiceNumber,

        invoiceNumberType: typeof parsedInvoice.invoiceNumber,

        supplierId: supplierId,
      });

      const { data: existingInvoice, error: checkError } = await supabase

        .from("invoices_received")

        .select("id, invoice_number, supplier_id")

        .eq("invoice_number", parsedInvoice.invoiceNumber)

        .eq("supplier_id", supplierId)

        .maybeSingle();

      console.log("✅ Duplicate check result:", {
        found: !!existingInvoice,

        existingInvoice,

        checkError,
      });

      if (checkError && checkError.code !== "PGRST116") {
        throw checkError;
      }

      // Convert date from DD.MM.YYYY to YYYY-MM-DD format

      const convertDateToISO = (dateStr: string): string => {
        const parts = dateStr.split(".");

        if (parts.length === 3) {
          const [day, month, year] = parts;

          return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }

        return dateStr; // Return as-is if already in correct format
      };

      const isoDate = convertDateToISO(parsedInvoice.date);

      let savedInvoice;

      if (existingInvoice) {
        const confirmed = window.confirm(
          `Faktura s číslem "${parsedInvoice.invoiceNumber}" od dodavatele "${parsedInvoice.supplier}" již existuje!\n\n` +
            `Existující faktura ID: ${existingInvoice.id}\n\n` +
            `Chcete přepsat existující fakturu a její položky?`
        );

        if (!confirmed) {
          return; // User cancelled
        }

        // Delete existing items

        const { error: deleteItemsError } = await supabase

          .from("items_received")

          .delete()

          .eq("invoice_received_id", existingInvoice.id);

        if (deleteItemsError) throw deleteItemsError;

        // Update existing invoice

        const { data: updatedInvoice, error: updateError } = await supabase

          .from("invoices_received")

          .update({
            invoice_date: isoDate,

            total_amount: parsedInvoice.totalAmount,

            receiver_id: selectedReceiver || null,

            qr_codes: parsedInvoice.qrCodes || null,

            updated_at: new Date().toISOString(),
          })

          .eq("id", existingInvoice.id)

          .select()

          .single();

        if (updateError) throw updateError;

        savedInvoice = updatedInvoice;
      } else {
        // Create new invoice

        const { data: newInvoice, error: invoiceError } = await supabase

          .from("invoices_received")

          .insert({
            invoice_number: parsedInvoice.invoiceNumber,

            supplier_id: supplierId,

            invoice_date: isoDate,

            total_amount: parsedInvoice.totalAmount,

            receiver_id: selectedReceiver || null,

            qr_codes: parsedInvoice.qrCodes || null,
          })

          .select()

          .single();

        if (invoiceError) throw invoiceError;

        savedInvoice = newInvoice;
      }

      // Save items that have matched ingredients

      const matchedItems = parsedInvoice.items.filter(
        (item) => item.ingredientId
      );

      if (matchedItems.length > 0) {
        const itemsToInsert = matchedItems.map((item, index) => {
          // For Zeelandia, use totalWeightKg as quantity and price as unit_price
          const isZeelandia =
            selectedSupplier === ZEELANDIA_SUPPLIER_ID ||
            invoiceSupplier === ZEELANDIA_SUPPLIER_ID;

          // Use edited values if available, otherwise fall back to original values
          const quantity = isZeelandia
            ? Math.floor(
                (editedTotalWeights[item.id] ?? item.totalWeightKg) || 0
              )
            : item.quantity;
          const unitPrice = isZeelandia
            ? Math.floor((editedPrices[item.id] ?? item.price) || 0)
            : item.price;
          const lineTotal = parseFloat((Math.floor(quantity) * Math.floor(unitPrice)).toFixed(2)); // Use Math.floor for both before multiplying and fix decimals

          const baseInsert: any = {
            invoice_received_id: savedInvoice.id,

            matched_ingredient_id: item.ingredientId!,

            quantity: quantity,

            unit_price: unitPrice,

            line_total: lineTotal,

            line_number: index + 1,

            unit_of_measure: isZeelandia ? "kg" : item.unit,

            matching_confidence: item.confidence || 100,
          };

          // Add weight-based fields if available (for MAKRO and similar suppliers)

          if (item.totalWeightKg !== undefined) {
            baseInsert.total_weight_kg = item.totalWeightKg;
          }

          if (item.pricePerKg !== undefined) {
            baseInsert.price_per_kg = item.pricePerKg;
          }

          if (item.packageWeightKg !== undefined) {
            baseInsert.package_weight_kg = item.packageWeightKg;
          }

          // Add Zeelandia-specific fields if available
          if (isZeelandia) {
            // Use edited values for Zeelandia fields
            const faktMn = editedTotalWeights[item.id] ?? item.totalWeightKg;
            const cenaJed = editedPrices[item.id] ?? item.price;

            if (faktMn !== undefined) {
              baseInsert.fakt_mn = faktMn; // Fakt. mn. = total weight
            }

            if (cenaJed !== undefined) {
              baseInsert.cena_jed = Math.floor(cenaJed); // Cena/jed = unit price (rounded down)
            }
          }

          return baseInsert;
        });

        const { error: itemsError } = await supabase

          .from("items_received")

          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Show success message

      const unmappedCount = parsedInvoice.items.length - matchedItems.length;

      toast({
        title: "✅ Faktura byla uložena!",

        description:
          unmappedCount > 0
            ? `Uloženo ${matchedItems.length} položek (${unmappedCount} nenamapovaných přeskočeno)`
            : `Všech ${matchedItems.length} položek bylo úspěšně uloženo`,
      });

      // Invalidate received invoices query to refresh the list

      queryClient.invalidateQueries({ queryKey: ["receivedInvoices"] });

      setIsOpen(false);

      setParsedInvoice(null);

      setSelectedFile(null);

      setUploadProgress(0);

      setCurrentStep("supplier");

      setInvoiceSupplier("");

      setSelectedSupplier("");

      setNotes("");

      // Reset receiver to default if admin

      if (currentUserRole === "admin") {
        setSelectedReceiver("e597fcc9-7ce8-407d-ad1a-fdace061e42f");
      } else {
        setSelectedReceiver("");
      }
    } catch (error) {
      console.error("Error checking/saving invoice:", error);

      toast({
        title: "Chyba",

        description: "Nepodařilo se zkontrolovat nebo uložit fakturu",

        variant: "destructive",
      });
    }
  };

  const handleReject = () => {
    setParsedInvoice(null);

    setSelectedFile(null);

    setUploadProgress(0);

    setCurrentStep("supplier");

    setInvoiceSupplier("");

    // Reset receiver to default if admin

    if (currentUserRole === "admin") {
      setSelectedReceiver("e597fcc9-7ce8-407d-ad1a-fdace061e42f");
    } else {
      setSelectedReceiver("");
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "text-green-600";

    if (confidence >= 0.7) return "text-yellow-600";

    return "text-red-600";
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9)
      return <Badge className="bg-green-100 text-green-800">Vysoká</Badge>;

    if (confidence >= 0.7)
      return <Badge className="bg-yellow-100 text-yellow-800">Střední</Badge>;

    return <Badge variant="destructive">Nízká</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-orange-600 hover:bg-orange-700">
          <Upload className="h-4 w-4 mr-2" />
          Nahrát fakturu
        </Button>
      </DialogTrigger>

      <DialogContent
        className="max-w-7xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Nahrát a zpracovat fakturu</DialogTitle>

          <DialogDescription>
            Nahrajte fakturu od dodavatele pro automatické zpracování pomocí
            natrénovaných šablon s inteligentním mapováním surovin
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Supplier Selection Step */}

          {currentStep === "supplier" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">1. Výběr dodavatele</CardTitle>

                <p className="text-sm text-muted-foreground">
                  Vyberte dodavatele pro použití správné šablony faktury
                </p>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {supplierUsers?.map((supplier: any) => {
                    const hasTrained = hasActiveTemplate(supplier.id);

                    return (
                      <Button
                        key={supplier.id}
                        variant="outline"
                        className={`h-20 flex flex-col items-center justify-center gap-2 ${
                          hasTrained
                            ? "bg-green-50 border-green-300 hover:bg-green-100 hover:border-green-400"
                            : "bg-gray-50 border-gray-300 hover:bg-gray-100 hover:border-gray-400"
                        }`}
                        onClick={() => handleSupplierSelect(supplier.id)}
                      >
                        <div className="font-medium flex items-center gap-2">
                          {hasTrained && (
                            <span className="text-green-600">✓</span>
                          )}

                          {supplier.full_name}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {hasTrained
                            ? "✓ Natrénovaná šablona OCR + auto-mapování"
                            : "⚠️ Šablona není natrénována"}
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* File Upload Section */}

          {currentStep === "upload" && !parsedInvoice && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">2. Výběr souboru</CardTitle>

                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold">Dodavatel:</span>{" "}
                  {supplierUsers?.find((s: any) => s.id === invoiceSupplier)
                    ?.full_name || "Neznámý"}
                </p>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="invoice-file">Faktura (PDF, JPG, PNG)</Label>

                  <Input
                    id="invoice-file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileSelect}
                    ref={fileInputRef}
                    className="mt-2"
                  />
                </div>

                {selectedFile && (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
                    <FileText className="h-4 w-4 text-blue-600" />

                    <span className="text-sm">{selectedFile.name}</span>

                    <span className="text-xs text-gray-500">
                      ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {uploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Zpracovávání faktury...</span>

                      <span>{uploadProgress}%</span>
                    </div>

                    <Progress value={uploadProgress} className="w-full" />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep("supplier")}
                    disabled={uploading}
                  >
                    ← Zpět na výběr dodavatele
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleManualEntry}
                    disabled={uploading}
                  >
                    Manuální zadání
                  </Button>

                  <Button
                    onClick={handleUpload}
                    disabled={!selectedFile || uploading}
                    className="flex-1"
                  >
                    {uploading ? "Zpracovávání..." : "Zpracovat fakturu"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Manual Invoice Entry */}

          {currentStep === "manual" && <AddReceivedInvoiceForm />}

          {/* Parsed Invoice Review */}

          {currentStep === "review" && parsedInvoice && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  3. Kontrola zpracovaných dat
                </CardTitle>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Spolehlivost:</span>

                  {getConfidenceBadge(parsedInvoice.confidence)}

                  <span
                    className={`text-sm font-medium ${getConfidenceColor(parsedInvoice.confidence)}`}
                  >
                    {(parsedInvoice.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Invoice Header */}

                <div className="p-4 bg-gray-50 rounded-md space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Dodavatel</Label>

                      <p className="text-sm">{parsedInvoice.supplier}</p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">
                        Číslo faktury
                      </Label>

                      <p className="text-sm">{parsedInvoice.invoiceNumber}</p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Datum</Label>

                      <p className="text-sm">{parsedInvoice.date}</p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">
                        Způsob platby
                      </Label>
                      <p className="text-sm">
                        {parsedInvoice.paymentType || (
                          <span className="text-gray-400">Nenalezeno</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">
                        Mezisoučet (bez DPH)
                      </Label>

                      <p className="text-base">
                        {calculateSubtotal().toLocaleString("cs-CZ")} Kč
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium text-green-700">
                        Celková částka (s DPH)
                      </Label>

                      <p className="text-lg font-bold text-green-600">
                        {parsedInvoice.totalAmount.toLocaleString("cs-CZ", {
                          minimumFractionDigits: 2,

                          maximumFractionDigits: 2,
                        })}{" "}
                        Kč
                      </p>
                    </div>
                  </div>
                </div>

                {/* PDF Preview and QR Codes Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* PDF Preview */}
                  {selectedFile && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                      <Label className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                        <span className="text-lg">📄</span>
                        Náhled faktury
                      </Label>
                      <div className="bg-white border border-blue-200 rounded-md p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium">
                              {selectedFile.name}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({(selectedFile.size / 1024 / 1024).toFixed(2)}{" "}
                              MB)
                            </span>
                          </div>
                        </div>

                        {/* PDF Preview */}
                        <div className="border border-gray-200 rounded-md overflow-hidden">
                          <iframe
                            src={URL.createObjectURL(selectedFile)}
                            className="w-full h-96"
                            title="PDF Preview"
                          />
                        </div>

                        <div className="mt-3 text-xs text-gray-600">
                          💡 Náhled slouží pro vizuální kontrolu správnosti
                          zpracování
                        </div>
                      </div>
                    </div>
                  )}

                  {/* QR Codes Section */}
                  {parsedInvoice.qrCodes &&
                    parsedInvoice.qrCodes.length > 0 && (
                      <div className="p-4 bg-purple-50 border border-purple-200 rounded-md">
                        <Label className="text-sm font-semibold text-purple-800 mb-3 flex items-center gap-2">
                          <span className="text-lg">📱</span>
                          QR kódy a čárové kódy nalezené na faktuře
                        </Label>
                        <div className="space-y-4">
                          {parsedInvoice.qrCodes.map((qr, idx) => (
                            <div
                              key={idx}
                              className="bg-white border border-purple-200 rounded-md p-4"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-purple-100 text-purple-700 text-xs">
                                    Strana {qr.page}
                                  </Badge>
                                  <span className="text-xs text-gray-600">
                                    {qr.type === "QRCODE"
                                      ? "QR kód"
                                      : "Čárový kód"}
                                  </span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => {
                                    navigator.clipboard.writeText(qr.data);
                                    toast({
                                      title: "Zkopírováno",
                                      description:
                                        "Data byla zkopírována do schránky",
                                    });
                                  }}
                                >
                                  📋 Kopírovat
                                </Button>
                              </div>

                              {/* QR Code Image */}
                              {qr.type === "QRCODE" && (
                                <div className="flex flex-col items-center space-y-3">
                                  <div className="bg-white p-3 rounded-lg border-2 border-gray-200">
                                    <QRCodeSVG
                                      value={qr.data}
                                      size={128}
                                      level="M"
                                      includeMargin={true}
                                    />
                                  </div>
                                  <div className="text-xs text-gray-500 text-center max-w-xs">
                                    Naskenujte QR kód pro rychlý přístup k datům
                                  </div>
                                </div>
                              )}

                              {/* Raw Data */}
                              <div className="mt-3 bg-gray-50 p-2 rounded border border-gray-200">
                                <div className="text-xs text-gray-600 mb-1">
                                  Surová data:
                                </div>
                                <code className="text-xs break-all font-mono text-gray-700">
                                  {qr.data}
                                </code>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>

                {/* Supplier Selection */}

                <div>
                  <Label htmlFor="supplier-select">Přiřadit k dodavateli</Label>

                  <Select
                    value={selectedSupplier}
                    onValueChange={setSelectedSupplier}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Vyberte dodavatele" />
                    </SelectTrigger>

                    <SelectContent>
                      {supplierUsers?.map((supplier: any) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Receiver Selection */}

                <div>
                  <Label htmlFor="receiver-select">Odběratel (provoz)</Label>

                  <Select
                    value={selectedReceiver}
                    onValueChange={setSelectedReceiver}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Vyberte provoz" />
                    </SelectTrigger>

                    <SelectContent>
                      {storeUsers?.map((store: any) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Invoice Items */}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">
                      Položky faktury ({parsedInvoice.items.length})
                    </Label>

                    <div className="flex gap-2">
                      <Badge variant="default" className="text-xs bg-green-600">
                        {
                          parsedInvoice.items.filter((i) => i.ingredientId)
                            .length
                        }{" "}
                        namapováno
                      </Badge>

                      {parsedInvoice.unmappedCount &&
                        parsedInvoice.unmappedCount > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {parsedInvoice.unmappedCount} nenamapováno
                          </Badge>
                        )}
                    </div>
                  </div>

                  {/* Warning for unmapped items */}

                  {parsedInvoice.items.filter(
                    (i) => i.matchStatus === "unmapped"
                  ).length > 0 && (
                    <Alert className="mb-4 bg-orange-50 border-orange-200">
                      <AlertDescription className="text-sm text-orange-800">
                        <strong>⚠️ Upozornění:</strong> Následující položky
                        nejsou namapované a<strong> nebudou uloženy</strong>.
                        Nejprve je namapujte v sekci "Nenamapované kódy".
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Edit info */}
                  <Alert className="mt-2 bg-blue-50 border-blue-200">
                    <AlertDescription className="text-xs text-blue-800">
                      💡 <strong>Tip:</strong> Klikněte na název položky pro
                      úpravu. Změny se projeví při uložení faktury.
                    </AlertDescription>
                  </Alert>

                  {/* Zeelandia layout */}
                  {selectedSupplier === ZEELANDIA_SUPPLIER_ID ||
                  invoiceSupplier === ZEELANDIA_SUPPLIER_ID ? (
                    <div className="mt-2 overflow-x-auto border rounded-md">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b-2 border-gray-300">
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
                              Číslo položky
                            </th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
                              Název
                            </th>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
                              <div className="flex items-center justify-end gap-1">
                                Fakt. mn. (kg)
                                <Pencil className="w-3 h-3 text-gray-400" />
                              </div>
                            </th>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
                              <div className="flex items-center justify-end gap-1">
                                Cena/jed (Kč/kg)
                                <Pencil className="w-3 h-3 text-gray-400" />
                              </div>
                            </th>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
                              Cena celkem
                            </th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">
                              Namapováno
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {parsedInvoice.items.map((item) => {
                            // Calculate price total using edited values if available
                            const finalTotalWeight =
                              editedTotalWeights[item.id] ??
                              item.totalWeightKg ??
                              0;
                            const finalPrice =
                              editedPrices[item.id] ?? item.price ?? 0;
                            const priceTotal = parseFloat(
                              (Math.floor(finalTotalWeight) * Math.floor(finalPrice)).toFixed(2)
                            );

                            return (
                              <tr
                                key={item.id}
                                className={`border-b border-gray-200 hover:bg-gray-50 ${
                                  item.matchStatus === "unmapped"
                                    ? "bg-red-50/30"
                                    : item.matchStatus === "exact"
                                      ? "bg-green-50/30"
                                      : "bg-yellow-50/30"
                                }`}
                              >
                                {/* Číslo položky */}
                                <td className="px-3 py-2 border-r border-gray-200">
                                  <code className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">
                                    {item.supplierCode || "???"}
                                  </code>
                                </td>
                                {/* Název */}
                                <td className="px-3 py-2 text-sm text-gray-900 border-r border-gray-200">
                                  {item.name || "-"}
                                </td>
                                {/* Fakt. mn. (kg) - This will be saved as quantity */}
                                <td className="px-3 py-2 text-right text-sm text-gray-900 border-r border-gray-200">
                                  {editingItemId === item.id &&
                                  editingField === "totalWeight" ? (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={
                                        editedTotalWeights[item.id] !==
                                        undefined
                                          ? Math.floor(
                                              editedTotalWeights[item.id]
                                            ).toString()
                                          : Math.floor(
                                              item.totalWeightKg ?? 0
                                            ).toString()
                                      }
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        setEditedTotalWeights((prev) => ({
                                          ...prev,
                                          [item.id]: Math.floor(
                                            parseFloat(value) || 0
                                          ),
                                        }));
                                      }}
                                      onBlur={() => {
                                        setEditingItemId(null);
                                        setEditingField(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          setEditingItemId(null);
                                          setEditingField(null);
                                        }
                                        if (e.key === "Escape") {
                                          setEditedTotalWeights((prev) => {
                                            const newState = { ...prev };
                                            delete newState[item.id];
                                            return newState;
                                          });
                                          setEditingItemId(null);
                                          setEditingField(null);
                                        }
                                      }}
                                      onFocus={(e) => {
                                        // Select all text when focused
                                        e.target.select();
                                      }}
                                      autoFocus
                                      className="h-7 text-sm text-right w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  ) : (
                                    <span
                                      onClick={() => {
                                        setEditingItemId(item.id);
                                        setEditingField("totalWeight");
                                      }}
                                      className="cursor-pointer hover:bg-gray-100 px-1 rounded"
                                      title="Klikněte pro úpravu"
                                    >
                                      {(editedTotalWeights[item.id] ??
                                      item.totalWeightKg)
                                        ? `${Math.floor(
                                            editedTotalWeights[item.id] ??
                                              item.totalWeightKg
                                          ).toLocaleString("cs-CZ")} kg`
                                        : "-"}
                                    </span>
                                  )}
                                </td>
                                {/* Cena/jed (Kč/kg) - This will be saved as unit_price */}
                                <td className="px-3 py-2 text-right text-sm text-gray-700 border-r border-gray-200">
                                  {editingItemId === item.id &&
                                  editingField === "price" ? (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={
                                        editedPrices[item.id] !== undefined
                                          ? Math.floor(
                                              editedPrices[item.id]
                                            ).toString()
                                          : Math.floor(
                                              item.price ?? 0
                                            ).toString()
                                      }
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        setEditedPrices((prev) => ({
                                          ...prev,
                                          [item.id]: Math.floor(
                                            parseFloat(value) || 0
                                          ),
                                        }));
                                      }}
                                      onBlur={() => {
                                        setEditingItemId(null);
                                        setEditingField(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          setEditingItemId(null);
                                          setEditingField(null);
                                        }
                                        if (e.key === "Escape") {
                                          setEditedPrices((prev) => {
                                            const newState = { ...prev };
                                            delete newState[item.id];
                                            return newState;
                                          });
                                          setEditingItemId(null);
                                          setEditingField(null);
                                        }
                                      }}
                                      onFocus={(e) => {
                                        // Select all text when focused
                                        e.target.select();
                                      }}
                                      autoFocus
                                      className="h-7 text-sm text-right w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  ) : (
                                    <span
                                      onClick={() => {
                                        setEditingItemId(item.id);
                                        setEditingField("price");
                                      }}
                                      className="cursor-pointer hover:bg-gray-100 px-1 rounded"
                                      title="Klikněte pro úpravu"
                                    >
                                      {Math.floor(
                                        editedPrices[item.id] ?? item.price ?? 0
                                      ).toLocaleString("cs-CZ")}
                                    </span>
                                  )}
                                </td>
                                {/* Cena celkem */}
                                <td className="px-3 py-2 text-right text-sm font-medium text-gray-900 border-r border-gray-200">
                                  {priceTotal.toLocaleString("cs-CZ")}
                                </td>
                                {/* Namapováno */}
                                <td className="px-3 py-2 text-sm">
                                  {item.ingredientName ? (
                                    <div className="text-green-700 font-medium">
                                      ✓ {item.ingredientName}
                                    </div>
                                  ) : (
                                    <div className="text-red-600">
                                      ✗ Neznámý kód
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : /* Weight-based layout for MAKRO */
                  selectedSupplier === MAKRO_SUPPLIER_ID ||
                    invoiceSupplier === MAKRO_SUPPLIER_ID ? (
                    <div className="mt-2 overflow-x-auto border rounded-md">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left p-2 text-xs">
                              číslo zboží
                            </th>

                            <th className="text-right p-2 text-xs">počet MU</th>

                            <th className="text-left p-2 text-xs">
                              <div className="flex items-center gap-1">
                                název zboží
                                <Pencil className="w-3 h-3 text-gray-400" />
                              </div>
                            </th>

                            <th className="text-right p-2 text-xs">
                              hmot. bal.
                            </th>

                            <th className="text-right p-2 text-xs">
                              celk. hmot.
                            </th>

                            <th className="text-right p-2 text-xs">
                              zákl. cena
                            </th>

                            <th className="text-right p-2 text-xs">
                              jedn. v MU
                            </th>

                            <th className="text-right p-2 text-xs">
                              cena za MU
                            </th>

                            <th className="text-right p-2 text-xs">
                              cena celkem
                            </th>

                            <th className="text-right p-2 text-xs bg-orange-50">
                              Cena/kg
                            </th>

                            <th className="text-left p-2 text-xs bg-blue-50">
                              Namapováno
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {parsedInvoice.items.map((item) => {
                            const isWeightFormat = item.name?.startsWith("*");

                            return (
                              <tr
                                key={item.id}
                                className={`border-b ${
                                  item.matchStatus === "unmapped"
                                    ? "bg-red-50"
                                    : item.matchStatus === "exact"
                                      ? "bg-green-50"
                                      : "bg-yellow-50"
                                }`}
                              >
                                {/* číslo zboží */}

                                <td className="p-2">
                                  <code className="text-xs bg-blue-100 px-1 py-0.5 rounded font-mono">
                                    {item.supplierCode || "???"}
                                  </code>
                                </td>

                                {/* počet MU */}

                                <td className="p-2 text-right text-xs font-semibold">
                                  {isWeightFormat ? (
                                    <span className="text-purple-600">
                                      {item.totalWeightKg?.toLocaleString(
                                        "cs-CZ",

                                        {
                                          minimumFractionDigits: 3,

                                          maximumFractionDigits: 3,
                                        }
                                      )}{" "}
                                      kg
                                    </span>
                                  ) : (
                                    item.quantity.toLocaleString("cs-CZ")
                                  )}
                                </td>

                                {/* název zboží */}

                                <td className="p-2 text-xs">
                                  {editingItemId === item.id ? (
                                    <Input
                                      value={
                                        editedDescriptions[item.id] ?? item.name
                                      }
                                      onChange={(e) =>
                                        setEditedDescriptions((prev) => ({
                                          ...prev,
                                          [item.id]: e.target.value,
                                        }))
                                      }
                                      onBlur={() => setEditingItemId(null)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          setEditingItemId(null);
                                        }
                                        if (e.key === "Escape") {
                                          setEditedDescriptions((prev) => {
                                            const newState = { ...prev };
                                            delete newState[item.id];
                                            return newState;
                                          });
                                          setEditingItemId(null);
                                        }
                                      }}
                                      autoFocus
                                      className="h-6 text-xs"
                                    />
                                  ) : (
                                    <span
                                      onClick={() => setEditingItemId(item.id)}
                                      className="cursor-pointer hover:bg-gray-100 px-1 rounded"
                                      title="Klikněte pro úpravu"
                                    >
                                      {editedDescriptions[item.id] ??
                                        (item.name || "-")}
                                    </span>
                                  )}
                                </td>

                                {/* hmot. bal. */}

                                <td className="p-2 text-right text-xs text-blue-600">
                                  {item.packageWeightKg
                                    ? `${(
                                        item.packageWeightKg * 1000
                                      ).toLocaleString("cs-CZ", {
                                        maximumFractionDigits: 0,
                                      })} g`
                                    : "-"}
                                </td>

                                {/* celk. hmot. */}

                                <td className="p-2 text-right text-xs text-green-600 font-medium">
                                  {item.totalWeightKg
                                    ? `${item.totalWeightKg.toLocaleString(
                                        "cs-CZ",

                                        {
                                          minimumFractionDigits: 3,

                                          maximumFractionDigits: 3,
                                        }
                                      )} kg`
                                    : "-"}
                                </td>

                                {/* zákl. cena */}

                                <td className="p-2 text-right text-xs">
                                  {item.basePrice ? (
                                    <span
                                      className={
                                        isWeightFormat
                                          ? "text-purple-600 font-medium"
                                          : ""
                                      }
                                    >
                                      {item.basePrice.toLocaleString("cs-CZ", {
                                        minimumFractionDigits: 2,

                                        maximumFractionDigits: 2,
                                      })}

                                      {isWeightFormat && " /kg"}
                                    </span>
                                  ) : (
                                    "-"
                                  )}
                                </td>

                                {/* jedn. v MU */}

                                <td className="p-2 text-right text-xs">
                                  {item.unitsInMu || "1"}
                                </td>

                                {/* cena za MU */}

                                <td className="p-2 text-right text-xs">
                                  {item.price?.toLocaleString("cs-CZ", {
                                    minimumFractionDigits: 2,

                                    maximumFractionDigits: 2,
                                  })}
                                </td>

                                {/* cena celkem */}

                                <td className="p-2 text-right text-xs font-semibold">
                                  {(
                                    item.total ||
                                    item.quantity * item.price ||
                                    0
                                  ).toLocaleString("cs-CZ", {
                                    minimumFractionDigits: 2,

                                    maximumFractionDigits: 2,
                                  })}
                                </td>

                                {/* Cena/kg */}

                                <td className="p-2 text-right text-xs bg-orange-50">
                                  {item.pricePerKg ? (
                                    <span className="text-orange-600 font-bold">
                                      {item.pricePerKg.toLocaleString("cs-CZ", {
                                        minimumFractionDigits: 2,

                                        maximumFractionDigits: 2,
                                      })}{" "}
                                      Kč/kg
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>

                                {/* Namapováno */}

                                <td className="p-2 text-xs bg-blue-50">
                                  {item.ingredientName ? (
                                    <div className="text-green-700 font-medium">
                                      ✓ {item.ingredientName}
                                    </div>
                                  ) : (
                                    <div className="text-red-600">
                                      ✗ Neznámý kód
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    /* Standard layout for other suppliers */

                    <div className="mt-2 space-y-2">
                      {parsedInvoice.items.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between p-3 border rounded-md ${
                            item.matchStatus === "unmapped"
                              ? "border-red-300 bg-red-50"
                              : item.matchStatus === "exact"
                                ? "border-green-300 bg-green-50"
                                : "border-yellow-300 bg-yellow-50"
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {item.supplierCode && (
                                <code className="text-xs bg-gray-800 text-white px-1.5 py-0.5 rounded">
                                  {item.supplierCode}
                                </code>
                              )}

                              {editingItemId === item.id ? (
                                <Input
                                  value={
                                    editedDescriptions[item.id] ?? item.name
                                  }
                                  onChange={(e) =>
                                    setEditedDescriptions((prev) => ({
                                      ...prev,
                                      [item.id]: e.target.value,
                                    }))
                                  }
                                  onBlur={() => setEditingItemId(null)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      setEditingItemId(null);
                                    }
                                    if (e.key === "Escape") {
                                      setEditedDescriptions((prev) => {
                                        const newState = { ...prev };
                                        delete newState[item.id];
                                        return newState;
                                      });
                                      setEditingItemId(null);
                                    }
                                  }}
                                  autoFocus
                                  className="h-8 text-sm flex-1"
                                />
                              ) : (
                                <span
                                  onClick={() => setEditingItemId(item.id)}
                                  className="font-medium cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                                  title="Klikněte pro úpravu"
                                >
                                  {editedDescriptions[item.id] ??
                                    (item.name || "-")}
                                </span>
                              )}
                            </div>

                            {item.ingredientName && (
                              <div className="text-sm text-green-700 font-medium mt-1">
                                ✓ {item.ingredientName}
                                {item.matchStatus === "fuzzy_name" &&
                                  ` (${Math.round((item.confidence || 0) * 100)}% shoda)`}
                              </div>
                            )}

                            {item.matchStatus === "unmapped" && (
                              <div className="text-sm text-red-600 mt-1">
                                ✗ Nenamapovaný kód - vyžaduje ruční přiřazení
                              </div>
                            )}

                            <div className="text-sm text-gray-600 mt-1">
                              {item.quantity} {item.unit} ×{" "}
                              {(item.price || 0).toFixed(2)} Kč
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-semibold">
                              {(
                                item.total ||
                                item.quantity * item.price ||
                                0
                              ).toFixed(2)}{" "}
                              Kč
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Unmapped Items Detail */}

                {parsedInvoice.items.filter((i) => i.matchStatus === "unmapped")
                  .length > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                    <Label className="text-sm font-semibold text-red-800 mb-2 block">
                      ⚠️ Položky, které NEBUDOU uloženy (
                      {
                        parsedInvoice.items.filter(
                          (i) => i.matchStatus === "unmapped"
                        ).length
                      }
                      ):
                    </Label>

                    <div className="space-y-2">
                      {parsedInvoice.items

                        .filter((i) => i.matchStatus === "unmapped")

                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 bg-white rounded border border-red-200"
                          >
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-red-800 text-white px-1.5 py-0.5 rounded">
                                {item.supplierCode}
                              </code>

                              <span className="text-sm text-red-900">
                                {editedDescriptions[item.id] ?? item.name}
                              </span>
                            </div>

                            <span className="text-xs text-red-600">
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                        ))}
                    </div>

                    <p className="text-xs text-red-700 mt-2">
                      💡 Pro uložení těchto položek přejděte do{" "}
                      <strong>
                        Admin → Šablony faktur → Nenamapované kódy
                      </strong>{" "}
                      a namapujte je na suroviny.
                    </p>
                  </div>
                )}

                {/* Notes */}

                <div>
                  <Label htmlFor="notes">Poznámky</Label>

                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Přidejte poznámky k faktuře..."
                    className="mt-2"
                  />
                </div>

                {/* Actions */}

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleApprove}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Schválit a uložit
                  </Button>

                  <Button
                    onClick={handleReject}
                    variant="outline"
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Zrušit
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
