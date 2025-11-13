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

import {
  Upload,
  FileText,
  CheckCircle,
  X,
  Pencil,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";

import { useSupplierUsers, useStoreUsers } from "@/hooks/useProfiles";

import { useDocumentAI } from "@/hooks/useDocumentAI";

import { useInvoiceTemplates } from "@/hooks/useInvoiceTemplates";

import { useIngredients } from "@/hooks/useIngredients";

import { AddReceivedInvoiceForm } from "./AddReceivedInvoiceForm";

import {
  PesekLineInvoiceLayout,
  DekosInvoiceLayout,
  AlbertInvoiceLayout,
  LeCoInvoiceLayout,
  FabioInvoiceLayout,
} from "@/components/invoice-layouts";

interface ParsedInvoiceItem {
  id: string;

  name: string;

  description?: string; // For layouts that need separate description field

  quantity: number;

  unit: string;

  price: number;

  total: number;

  supplierCode?: string;

  confidence: number;

  matchStatus?: string;

  ingredientId?: number | null;

  ingredientName?: string | null;

  ingredientUnit?: string | null;

  // Weight-based fields (for MAKRO and similar suppliers)

  packageWeightKg?: number;

  totalWeightKg?: number;

  pricePerKg?: number;

  basePrice?: number;

  unitsInMu?: number;

  // Zeelandia-specific fields (with units)
  package_weight?: number; // Obsah value
  package_weight_unit?: string; // Obsah unit (KG/PCE/G)
  total_weight?: number; // Fakt.mn value
  total_weight_unit?: string; // Fakt.mn unit (KG/PCE/G)

  // Albert-specific fields
  itemWeight?: string;
  vatRate?: number;
  unitPriceWithoutVat?: number;
  pricePerKgWithoutVat?: number; // Price per kg without VAT (for Albert)
  // Le-co-specific fields
  vatAmount?: number; // DPH částka (for Le-co)
  totalWithVat?: number; // Celkem s DPH (for Le-co)

  // FABIO-specific fields (raw OCR fields)
  unit_of_measure?: string; // MJ (for FABIO)
  unit_price?: number; // Cena/jedn (for FABIO)
  line_amount?: number; // Celkem without VAT (for FABIO)
  vat_rate?: number; // DPH% (for FABIO)
  line_total?: number; // Celkem s DPH (for FABIO)
  product_code?: string; // Product code (for FABIO)
}

interface ParsedInvoice {
  id: string;

  supplier: string;

  invoiceNumber: string;

  date: string;

  totalAmount: number;

  subtotal?: number;

  payment_type?: string;
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

// Pešek supplier ID (table layout without colors)
const PESEK_SUPPLIER_ID = "908cc15c-1055-4e22-9a09-c61fef1e0b9c";

// Dekos supplier ID (Dekos-specific layout with unit calculations)
const DEKOS_SUPPLIER_ID = "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d"; // TODO: Replace with actual Dekos supplier ID

// Albert supplier ID (Albert-specific layout without product codes)
const ALBERT_SUPPLIER_ID = "cf433a0c-f55d-4935-8941-043b13cea7a3";

// Le-co supplier ID (Le-co-specific layout with 9 fields)
const LECO_SUPPLIER_ID = ""; // TODO: Replace with actual Le-co supplier ID

// FABIO supplier ID (FABIO-specific layout)
const FABIO_SUPPLIER_ID = "e5f66406-c4aa-4af3-b2fe-7cc63ece5194";

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

  const [editedDescriptions] = useState<{
    [key: string]: string;
  }>({});

  const [editedTotalWeights, setEditedTotalWeights] = useState<{
    [key: string]: number;
  }>({});
  const [editedPrices, setEditedPrices] = useState<{
    [key: string]: number;
  }>({});
  const [editedPricePerKg, setEditedPricePerKg] = useState<{
    [key: string]: number;
  }>({});
  const [editedQuantities, setEditedQuantities] = useState<{
    [key: string]: number;
  }>({});
  const [editedUnitPrices, setEditedUnitPrices] = useState<{
    [key: string]: number;
  }>({});
  const [editedFabioQuantities, setEditedFabioQuantities] = useState<{
    [key: string]: number;
  }>({});
  const [editedFabioPrices, setEditedFabioPrices] = useState<{
    [key: string]: number;
  }>({});
  const [ksUnitChecked, setKsUnitChecked] = useState<{
    [key: string]: boolean;
  }>({});
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [editedInvoiceNumber, setEditedInvoiceNumber] = useState<string>("");
  const [isEditingInvoiceNumber, setIsEditingInvoiceNumber] = useState(false);

  // Calculate subtotal using edited values for Zeelandia and Dekos
  const calculateSubtotal = () => {
    if (!parsedInvoice) return 0;

    const isZeelandia =
      selectedSupplier === ZEELANDIA_SUPPLIER_ID ||
      invoiceSupplier === ZEELANDIA_SUPPLIER_ID;

    if (isZeelandia) {
      return parsedInvoice.items.reduce((sum, item) => {
        const finalTotalWeight =
          editedTotalWeights[item.id] ?? item.totalWeightKg ?? 0;
        // Use pricePerKg if available (calculated from description weight by Python service)
        const calculatedPricePerKg = item.pricePerKg ?? item.price ?? 0;
        const finalPrice =
          editedPricePerKg[item.id] ??
          editedPrices[item.id] ??
          calculatedPricePerKg;
        return (
          sum +
          parseFloat((Math.floor(finalTotalWeight) * finalPrice).toFixed(2))
        );
      }, 0);
    }

    // Check if Dekos supplier (by template display_layout or supplier ID)
    const supplierId = selectedSupplier || invoiceSupplier;
    const dekosTemplate = templates?.find(
      (t: any) =>
        t.supplier_id === supplierId &&
        t.is_active &&
        t.config?.display_layout === "dekos"
    );
    const isDekos =
      selectedSupplier === DEKOS_SUPPLIER_ID ||
      invoiceSupplier === DEKOS_SUPPLIER_ID ||
      !!dekosTemplate;

    if (isDekos) {
      return parsedInvoice.items.reduce((sum, item) => {
        const finalUnitPrice = editedUnitPrices[item.id] ?? item.price ?? 0;
        const itemTotal = item.quantity * finalUnitPrice;
        return sum + itemTotal;
      }, 0);
    }

    // For other suppliers, use original calculation
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

  const { data: ingredientsData } = useIngredients(); // Fetch all ingredients for manual mapping
  const ingredients = ingredientsData?.ingredients || [];

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

  const handleUnmapItem = (itemId: string) => {
    if (!parsedInvoice) return;

    const updatedItems = parsedInvoice.items.map((i) =>
      i.id === itemId
        ? {
            ...i,
            ingredientId: null,
            ingredientName: null,
            matchStatus: "unmapped" as const,
          }
        : i
    );

    setParsedInvoice({
      ...parsedInvoice,
      items: updatedItems,
      unmappedCount: updatedItems.filter((i) => i.matchStatus === "unmapped")
        .length,
    });
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (file) {
      // Check if file is supported (PDF, image, or HEIC)
      const isHeic =
        file.name.toLowerCase().endsWith(".heic") ||
        file.name.toLowerCase().endsWith(".heif") ||
        file.type === "image/heic" ||
        file.type === "image/heif";

      if (
        file.type !== "application/pdf" &&
        !file.type.startsWith("image/") &&
        !isHeic
      ) {
        toast({
          title: "Chyba",
          description: "Podporované formáty: PDF, JPG, PNG, HEIC",
          variant: "destructive",
        });
        return;
      }

      // Convert HEIC to JPG if needed
      try {
        let processedFile = file;

        if (isHeic) {
          toast({
            title: "Převod HEIC",
            description: "Převádím HEIC na JPG formát...",
          });

          const { handleFileWithHeicConversion } = await import(
            "@/utils/heicConverter"
          );
          processedFile = await handleFileWithHeicConversion(file);

          toast({
            title: "Úspěch",
            description: `Soubor ${file.name} úspěšně převeden na ${processedFile.name}`,
          });
        }

        setSelectedFile(processedFile);
      } catch (error) {
        console.error("Error processing file:", error);
        toast({
          title: "Chyba",
          description:
            error instanceof Error
              ? error.message
              : "Nepodařilo se zpracovat soubor",
          variant: "destructive",
        });
      }
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

        // Debug: Log raw extracted items to see field mapping
        console.log(
          "🔍 Raw extracted items from document AI:",
          result.data.items.map((item: any, index: number) => ({
            index,
            raw_item: item,
            product_code: item.product_code,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit_of_measure || item.unit,
            total_weight_kg: item.total_weight_kg,
            package_weight_kg: item.package_weight_kg,
            unit_price: item.unit_price,
            total_price: item.total_price || item.line_total,
            item_weight: item.item_weight,
            vat_rate: item.vat_rate,
          }))
        );

        // Map extracted items with ingredient matching info

        const items = result.data.items.map((item: any, index: number) => {
          // Calculate totalWeightKg: if jedn. v MU != 1, then totalWeightKg = unitsInMu * quantity
          // Also calculate for kg items with empty package_weight_kg: jedn. v MU * počet MU = celk. hmot.
          const unitsInMu = item.units_in_mu || 1;
          let calculatedTotalWeight = item.total_weight_kg;

          // Calculate if unitsInMu != 1 (for ks items)
          if (unitsInMu !== 1 && unitsInMu > 0) {
            calculatedTotalWeight = unitsInMu * item.quantity;
            console.log(`📐 Calculating celk. hmot. for item ${index + 1}:`, {
              productCode: item.product_code,
              "počet MU": item.quantity,
              "jedn. v MU": unitsInMu,
              "calculated celk. hmot.": calculatedTotalWeight,
              "original total_weight_kg": item.total_weight_kg,
            });
          }
          // Calculate for kg items with empty package_weight_kg
          else if (
            !calculatedTotalWeight &&
            !item.package_weight_kg &&
            unitsInMu &&
            item.quantity
          ) {
            calculatedTotalWeight = unitsInMu * item.quantity;
            console.log(
              `📐 Calculating celk. hmot. for kg item ${index + 1} (empty package_weight_kg):`,
              {
                productCode: item.product_code,
                "počet MU": item.quantity,
                "jedn. v MU": unitsInMu,
                "calculated celk. hmot.": calculatedTotalWeight,
              }
            );
          }

          // Calculate Albert-specific fields before creating mapped item
          let albertUnitPriceWithoutVat: number | undefined;
          let albertTotalWeightKg: number | undefined;
          let albertPricePerKgWithoutVat: number | undefined;

          // Helper function to extract weight in kg
          const extractWeightInKg = (weightStr: string): number | null => {
            if (!weightStr) return null;
            const match = weightStr.match(/^([\d,\.]+)\s*(kg|g|ml|l)$/i);
            if (!match) return null;
            const value = parseFloat(match[1].replace(",", "."));
            const unit = match[2].toLowerCase();
            // Convert to kg
            if (unit === "g" || unit === "ml") {
              return value / 1000;
            } else if (unit === "kg" || unit === "l") {
              return value;
            }
            return null;
          };

          if (item.item_weight && item.vat_rate) {
            // Calculate unit price without VAT
            const unitPrice = item.unit_price || item.price || 0;
            albertUnitPriceWithoutVat = unitPrice / (1 + item.vat_rate / 100);

            // Calculate total weight in kg (itemWeight × quantity)
            const weightInKg = extractWeightInKg(item.item_weight);
            if (weightInKg) {
              albertTotalWeightKg = weightInKg * item.quantity;
              // Calculate price per kg without VAT: unitPriceWithoutVat / weightInKg (not totalWeightKg!)
              if (weightInKg > 0) {
                albertPricePerKgWithoutVat =
                  albertUnitPriceWithoutVat / weightInKg;
              }
            }

            console.log(`🔵 Albert calculation for ${item.description}:`, {
              item_weight: item.item_weight,
              vat_rate: item.vat_rate,
              quantity: item.quantity,
              unitPrice: unitPrice,
              albertUnitPriceWithoutVat,
              weightInKg,
              albertTotalWeightKg,
              albertPricePerKgWithoutVat,
            });
          } else {
            console.warn(
              `⚠️ Missing Albert fields for ${item.description || item.name}:`,
              {
                item_weight: item.item_weight,
                vat_rate: item.vat_rate,
              }
            );
          }

          const mappedItem: ParsedInvoiceItem = {
            id: (index + 1).toString(),

            name: item.description || item.name,
            description: item.description || item.name, // Add description field for layouts that use it

            quantity: item.quantity,

            unit: item.unit_of_measure || item.unit,

            price: item.unit_price || item.price,

            total: item.total_price || item.total || item.line_total,

            supplierCode: item.product_code || item.supplierCode,

            confidence: item.match_confidence || item.confidence || 0,

            matchStatus: item.match_status,

            ingredientId: item.matched_ingredient_id,

            ingredientName: item.matched_ingredient_name,

            ingredientUnit: item.matched_ingredient_unit,

            // Weight-based fields

            packageWeightKg: item.package_weight_kg,

            totalWeightKg: albertTotalWeightKg || calculatedTotalWeight,

            pricePerKg: item.price_per_kg,

            basePrice: item.base_price,

            unitsInMu: unitsInMu,

            // Zeelandia-specific fields (with units)
            package_weight: item.package_weight,
            package_weight_unit: item.package_weight_unit,
            total_weight: item.total_weight,
            total_weight_unit: item.total_weight_unit,

            // Albert-specific fields
            itemWeight: item.item_weight,
            vatRate: item.vat_rate,
            unitPriceWithoutVat: albertUnitPriceWithoutVat,
            pricePerKgWithoutVat: albertPricePerKgWithoutVat,
            // Le-co-specific fields
            vatAmount: item.vat_amount,
            totalWithVat: item.total_with_vat,

            // FABIO-specific fields (preserve raw OCR fields)
            unit_of_measure: item.unit_of_measure,
            unit_price: item.unit_price,
            line_amount: item.line_amount,
            vat_rate: item.vat_rate,
            line_total: item.line_total,
            product_code: item.product_code,
          };

          // Debug log for FABIO items
          if (item.line_amount !== undefined) {
            console.log(`🍞 FABIO item ${index + 1} mapping:`, {
              description: item.description,
              quantity: item.quantity,
              unit_of_measure: item.unit_of_measure,
              unit_price: item.unit_price,
              line_amount: item.line_amount,
              vat_rate: item.vat_rate,
              line_total: item.line_total,
              mapped_unit_of_measure: mappedItem.unit_of_measure,
              mapped_unit_price: mappedItem.unit_price,
              mapped_line_amount: mappedItem.line_amount,
              mapped_vat_rate: mappedItem.vat_rate,
              mapped_line_total: mappedItem.line_total,
            });
          }

          // Debug log for Albert items
          if (item.item_weight || item.vat_rate) {
            console.log(`🛒 Albert item ${index + 1} mapping:`, {
              description: item.description,
              item_weight: item.item_weight,
              vat_rate: item.vat_rate,
              unit_price: item.unit_price,
              quantity: item.quantity,
              mapped_itemWeight: mappedItem.itemWeight,
              mapped_vatRate: mappedItem.vatRate,
              calculated_unitPriceWithoutVat: mappedItem.unitPriceWithoutVat,
              calculated_totalWeightKg: mappedItem.totalWeightKg,
              calculated_pricePerKgWithoutVat: mappedItem.pricePerKgWithoutVat,
            });
          }

          // Debug log for Zeelandia items with calculated pricePerKg
          if (item.price_per_kg && item.price_per_kg !== item.unit_price) {
            console.log(
              `🟢 Zeelandia item ${index + 1} - Weight extracted from description:`,
              {
                description: item.description,
                unit_price: item.unit_price,
                calculated_pricePerKg: item.price_per_kg,
                total_weight_kg: item.total_weight_kg,
                package_weight: item.package_weight,
                package_weight_unit: item.package_weight_unit,
                calculation: `${item.unit_price} Kč / weight in description = ${item.price_per_kg} Kč/kg`,
              }
            );
          }

          return mappedItem;
        });

        console.log("📦 All mapped items (full):", items);
        console.log(
          "📦 All mapped items (summary):",
          items.map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            itemWeight: item.itemWeight,
            vatRate: item.vatRate,
            price: item.price,
            unitPriceWithoutVat: item.unitPriceWithoutVat,
            totalWeightKg: item.totalWeightKg,
            total: item.total,
            unit: item.unit,
            quantity: item.quantity,
          }))
        );

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

        // Debug: Check payment_type in result
        console.log("Payment type check:", {
          payment_type: result.data.payment_type,
          paymentType: result.data.paymentType,
          allKeys: Object.keys(result.data),
        });

        setParsedInvoice({
          id: `inv_${Date.now()}`,

          supplier: supplierName,

          invoiceNumber: result.data.invoiceNumber,

          date: result.data.date,

          totalAmount: extractedTotal, // Total with VAT

          subtotal: subtotal, // Total without VAT (calculated from items)

          payment_type:
            result.data.payment_type || result.data.paymentType || "",
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

    // Debug: Check supplier detection
    const isMakroDetected = supplierId === MAKRO_SUPPLIER_ID;
    const isZeelandiaDetected = supplierId === ZEELANDIA_SUPPLIER_ID;

    console.log("🔍 Supplier Detection in handleApprove:", {
      supplierId,
      MAKRO_SUPPLIER_ID,
      ZEELANDIA_SUPPLIER_ID,
      isMakroDetected,
      isZeelandiaDetected,
      selectedSupplier,
      invoiceSupplier,
    });

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

        .eq(
          "invoice_number",
          editedInvoiceNumber || parsedInvoice.invoiceNumber
        )

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

      // Convert date from various formats to YYYY-MM-DD format

      const convertDateToISO = (dateStr: string): string => {
        if (!dateStr) return "";

        // First, try to extract date from strings like "Datum zdan. plnění: 08-10-2025"
        const dateMatch = dateStr.match(/(\d{1,2})[.-](\d{1,2})[.-](\d{4})/);
        if (dateMatch) {
          const [, day, month, year] = dateMatch;
          return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }

        // Try DD.MM.YYYY format
        const dotParts = dateStr.split(".");
        if (dotParts.length === 3) {
          const [day, month, year] = dotParts;
          // Handle 2-digit year (assume 20YY for years 00-99)
          const fullYear = year.length === 2 ? `20${year}` : year;
          return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }

        // Try DD-MM-YYYY format
        const dashParts = dateStr.split("-");
        if (dashParts.length === 3 && dashParts[2].length === 4) {
          const [day, month, year] = dashParts;
          return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }

        // Try YY-MM-DD format (2-digit year, assumes 20YY)
        if (
          dashParts.length === 3 &&
          dashParts[0].length === 2 &&
          dashParts[1].length === 2 &&
          dashParts[2].length === 2
        ) {
          const [year, month, day] = dashParts;
          return `20${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }

        // If already in YYYY-MM-DD format, return as-is
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return dateStr;
        }

        // Fallback: return original string and let database handle it
        console.warn("Could not parse date format:", dateStr);
        return dateStr;
      };

      const isoDate = convertDateToISO(parsedInvoice.date);

      let savedInvoice;

      if (existingInvoice) {
        const confirmed = window.confirm(
          `Faktura s číslem "${editedInvoiceNumber || parsedInvoice.invoiceNumber}" od dodavatele "${parsedInvoice.supplier}" již existuje!\n\n` +
            `Existující faktura ID: ${existingInvoice.id}\n\n` +
            `Chcete přepsat existující fakturu a její položky?`
        );

        if (!confirmed) {
          return; // User cancelled
        }

        console.log(
          "🔄 Updating existing invoice (no notification will be sent):",
          {
            existingInvoiceId: existingInvoice.id,
            invoiceNumber: editedInvoiceNumber || parsedInvoice.invoiceNumber,
            supplierId: supplierId,
          }
        );

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

            payment_type: parsedInvoice.payment_type || null,

            qr_codes: parsedInvoice.qrCodes || null,

            updated_at: new Date().toISOString(),
          })

          .eq("id", existingInvoice.id)

          .select()

          .single();

        if (updateError) throw updateError;

        savedInvoice = updatedInvoice;
        console.log(
          "✅ Invoice updated successfully (UPDATE does not trigger notification)"
        );
      } else {
        // Create new invoice
        console.log(
          "📤 INSERTING NEW INVOICE into invoices_received (should trigger Telegram notification):",
          {
            invoice_number: editedInvoiceNumber || parsedInvoice.invoiceNumber,
            supplier_id: supplierId,
            invoice_date: isoDate,
            total_amount: parsedInvoice.totalAmount,
            receiver_id: selectedReceiver || null,
            payment_type: parsedInvoice.payment_type || null,
          }
        );

        const { data: newInvoice, error: invoiceError } = await supabase

          .from("invoices_received")

          .insert({
            invoice_number: editedInvoiceNumber || parsedInvoice.invoiceNumber,

            supplier_id: supplierId,

            invoice_date: isoDate,

            total_amount: parsedInvoice.totalAmount,

            receiver_id: selectedReceiver || null,

            payment_type: parsedInvoice.payment_type || null,

            qr_codes: parsedInvoice.qrCodes || null,
          })

          .select()

          .single();

        if (invoiceError) {
          console.error("❌ Failed to insert invoice:", invoiceError);
          throw invoiceError;
        }

        savedInvoice = newInvoice;
        console.log("✅ NEW INVOICE INSERTED SUCCESSFULLY!", {
          id: newInvoice.id,
          invoice_number: newInvoice.invoice_number,
          supplier_id: newInvoice.supplier_id,
          total_amount: newInvoice.total_amount,
          created_at: newInvoice.created_at,
        });
      }

      // Save items that have matched ingredients

      const matchedItems = parsedInvoice.items.filter(
        (item) => item.ingredientId
      );

      console.log(
        "📦 Matched items for saving:",
        matchedItems.map((item) => ({
          id: item.id,
          name: item.name,
          supplierCode: item.supplierCode,
          quantity: item.quantity,
          totalWeightKg: item.totalWeightKg,
          price: item.price,
          ingredientId: item.ingredientId,
        }))
      );

      if (matchedItems.length > 0) {
        // Fetch product codes, package sizes, and prices for all matched ingredients
        const { data: supplierCodes, error: codesError } = await supabase
          .from("ingredient_supplier_codes")
          .select("ingredient_id, supplier_id, product_code, package, price")
          .in(
            "ingredient_id",
            matchedItems.map((item) => item.ingredientId!).filter(Boolean)
          )
          .eq("supplier_id", supplierId);

        if (codesError) {
          console.warn("Error fetching supplier codes:", codesError);
        }

        // Create maps for quick lookup
        const productCodeMap = new Map<number, string>();
        const packageSizeMap = new Map<number, number>();
        const supplierPriceMap = new Map<number, number>();
        if (supplierCodes) {
          supplierCodes.forEach((code: any) => {
            productCodeMap.set(code.ingredient_id, code.product_code);
            if (code.package) {
              packageSizeMap.set(code.ingredient_id, parseFloat(code.package));
            }
            if (code.price) {
              supplierPriceMap.set(code.ingredient_id, parseFloat(code.price));
            }
          });
        }

        // Helper function to get unit multiplier for Dekos supplier
        const getUnitMultiplier = (unitOfMeasure: string): number => {
          if (!unitOfMeasure) return 1;

          const unit = unitOfMeasure.toLowerCase().trim();

          // Thousands (tisíce)
          if (unit === "tis" || unit === "tisíce") return 1000;

          // Hundreds (stovky)
          if (unit === "100" || unit === "sto") return 100;

          // Dozens (tucty)
          if (unit === "12" || unit === "tuc") return 12;

          // Pieces (kusy)
          if (
            unit === "1ks" ||
            unit === "ks" ||
            unit === "kus" ||
            unit === "kusy"
          )
            return 1;

          // Packages (balení)
          if (unit === "bal" || unit === "balení") return 1;

          // Try to parse as number (e.g., "50", "100")
          const numericUnit = parseInt(unit);
          if (!isNaN(numericUnit)) return numericUnit;

          // Default to 1 for unknown units
          return 1;
        };

        const itemsToInsert = matchedItems.map((item, index) => {
          // Check supplier types
          const isZeelandia =
            selectedSupplier === ZEELANDIA_SUPPLIER_ID ||
            invoiceSupplier === ZEELANDIA_SUPPLIER_ID;
          const isMakro =
            selectedSupplier === MAKRO_SUPPLIER_ID ||
            invoiceSupplier === MAKRO_SUPPLIER_ID;
          const isAlbert =
            selectedSupplier === ALBERT_SUPPLIER_ID ||
            invoiceSupplier === ALBERT_SUPPLIER_ID;
          const isFabio =
            selectedSupplier === FABIO_SUPPLIER_ID ||
            invoiceSupplier === FABIO_SUPPLIER_ID;
          // Check if Dekos supplier (by template display_layout or supplier ID)
          const dekosTemplate = templates?.find(
            (t: any) =>
              t.supplier_id === supplierId &&
              t.is_active &&
              t.config?.display_layout === "dekos"
          );
          const isDekos =
            selectedSupplier === DEKOS_SUPPLIER_ID ||
            invoiceSupplier === DEKOS_SUPPLIER_ID ||
            !!dekosTemplate;

          // Debug logging for weight-based suppliers
          if (isMakro || isZeelandia) {
            console.log(
              `🔄 Processing ${isMakro ? "MAKRO" : "Zeelandia"} item:`,
              {
                itemId: item.id,
                supplierCode: item.supplierCode,
                totalWeightKg: item.totalWeightKg,
                total_weight: item.total_weight,
                total_weight_unit: item.total_weight_unit,
                editedTotalWeight: editedTotalWeights[item.id],
                finalQuantity:
                  isZeelandia || isMakro
                    ? parseFloat(
                        (
                          editedTotalWeights[item.id] ??
                          item.total_weight ??
                          item.totalWeightKg
                        )?.toString() || "0"
                      )
                    : item.quantity,
                unit: isZeelandia
                  ? (item.total_weight_unit || item.unit || "kg").toLowerCase()
                  : isMakro
                    ? "kg"
                    : item.unit,
              }
            );
          }

          // Use edited values if available, otherwise fall back to original values
          // Handle each supplier type separately since they have different templates
          let quantity: number;
          let unitPrice: number;

          if (isMakro) {
            // For Makro: save exactly what is displayed in celk. hmot. and Cena/kg columns
            const isCheckboxChecked =
              ksUnitChecked[item.id] !== undefined
                ? ksUnitChecked[item.id]
                : true; // Default to checked for ks unit items

            // Determine what is displayed in celk. hmot. column
            let displayedQuantity: number;
            if (item.ingredientUnit === "ks" && isCheckboxChecked) {
              // Checkbox checked: calculate based on jedn. v MU
              const pocetMu = editedQuantities[item.id] ?? item.quantity;
              const jednVMu = item.unitsInMu || 1;

              // If jedn. v MU !== 1, calculate: počet MU × jedn. v MU
              displayedQuantity =
                jednVMu !== 1 && jednVMu > 0 ? pocetMu * jednVMu : pocetMu;
            } else {
              // Checkbox unchecked or not ks: display shows totalWeightKg (or fallback to počet MU)
              const rawTotalWeight =
                editedTotalWeights[item.id] ?? item.totalWeightKg;
              displayedQuantity =
                rawTotalWeight && rawTotalWeight > 0
                  ? parseFloat(rawTotalWeight.toString())
                  : (editedQuantities[item.id] ?? item.quantity); // Fallback to počet MU (use edited value if available)
            }

            // For Makro: ALWAYS use Cena/kg column for unit_price (regardless of format)
            let displayedUnitPrice: number;
            displayedUnitPrice =
              editedPricePerKg[item.id] ??
              (item.pricePerKg || item.basePrice || item.price || 0);

            quantity = displayedQuantity;
            unitPrice = displayedUnitPrice;
          } else if (isZeelandia) {
            // For Zeelandia: use totalWeightKg (calculated, e.g., 100 kg) as quantity
            // When weight is in description (e.g., "10kg"), totalWeightKg = quantity × weight
            const rawTotalWeight =
              editedTotalWeights[item.id] ??
              item.totalWeightKg ??
              item.total_weight;
            quantity = parseFloat(rawTotalWeight?.toString() || "0");
            // Use pricePerKg (calculated, e.g., 83.9 Kč/kg) as unit_price
            // When weight is in description, pricePerKg = unit_price / weight
            unitPrice = parseFloat(
              (
                (editedPricePerKg[item.id] ??
                  editedPrices[item.id] ??
                  item.pricePerKg ??
                  item.price) ||
                0
              ).toString()
            ); // Zeelandia uses decimal prices
          } else if (isDekos) {
            // For Dekos: calculate total quantity in pieces and price per piece
            const unitMultiplier = getUnitMultiplier(item.unit || "");

            // Use edited unit price if available, otherwise use original
            const finalJednCena = editedUnitPrices[item.id] ?? item.price;

            // Celk. ks = Množství × unit multiplier
            const totalQuantity = item.quantity * unitMultiplier;

            // Cena/kus = Jedn. cena ÷ unit multiplier
            const pricePerItem =
              unitMultiplier > 0 ? finalJednCena / unitMultiplier : 0;

            quantity = totalQuantity;
            unitPrice = pricePerItem;

            // Debug logging for Dekos items
            console.log(`🔄 Processing Dekos item:`, {
              itemId: item.id,
              supplierCode: item.supplierCode,
              originalQuantity: item.quantity,
              originalUnit: item.unit,
              unitMultiplier: unitMultiplier,
              calculatedTotalQuantity: totalQuantity,
              originalUnitPrice: item.price,
              editedUnitPrice: editedUnitPrices[item.id],
              finalJednCena: finalJednCena,
              calculatedPricePerItem: pricePerItem,
            });
          } else if (isAlbert) {
            // For Albert: use totalWeightKg as quantity and pricePerKgWithoutVat as unit_price
            quantity = item.totalWeightKg || 0;
            unitPrice = item.pricePerKgWithoutVat || item.price || 0;

            // Debug logging for Albert items
            console.log(`🛒 Processing Albert item:`, {
              itemId: item.id,
              description: item.name,
              itemWeight: item.itemWeight,
              originalQuantity: item.quantity,
              totalWeightKg: item.totalWeightKg,
              priceWithVat: item.price,
              unitPriceWithoutVat: item.unitPriceWithoutVat,
              pricePerKgWithoutVat: item.pricePerKgWithoutVat,
              vatRate: item.vatRate,
              savedQuantity: quantity,
              savedUnitPrice: unitPrice,
            });
          } else if (isFabio) {
            // For FABIO: Calculate "Množství celkem" and "Cena/jedn" (same logic as FabioInvoiceLayout)
            let calculatedTotalQuantity = item.quantity ?? 0;
            let calculatedPricePerKg = item.price ?? 0;

            // Get package size from ingredient_supplier_codes
            const packageSize = item.ingredientId
              ? packageSizeMap.get(item.ingredientId)
              : null;

            // Calculate total quantity based on unit_of_measure
            if (item.quantity && item.unit_of_measure) {
              const unitLower = item.unit_of_measure.toLowerCase();
              if (unitLower === "ks" && packageSize) {
                // For "ks" units: totalQuantity = quantity × packageSize
                calculatedTotalQuantity = item.quantity * packageSize;
              } else if (unitLower === "kg" || unitLower === "krt") {
                // For "kg" or "krt" units: totalQuantity = quantity as-is
                calculatedTotalQuantity = item.quantity;
              }
            }

            // Calculate price per kg from line_amount / totalQuantity
            if (
              calculatedTotalQuantity &&
              calculatedTotalQuantity > 0 &&
              item.line_amount
            ) {
              calculatedPricePerKg = item.line_amount / calculatedTotalQuantity;
            }

            // Use edited values if available, otherwise use calculated values
            quantity =
              editedFabioQuantities[item.id] ?? calculatedTotalQuantity ?? 0;
            unitPrice = editedFabioPrices[item.id] ?? calculatedPricePerKg ?? 0;

            // Debug logging for FABIO items
            console.log(`🍞 Processing FABIO item:`, {
              itemId: item.id,
              description: item.name,
              unit_of_measure: item.unit_of_measure,
              ocrQuantity: item.quantity,
              packageSize: packageSize,
              calculatedTotalQuantity: calculatedTotalQuantity,
              editedQuantity: editedFabioQuantities[item.id],
              finalQuantity: quantity,
              ocrUnitPrice: item.price,
              line_amount: item.line_amount,
              calculatedPricePerKg: calculatedPricePerKg,
              editedPrice: editedFabioPrices[item.id],
              finalUnitPrice: unitPrice,
            });
          } else {
            // For other suppliers: use regular quantity
            quantity = item.quantity;
            unitPrice = item.price;
          }

          // Debug: Show what will be saved to items_received
          console.log(
            `💾 Saving to items_received for item ${item.id} (${item.name}):`,
            {
              supplierType: isMakro
                ? "MAKRO"
                : isZeelandia
                  ? "Zeelandia"
                  : isDekos
                    ? "Dekos"
                    : isAlbert
                      ? "Albert"
                      : isFabio
                        ? "FABIO"
                        : "Other",
              displayedInCelkHmot: isMakro
                ? item.ingredientUnit === "ks" &&
                  (ksUnitChecked[item.id] !== undefined
                    ? ksUnitChecked[item.id]
                    : true)
                  ? (() => {
                      const pocetMu =
                        editedQuantities[item.id] ?? item.quantity;
                      const jednVMu = item.unitsInMu || 1;
                      const calculated =
                        jednVMu !== 1 && jednVMu > 0
                          ? pocetMu * jednVMu
                          : pocetMu;
                      return jednVMu !== 1 && jednVMu > 0
                        ? `počet MU: ${pocetMu} × jedn.v MU: ${jednVMu} = ${calculated}${editedQuantities[item.id] !== undefined ? " (edited)" : ""}`
                        : `počet MU: ${pocetMu}${editedQuantities[item.id] !== undefined ? " (edited)" : ""}`;
                    })()
                  : `totalWeightKg: ${editedTotalWeights[item.id] ?? item.totalWeightKg}${editedTotalWeights[item.id] !== undefined ? " (edited)" : ""}`
                : null,
              displayedInCenaKg: isMakro
                ? `Cena/kg: ${editedPricePerKg[item.id] ?? item.pricePerKg ?? item.basePrice ?? item.price} (vždy)`
                : null,
              savedQuantity: quantity,
              savedUnitPrice: unitPrice,
              savedUnitOfMeasure: isZeelandia
                ? "kg" // Zeelandia: always "kg" since we treat PCE as kg
                : isMakro
                  ? item.ingredientUnit === "ks" &&
                    (ksUnitChecked[item.id] !== undefined
                      ? ksUnitChecked[item.id]
                      : true)
                    ? "ks"
                    : "kg"
                  : isDekos
                    ? "ks" // Dekos always uses "ks" for total quantity
                    : item.unit,
              checkboxChecked: isMakro
                ? ksUnitChecked[item.id] !== undefined
                  ? ksUnitChecked[item.id]
                  : true
                : null,
            }
          );
          const lineTotal = parseFloat((quantity * unitPrice).toFixed(2)); // For weight-based items, preserve decimal quantity

          const baseInsert: any = {
            invoice_received_id: savedInvoice.id,

            matched_ingredient_id: item.ingredientId!,

            quantity: quantity,

            unit_price: unitPrice,

            line_total: lineTotal,

            line_number: index + 1,

            unit_of_measure: isZeelandia
              ? "kg" // Zeelandia: always use "kg" since we treat PCE as kg
              : isMakro
                ? // For Makro: determine unit based on what quantity represents
                  item.ingredientUnit === "ks" &&
                  (ksUnitChecked[item.id] !== undefined
                    ? ksUnitChecked[item.id]
                    : true)
                  ? "ks" // Checkbox checked: using ks unit
                  : "kg" // Checkbox unchecked or not ks: using weight, so use kg
                : isDekos
                  ? "ks" // Dekos always saves total quantity in pieces
                  : isAlbert
                    ? "kg" // Albert always saves total weight in kg
                    : isFabio
                      ? "kg" // FABIO uses kg for total quantity
                      : item.unit,

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

          // Add product_code from ingredient_supplier_codes
          const productCode =
            productCodeMap.get(item.ingredientId!) || item.supplierCode || null;
          if (productCode) {
            baseInsert.product_code = productCode;
          }

          // Note: For Zeelandia, Fakt. mn. is saved as quantity and Cena/jed is saved as unit_price
          // No additional fields needed since we use the standard items_received columns

          return baseInsert;
        });

        const { error: itemsError } = await supabase

          .from("items_received")

          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Send Telegram notification after items are saved (non-blocking)
      console.log("📤 Sending Telegram notification...");
      const { data: supplierData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", supplierId)
        .single();

      supabase.functions
        .invoke("notify-telegram", {
          body: {
            type: "INSERT",
            record: {
              table: "invoices_received",
              id: savedInvoice.id,
              invoice_number: savedInvoice.invoice_number,
              supplier_id: supplierId,
              supplier_name: supplierData?.full_name || "Neznámý",
              invoice_date: savedInvoice.invoice_date,
              total_amount: savedInvoice.total_amount,
              items_count: matchedItems.length,
            },
          },
        })
        .then(({ data, error }) => {
          if (error) {
            console.warn(
              "⚠️ Telegram notification failed (invoice saved successfully):",
              error
            );
          } else {
            console.log("✅ Telegram notification sent!", data);
            console.log("📱 Check your Telegram app!");
          }
        })
        .catch((err) => {
          console.warn(
            "⚠️ Telegram notification error (invoice saved successfully):",
            err
          );
        });

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

      setEditedInvoiceNumber("");
      setIsEditingInvoiceNumber(false);

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

    setEditedInvoiceNumber("");
    setIsEditingInvoiceNumber(false);

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
                  <Label htmlFor="invoice-file">
                    Faktura (PDF, JPG, PNG, HEIC)
                  </Label>

                  <Input
                    id="invoice-file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.heic,.heif"
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

                      {isEditingInvoiceNumber ? (
                        <Input
                          type="text"
                          value={
                            editedInvoiceNumber || parsedInvoice.invoiceNumber
                          }
                          onChange={(e) =>
                            setEditedInvoiceNumber(e.target.value)
                          }
                          onBlur={() => setIsEditingInvoiceNumber(false)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              setIsEditingInvoiceNumber(false);
                            }
                            if (e.key === "Escape") {
                              setEditedInvoiceNumber("");
                              setIsEditingInvoiceNumber(false);
                            }
                          }}
                          onFocus={(e) => e.target.select()}
                          autoFocus
                          className="h-8 text-sm mt-1"
                        />
                      ) : (
                        <p
                          className="text-sm cursor-pointer hover:bg-gray-100 px-2 py-1 rounded inline-block"
                          onClick={() => {
                            setEditedInvoiceNumber(
                              parsedInvoice.invoiceNumber || ""
                            );
                            setIsEditingInvoiceNumber(true);
                          }}
                          title="Klikněte pro úpravu"
                        >
                          {editedInvoiceNumber ||
                            parsedInvoice.invoiceNumber || (
                              <span className="text-orange-600 italic">
                                Nenalezeno - klikněte pro zadání
                              </span>
                            )}
                        </p>
                      )}
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
                        {parsedInvoice.payment_type || (
                          <span className="text-gray-400">Nenalezeno</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-2 border-t">
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

                    <div>
                      {/* Raw QR Code Data */}
                      {parsedInvoice.qrCodes &&
                        parsedInvoice.qrCodes.length > 0 && (
                          <div className="p-2 bg-gray-100 rounded text-xs">
                            <div className="text-gray-600 mb-1">
                              Surová data:
                            </div>
                            <code className="text-gray-800 font-mono break-all">
                              {parsedInvoice.qrCodes[0].data}
                            </code>
                          </div>
                        )}
                    </div>
                  </div>
                </div>

                {/* PDF Preview Section */}
                <div className="grid grid-cols-1 gap-6">
                  {/* PDF Preview */}
                  {selectedFile && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                      <div
                        className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2 cursor-pointer hover:text-blue-900"
                        onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
                      >
                        <span className="text-lg">📄</span>
                        Náhled faktury
                        {isPreviewExpanded ? (
                          <ChevronUp className="h-4 w-4 ml-auto" />
                        ) : (
                          <ChevronDown className="h-4 w-4 ml-auto" />
                        )}
                      </div>
                      {isPreviewExpanded && (
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
                      )}
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

                  {/* Debug: Log layout detection */}
                  {(() => {
                    const supplierId = selectedSupplier || invoiceSupplier;
                    console.log(
                      "🔍 InvoiceUploadDialog - Layout Detection START:",
                      {
                        selectedSupplier,
                        invoiceSupplier,
                        supplierId,
                        supplierIDs: {
                          ZEELANDIA: ZEELANDIA_SUPPLIER_ID,
                          MAKRO: MAKRO_SUPPLIER_ID,
                          PESEK: PESEK_SUPPLIER_ID,
                          DEKOS: DEKOS_SUPPLIER_ID,
                          ALBERT: ALBERT_SUPPLIER_ID,
                          LECO: LECO_SUPPLIER_ID,
                          FABIO: FABIO_SUPPLIER_ID,
                        },
                        checks: {
                          isZeelandia: supplierId === ZEELANDIA_SUPPLIER_ID,
                          isMakro: supplierId === MAKRO_SUPPLIER_ID,
                          isPesek: supplierId === PESEK_SUPPLIER_ID,
                          isDekos: supplierId === DEKOS_SUPPLIER_ID,
                          isAlbert: supplierId === ALBERT_SUPPLIER_ID,
                          isLeco: supplierId === LECO_SUPPLIER_ID,
                          isFabio: supplierId === FABIO_SUPPLIER_ID,
                        },
                        allTemplates: templates?.map((t: any) => ({
                          name: t.template_name,
                          supplier_id: t.supplier_id,
                          display_layout: t.config?.display_layout,
                          is_active: t.is_active,
                          matchesFabio:
                            t.supplier_id === FABIO_SUPPLIER_ID &&
                            t.config?.display_layout === "fabio",
                        })),
                      }
                    );
                    return null;
                  })()}

                  {/* Zeelandia layout */}
                  {(() => {
                    const isZeelandia =
                      selectedSupplier === ZEELANDIA_SUPPLIER_ID ||
                      invoiceSupplier === ZEELANDIA_SUPPLIER_ID;
                    if (isZeelandia) {
                      console.log("✅ Using Zeelandia layout");
                    }
                    return isZeelandia;
                  })() ? (
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
                            <th className="text-center px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
                              MJ
                            </th>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
                              Obsah
                            </th>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200 bg-green-50">
                              <div className="flex items-center justify-end gap-1">
                                Fakt. mn.
                                <Pencil className="w-3 h-3 text-gray-400" />
                              </div>
                            </th>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
                              <div className="flex items-center justify-end gap-1">
                                Cena/jed
                                <Pencil className="w-3 h-3 text-gray-400" />
                              </div>
                            </th>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200 bg-green-50">
                              <div className="flex items-center justify-end gap-1">
                                Cena/kg
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
                          {parsedInvoice.items.map((item: any) => {
                            // For Zeelandia: prioritize totalWeightKg (calculated) over total_weight
                            // When weight is extracted from description (e.g., "10kg"), totalWeightKg is correct
                            const totalWeightValue =
                              item.totalWeightKg ?? item.total_weight ?? 0;
                            const totalWeightUnit = "kg"; // Always kg for Zeelandia

                            // For Zeelandia: use pricePerKg if available (calculated from description weight)
                            // Example: "Vejce 10kg" → pricePerKg = unit_price / 10
                            const calculatedPricePerKg =
                              item.pricePerKg ?? item.price ?? 0;

                            // Calculate price total using edited values if available
                            const finalTotalWeight =
                              editedTotalWeights[item.id] ?? totalWeightValue;
                            const finalPrice =
                              editedPricePerKg[item.id] ??
                              editedPrices[item.id] ??
                              calculatedPricePerKg;
                            const priceTotal = parseFloat(
                              (
                                Math.floor(finalTotalWeight) * finalPrice
                              ).toFixed(2)
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
                                {/* MJ (Unit of measure) */}
                                <td className="px-3 py-2 text-center text-xs text-gray-600 border-r border-gray-200">
                                  {item.quantity
                                    ? `${item.quantity.toLocaleString("cs-CZ")} ${
                                        item.unit || ""
                                      }`
                                    : "-"}
                                </td>
                                {/* Obsah (Package weight) */}
                                <td className="px-3 py-2 text-right text-sm text-gray-700 border-r border-gray-200">
                                  {item.package_weight &&
                                  item.package_weight_unit
                                    ? `${item.package_weight.toLocaleString(
                                        "cs-CZ",
                                        {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        }
                                      )} ${item.package_weight_unit.toLowerCase()}`
                                    : item.packageWeightKg
                                      ? `${item.packageWeightKg.toLocaleString(
                                          "cs-CZ",
                                          {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          }
                                        )} kg`
                                      : "-"}
                                </td>
                                {/* Fakt. mn. - This will be saved as quantity */}
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
                                              totalWeightValue
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
                                      totalWeightValue)
                                        ? `${Math.floor(
                                            editedTotalWeights[item.id] ??
                                              totalWeightValue
                                          ).toLocaleString(
                                            "cs-CZ"
                                          )} ${totalWeightUnit}`
                                        : "-"}
                                    </span>
                                  )}
                                </td>
                                {/* Cena/jed - This will be saved as unit_price */}
                                <td className="px-3 py-2 text-right text-sm text-gray-700 border-r border-gray-200">
                                  {editingItemId === item.id &&
                                  (editingField === "price" ||
                                    editingField === "pricePerKg") ? (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={
                                        editedPricePerKg[item.id] !== undefined
                                          ? editedPricePerKg[item.id].toString()
                                          : editedPrices[item.id] !== undefined
                                            ? editedPrices[item.id].toString()
                                            : calculatedPricePerKg.toString()
                                      }
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        const parsedValue =
                                          parseFloat(value) || 0;
                                        setEditedPricePerKg((prev) => ({
                                          ...prev,
                                          [item.id]: parsedValue,
                                        }));
                                        setEditedPrices((prev) => ({
                                          ...prev,
                                          [item.id]: parsedValue,
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
                                          setEditedPricePerKg((prev) => {
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
                                      title="Klikněte pro úpravu (stejné jako Cena/kg)"
                                    >
                                      {(
                                        editedPricePerKg[item.id] ??
                                        editedPrices[item.id] ??
                                        calculatedPricePerKg
                                      ).toLocaleString("cs-CZ", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}{" "}
                                      Kč
                                    </span>
                                  )}
                                </td>
                                {/* Cena/kg - Same as Cena/jed (PCE = kg) */}
                                <td className="px-3 py-2 text-right text-sm text-green-600 font-medium border-r border-gray-200 bg-green-50">
                                  {editingItemId === item.id &&
                                  (editingField === "price" ||
                                    editingField === "pricePerKg") ? (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={
                                        editedPricePerKg[item.id] !== undefined
                                          ? editedPricePerKg[item.id].toString()
                                          : editedPrices[item.id] !== undefined
                                            ? editedPrices[item.id].toString()
                                            : calculatedPricePerKg.toString()
                                      }
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        const parsedValue =
                                          parseFloat(value) || 0;
                                        setEditedPricePerKg((prev) => ({
                                          ...prev,
                                          [item.id]: parsedValue,
                                        }));
                                        setEditedPrices((prev) => ({
                                          ...prev,
                                          [item.id]: parsedValue,
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
                                          setEditedPricePerKg((prev) => {
                                            const newState = { ...prev };
                                            delete newState[item.id];
                                            return newState;
                                          });
                                          setEditingItemId(null);
                                          setEditingField(null);
                                        }
                                      }}
                                      onFocus={(e) => {
                                        e.target.select();
                                      }}
                                      autoFocus
                                      className="h-7 text-sm text-right w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  ) : (
                                    <span
                                      onClick={() => {
                                        setEditingItemId(item.id);
                                        setEditingField("pricePerKg");
                                      }}
                                      className="cursor-pointer hover:bg-gray-100 px-1 rounded"
                                      title="Klikněte pro úpravu (stejné jako Cena/jed, PCE = kg)"
                                    >
                                      {(
                                        editedPricePerKg[item.id] ??
                                        editedPrices[item.id] ??
                                        calculatedPricePerKg
                                      ).toLocaleString("cs-CZ", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}{" "}
                                      Kč/kg
                                    </span>
                                  )}
                                </td>
                                {/* Cena celkem */}
                                <td className="px-3 py-2 text-right text-sm font-medium text-gray-900 border-r border-gray-200">
                                  {priceTotal.toLocaleString("cs-CZ", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{" "}
                                  Kč
                                </td>
                                {/* Namapováno */}
                                <td className="px-3 py-2 text-sm">
                                  {item.ingredientName ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="text-green-700 font-medium">
                                          ✓ {item.ingredientName}
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 w-5 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                                          onClick={() => {
                                            if (parsedInvoice) {
                                              const updatedItems =
                                                parsedInvoice.items.map((i) =>
                                                  i.id === item.id
                                                    ? {
                                                        ...i,
                                                        ingredientId: null,
                                                        ingredientName: null,
                                                        matchStatus: "unmapped",
                                                      }
                                                    : i
                                                );
                                              setParsedInvoice({
                                                ...parsedInvoice,
                                                items: updatedItems,
                                                unmappedCount:
                                                  updatedItems.filter(
                                                    (i) =>
                                                      i.matchStatus ===
                                                      "unmapped"
                                                  ).length,
                                              });
                                            }
                                          }}
                                          title="Odebrat mapování"
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                      {item.matchStatus !== "exact" &&
                                        item.confidence < 1 && (
                                          <Badge
                                            variant="destructive"
                                            className="text-xs font-bold bg-orange-600 hover:bg-orange-700"
                                          >
                                            ⚠️ ZKONTROLOVAT!
                                          </Badge>
                                        )}
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
                      {/* Summary row for Zeelandia */}
                      <div className="mt-3 px-4 py-3 bg-green-50 border-t-2 border-green-300 rounded-b-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-gray-700">
                            Mezisoučet (součet řádků):
                          </span>
                          <span className="text-lg font-bold text-green-700">
                            {parsedInvoice.items
                              .reduce((sum, item) => {
                                const totalWeightValue =
                                  (item.total_weight || item.totalWeightKg) ??
                                  0;
                                const finalTotalWeight =
                                  editedTotalWeights[item.id] ??
                                  totalWeightValue;
                                const calculatedPricePerKg =
                                  item.pricePerKg ?? item.price ?? 0;
                                const finalPrice =
                                  editedPricePerKg[item.id] ??
                                  editedPrices[item.id] ??
                                  calculatedPricePerKg;
                                const priceTotal = parseFloat(
                                  (
                                    Math.floor(finalTotalWeight) * finalPrice
                                  ).toFixed(2)
                                );
                                return sum + priceTotal;
                              }, 0)
                              .toLocaleString("cs-CZ", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                            Kč
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : /* Weight-based layout for MAKRO */
                  (() => {
                      const isMakro =
                        selectedSupplier === MAKRO_SUPPLIER_ID ||
                        invoiceSupplier === MAKRO_SUPPLIER_ID;
                      if (isMakro) {
                        console.log("✅ Using MAKRO layout");
                      }
                      return isMakro;
                    })() ? (
                    <div className="mt-2 space-y-2">
                      {/* Mapping Legend */}
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="text-sm font-medium text-blue-800 mb-2">
                          📋 Mapování sloupců do items_received:
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                          <div className="space-y-1">
                            <div className="font-medium text-gray-700">
                              Když je checkbox zaškrtnutý:
                            </div>
                            <div className="text-blue-600">
                              • počet MU → quantity
                            </div>
                            <div className="text-orange-600">
                              • Cena/kg → unit_price (vždy)
                            </div>
                            <div className="text-gray-600">
                              • původní jednotka → unit_of_measure
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="font-medium text-gray-700">
                              Když checkbox není zaškrtnutý:
                            </div>
                            <div className="text-green-600">
                              • celk. hmot. → quantity (primární)
                            </div>
                            <div className="text-blue-600">
                              • počet MU → quantity (záložní)
                            </div>
                            <div className="text-orange-600">
                              • Cena/kg → unit_price (vždy)
                            </div>
                            <div className="text-gray-600">
                              • "kg" → unit_of_measure
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="overflow-x-auto border rounded-md">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-gray-50">
                              <th className="text-left p-2 text-xs">
                                číslo zboží
                              </th>

                              <th className="text-center p-2 text-xs">ks</th>

                              <th className="text-right p-2 text-xs">
                                <div className="flex items-center justify-end gap-1">
                                  počet MU
                                  <Pencil className="w-3 h-3 text-gray-400" />
                                </div>
                                <div className="text-xs text-blue-600 font-medium">
                                  → quantity (fallback)
                                </div>
                              </th>

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
                                <div className="flex items-center justify-end gap-1">
                                  celk. hmot.
                                  <Pencil className="w-3 h-3 text-gray-400" />
                                </div>
                                <div className="text-xs text-green-600 font-medium">
                                  → quantity (primary)
                                </div>
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
                                <div className="flex items-center justify-end gap-1">
                                  Cena/kg
                                  <Pencil className="w-3 h-3 text-gray-400" />
                                </div>
                                <div className="text-xs text-orange-600 font-medium">
                                  → unit_price (vždy)
                                </div>
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

                                  {/* Checkbox for ks unit items */}
                                  <td className="p-2 text-center">
                                    {item.ingredientUnit === "ks" && (
                                      <div className="flex items-center justify-center gap-1">
                                        <input
                                          type="checkbox"
                                          checked={
                                            ksUnitChecked[item.id] !== undefined
                                              ? ksUnitChecked[item.id]
                                              : true
                                          }
                                          onChange={(e) => {
                                            setKsUnitChecked((prev) => ({
                                              ...prev,
                                              [item.id]: e.target.checked,
                                            }));
                                          }}
                                          className="h-3 w-3 text-orange-600 focus:ring-orange-500 rounded"
                                        />
                                        <span className="text-xs text-orange-600 font-medium">
                                          ks
                                        </span>
                                      </div>
                                    )}
                                  </td>

                                  {/* počet MU */}

                                  <td className="p-2 text-right text-xs font-semibold">
                                    {editingItemId === item.id &&
                                    editingField === "quantity" ? (
                                      <Input
                                        type="number"
                                        step="1"
                                        value={
                                          editedQuantities[item.id] !==
                                          undefined
                                            ? editedQuantities[
                                                item.id
                                              ].toString()
                                            : item.quantity.toString()
                                        }
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          setEditedQuantities((prev) => ({
                                            ...prev,
                                            [item.id]: parseFloat(value) || 0,
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
                                            setEditedQuantities((prev) => {
                                              const newState = { ...prev };
                                              delete newState[item.id];
                                              return newState;
                                            });
                                            setEditingItemId(null);
                                            setEditingField(null);
                                          }
                                        }}
                                        onFocus={(e) => {
                                          e.target.select();
                                        }}
                                        autoFocus
                                        className="h-6 text-xs text-right w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                    ) : (
                                      <span
                                        onClick={() => {
                                          setEditingItemId(item.id);
                                          setEditingField("quantity");
                                        }}
                                        className="cursor-pointer hover:bg-gray-100 px-1 rounded"
                                        title="Klikněte pro úpravu"
                                      >
                                        {isWeightFormat ? (
                                          <span className="text-purple-600">
                                            {item.totalWeightKg?.toLocaleString(
                                              "cs-CZ",
                                              {
                                                minimumFractionDigits: 3,
                                                maximumFractionDigits: 3,
                                              }
                                            )}
                                          </span>
                                        ) : (
                                          (
                                            editedQuantities[item.id] ??
                                            item.quantity
                                          ).toLocaleString("cs-CZ")
                                        )}
                                      </span>
                                    )}
                                  </td>

                                  {/* název zboží */}

                                  <td className="p-2 text-xs">
                                    <span className="text-gray-900">
                                      {editedDescriptions[item.id] ??
                                        (item.name || "-")}
                                    </span>
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
                                    {(() => {
                                      const isCheckboxChecked =
                                        item.ingredientUnit === "ks" &&
                                        (ksUnitChecked[item.id] !== undefined
                                          ? ksUnitChecked[item.id]
                                          : true);

                                      // If checkbox is checked, calculate based on jedn. v MU
                                      if (isCheckboxChecked) {
                                        const pocetMu =
                                          editedQuantities[item.id] ??
                                          item.quantity;
                                        const jednVMu = item.unitsInMu || 1;

                                        // If jedn. v MU !== 1, show calculated value (počet MU × jedn. v MU)
                                        const displayValue =
                                          jednVMu !== 1 && jednVMu > 0
                                            ? pocetMu * jednVMu
                                            : pocetMu;

                                        return (
                                          <span className="text-purple-600">
                                            {displayValue.toLocaleString(
                                              "cs-CZ",
                                              {
                                                minimumFractionDigits: 3,
                                                maximumFractionDigits: 3,
                                              }
                                            )}
                                            {jednVMu !== 1 && jednVMu > 0 && (
                                              <span
                                                className="text-xs text-orange-600 ml-1"
                                                title={`${pocetMu} × ${jednVMu}`}
                                              >
                                                (×{jednVMu})
                                              </span>
                                            )}
                                          </span>
                                        );
                                      }

                                      // Otherwise show normal weight editing
                                      // Calculate total weight for kg items with empty package_weight_kg
                                      let displayTotalWeight =
                                        editedTotalWeights[item.id] ??
                                        item.totalWeightKg;
                                      if (
                                        !displayTotalWeight &&
                                        !item.packageWeightKg &&
                                        item.unitsInMu &&
                                        item.quantity
                                      ) {
                                        // For kg items with empty package_weight_kg, calculate: jedn. v MU * počet MU
                                        displayTotalWeight =
                                          item.unitsInMu * item.quantity;
                                      }

                                      return editingItemId === item.id &&
                                        editingField === "totalWeight" ? (
                                        <Input
                                          type="number"
                                          step="0.001"
                                          value={
                                            editedTotalWeights[item.id] !==
                                            undefined
                                              ? editedTotalWeights[
                                                  item.id
                                                ].toString()
                                              : (
                                                  displayTotalWeight ?? 0
                                                ).toString()
                                          }
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            setEditedTotalWeights((prev) => ({
                                              ...prev,
                                              [item.id]: parseFloat(value) || 0,
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
                                          className="h-6 text-xs text-right w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                                          {displayTotalWeight
                                            ? `${displayTotalWeight.toLocaleString(
                                                "cs-CZ",
                                                {
                                                  minimumFractionDigits: 3,
                                                  maximumFractionDigits: 3,
                                                }
                                              )}`
                                            : "-"}
                                        </span>
                                      );
                                    })()}
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
                                        {item.basePrice.toLocaleString(
                                          "cs-CZ",
                                          {
                                            minimumFractionDigits: 2,

                                            maximumFractionDigits: 2,
                                          }
                                        )}

                                        {isWeightFormat && " /kg"}
                                      </span>
                                    ) : (
                                      "-"
                                    )}
                                  </td>

                                  {/* jedn. v MU */}

                                  <td className="p-2 text-right text-xs">
                                    {item.unitsInMu && item.unitsInMu !== 1 ? (
                                      <span
                                        className="text-orange-600 font-bold"
                                        title="Použito pro výpočet celk. hmot."
                                      >
                                        {item.unitsInMu} ✕
                                      </span>
                                    ) : (
                                      item.unitsInMu || "1"
                                    )}
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
                                    {(() => {
                                      const isCheckboxChecked =
                                        item.ingredientUnit === "ks" &&
                                        (ksUnitChecked[item.id] !== undefined
                                          ? ksUnitChecked[item.id]
                                          : true);

                                      // If checkbox is checked, show zákl. cena value
                                      if (isCheckboxChecked) {
                                        return (
                                          <span className="text-purple-600 font-bold">
                                            {(
                                              item.basePrice ||
                                              item.price ||
                                              0
                                            ).toLocaleString("cs-CZ", {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })}{" "}
                                            Kč/kg
                                          </span>
                                        );
                                      }

                                      // Otherwise show normal pricePerKg editing
                                      return editingItemId === item.id &&
                                        editingField === "pricePerKg" ? (
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={
                                            editedPricePerKg[item.id] !==
                                            undefined
                                              ? editedPricePerKg[
                                                  item.id
                                                ].toString()
                                              : (
                                                  item.pricePerKg ?? 0
                                                ).toString()
                                          }
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            setEditedPricePerKg((prev) => ({
                                              ...prev,
                                              [item.id]: parseFloat(value) || 0,
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
                                              setEditedPricePerKg((prev) => {
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
                                          className="h-6 text-xs text-right w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                      ) : (
                                        <span
                                          onClick={() => {
                                            setEditingItemId(item.id);
                                            setEditingField("pricePerKg");
                                          }}
                                          className="cursor-pointer hover:bg-gray-100 px-1 rounded"
                                          title="Klikněte pro úpravu"
                                        >
                                          {(editedPricePerKg[item.id] ??
                                          item.pricePerKg ??
                                          item.basePrice) ? (
                                            <span className="text-orange-600 font-bold">
                                              {(
                                                editedPricePerKg[item.id] ??
                                                item.pricePerKg ??
                                                item.basePrice
                                              ).toLocaleString("cs-CZ", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                              })}{" "}
                                              Kč/kg
                                            </span>
                                          ) : (
                                            <span className="text-gray-400">
                                              -
                                            </span>
                                          )}
                                        </span>
                                      );
                                    })()}
                                  </td>

                                  {/* Namapováno */}

                                  <td className="p-2 text-xs bg-blue-50">
                                    {item.ingredientName ? (
                                      <div className="space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="text-green-700 font-medium">
                                            ✓ {item.ingredientName}
                                          </div>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 w-5 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                                            onClick={() => {
                                              if (parsedInvoice) {
                                                const updatedItems =
                                                  parsedInvoice.items.map(
                                                    (i) =>
                                                      i.id === item.id
                                                        ? {
                                                            ...i,
                                                            ingredientId: null,
                                                            ingredientName:
                                                              null,
                                                            matchStatus:
                                                              "unmapped",
                                                          }
                                                        : i
                                                  );
                                                setParsedInvoice({
                                                  ...parsedInvoice,
                                                  items: updatedItems,
                                                  unmappedCount:
                                                    updatedItems.filter(
                                                      (i) =>
                                                        i.matchStatus ===
                                                        "unmapped"
                                                    ).length,
                                                });
                                              }
                                            }}
                                            title="Odebrat mapování"
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                        {item.matchStatus !== "exact" &&
                                          item.confidence < 1 && (
                                            <Badge
                                              variant="destructive"
                                              className="text-xs font-bold bg-orange-600 hover:bg-orange-700"
                                            >
                                              ⚠️ ZKONTROLOVAT!
                                            </Badge>
                                          )}
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
                      {/* Summary row for Makro */}
                      <div className="mt-3 px-4 py-3 bg-green-50 border-t-2 border-green-300 rounded-b-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-gray-700">
                            Celkem (součet cena celkem):
                          </span>
                          <span className="text-lg font-bold text-green-700">
                            {parsedInvoice.items
                              .reduce((sum, item) => {
                                const itemTotal =
                                  item.total || item.quantity * item.price || 0;
                                return sum + itemTotal;
                              }, 0)
                              .toLocaleString("cs-CZ", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                            Kč
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : /* pesek layout for Pešek supplier */
                  (() => {
                      const isPesek =
                        selectedSupplier === PESEK_SUPPLIER_ID ||
                        invoiceSupplier === PESEK_SUPPLIER_ID;
                      if (isPesek) {
                        console.log("✅ Using Pešek layout");
                      }
                      return isPesek;
                    })() ? (
                    <div className="mt-2">
                      <PesekLineInvoiceLayout
                        items={parsedInvoice.items}
                        onUnmap={handleUnmapItem}
                      />
                    </div>
                  ) : /* Dekos layout for Dekos supplier - check by template display_layout or supplier ID */
                  (() => {
                      const supplierId = selectedSupplier || invoiceSupplier;
                      // Check if supplier has a template with display_layout: "dekos"
                      const dekosTemplate = templates?.find(
                        (t: any) =>
                          t.supplier_id === supplierId &&
                          t.is_active &&
                          t.config?.display_layout === "dekos"
                      );
                      const isDekos =
                        selectedSupplier === DEKOS_SUPPLIER_ID ||
                        invoiceSupplier === DEKOS_SUPPLIER_ID ||
                        !!dekosTemplate;
                      if (isDekos) {
                        console.log("✅ Using Dekos layout", {
                          dekosTemplate: dekosTemplate?.template_name,
                        });
                      }
                      return isDekos;
                    })() ? (
                    <div className="mt-2">
                      <DekosInvoiceLayout
                        items={parsedInvoice.items}
                        supplierId={selectedSupplier || invoiceSupplier}
                        onUnmap={handleUnmapItem}
                        onItemMapped={(
                          itemId: string,
                          ingredientId: number
                        ) => {
                          const ingredient = ingredients.find(
                            (ing) => ing.id === ingredientId
                          );
                          if (!ingredient || !parsedInvoice) return;

                          setParsedInvoice({
                            ...parsedInvoice,
                            items: parsedInvoice.items.map((item) =>
                              item.id === itemId
                                ? {
                                    ...item,
                                    ingredientId: ingredient.id,
                                    ingredientName: ingredient.name,
                                  }
                                : item
                            ),
                          });
                        }}
                        supplierIngredients={ingredients}
                        editedUnitPrices={editedUnitPrices}
                        setEditedUnitPrices={setEditedUnitPrices}
                        editingItemId={editingItemId}
                        setEditingItemId={setEditingItemId}
                        editingField={editingField}
                        setEditingField={setEditingField}
                      />
                    </div>
                  ) : /* Albert layout for Albert supplier - check by template display_layout or supplier ID */
                  (() => {
                      const supplierId = selectedSupplier || invoiceSupplier;
                      // Check if supplier has a template with display_layout: "albert"
                      const albertTemplate = templates?.find(
                        (t: any) =>
                          t.supplier_id === supplierId &&
                          t.is_active &&
                          t.config?.display_layout === "albert"
                      );
                      const isAlbert =
                        selectedSupplier === ALBERT_SUPPLIER_ID ||
                        invoiceSupplier === ALBERT_SUPPLIER_ID ||
                        !!albertTemplate;
                      if (isAlbert) {
                        console.log("✅ Using Albert layout", {
                          albertTemplate: albertTemplate?.template_name,
                        });
                      }
                      return isAlbert;
                    })() ? (
                    <div className="mt-2">
                      <AlbertInvoiceLayout
                        items={parsedInvoice.items}
                        onUnmap={handleUnmapItem}
                        supplierId={selectedSupplier || invoiceSupplier}
                      />
                    </div>
                  ) : /* Le-co layout for Le-co supplier - check by template display_layout or supplier ID */
                  (() => {
                      const supplierId = selectedSupplier || invoiceSupplier;
                      // Check if supplier has a template with display_layout: "leco"
                      const lecoTemplate = templates?.find(
                        (t: any) =>
                          t.supplier_id === supplierId &&
                          t.is_active &&
                          (t.config?.display_layout === "leco" ||
                            t.config?.display_layout === "le-co")
                      );
                      const isLeco =
                        selectedSupplier === LECO_SUPPLIER_ID ||
                        invoiceSupplier === LECO_SUPPLIER_ID ||
                        !!lecoTemplate;
                      if (isLeco) {
                        console.log("✅ Using Le-co layout", {
                          lecoTemplate: lecoTemplate?.template_name,
                        });
                      }
                      return isLeco;
                    })() ? (
                    <div className="mt-2">
                      <LeCoInvoiceLayout
                        items={parsedInvoice.items}
                        onUnmap={handleUnmapItem}
                      />
                    </div>
                  ) : /* FABIO layout for FABIO supplier - check by template display_layout or supplier ID */
                  (() => {
                      const supplierId = selectedSupplier || invoiceSupplier;
                      // Check if supplier has a template with display_layout: "fabio"
                      const fabioTemplate = templates?.find(
                        (t: any) =>
                          t.supplier_id === supplierId &&
                          t.is_active &&
                          t.config?.display_layout === "fabio"
                      );
                      const isFabio =
                        selectedSupplier === FABIO_SUPPLIER_ID ||
                        invoiceSupplier === FABIO_SUPPLIER_ID ||
                        !!fabioTemplate;

                      console.log("🔍 FABIO Layout Check:", {
                        supplierId,
                        FABIO_SUPPLIER_ID,
                        selectedSupplier,
                        invoiceSupplier,
                        supplierIdMatch: supplierId === FABIO_SUPPLIER_ID,
                        fabioTemplate: fabioTemplate?.template_name,
                        fabioTemplateDisplayLayout:
                          fabioTemplate?.config?.display_layout,
                        isFabio,
                      });

                      if (isFabio) {
                        console.log("✅ Using FABIO layout", {
                          fabioTemplate: fabioTemplate?.template_name,
                        });
                      }
                      return isFabio;
                    })() ? (
                    <div className="mt-2">
                      <FabioInvoiceLayout
                        items={parsedInvoice.items}
                        onUnmap={handleUnmapItem}
                        supplierId={selectedSupplier || invoiceSupplier}
                        onItemMapped={(
                          itemId: string,
                          ingredientId: number
                        ) => {
                          const ingredient = ingredients.find(
                            (ing) => ing.id === ingredientId
                          );
                          if (!ingredient || !parsedInvoice) return;

                          setParsedInvoice({
                            ...parsedInvoice,
                            items: parsedInvoice.items.map((item) =>
                              item.id === itemId
                                ? {
                                    ...item,
                                    ingredientId: ingredient.id,
                                    ingredientName: ingredient.name,
                                  }
                                : item
                            ),
                          });
                        }}
                        supplierIngredients={ingredients}
                        editedFabioQuantities={editedFabioQuantities}
                        setEditedFabioQuantities={setEditedFabioQuantities}
                        editedFabioPrices={editedFabioPrices}
                        setEditedFabioPrices={setEditedFabioPrices}
                        editingItemId={editingItemId}
                        setEditingItemId={setEditingItemId}
                        editingField={editingField}
                        setEditingField={setEditingField}
                      />
                    </div>
                  ) : (
                    /* Standard table layout for other suppliers */
                    (() => {
                      console.log(
                        "⚠️ Using default Pešek layout (no specific layout matched)"
                      );
                      return (
                        <div className="mt-2">
                          <PesekLineInvoiceLayout
                            items={parsedInvoice.items}
                            onUnmap={handleUnmapItem}
                          />
                        </div>
                      );
                    })()
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
                            className="flex items-center justify-between gap-3 p-2 bg-white rounded border border-red-200"
                          >
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <code className="text-xs bg-red-800 text-white px-1.5 py-0.5 rounded">
                                {item.supplierCode}
                              </code>

                              <span className="text-sm text-red-900 font-medium">
                                {editedDescriptions[item.id] ?? item.name}
                              </span>

                              <span className="text-xs text-red-600">
                                ({item.quantity} {item.unit})
                              </span>
                            </div>

                            <div className="flex items-center gap-2 flex-1 justify-end">
                              <Select
                                value={item.ingredientId?.toString() || ""}
                                onValueChange={(value) => {
                                  if (parsedInvoice && value) {
                                    const selectedIngredient = ingredients.find(
                                      (ing) => ing.id.toString() === value
                                    );
                                    if (selectedIngredient) {
                                      const updatedItems =
                                        parsedInvoice.items.map((i) =>
                                          i.id === item.id
                                            ? {
                                                ...i,
                                                ingredientId:
                                                  selectedIngredient.id,
                                                ingredientName:
                                                  selectedIngredient.name,
                                                ingredientUnit:
                                                  selectedIngredient.unit,
                                                matchStatus: "exact" as const,
                                              }
                                            : i
                                        );
                                      setParsedInvoice({
                                        ...parsedInvoice,
                                        items: updatedItems,
                                        unmappedCount: updatedItems.filter(
                                          (i) => i.matchStatus === "unmapped"
                                        ).length,
                                      });
                                    }
                                  }
                                }}
                              >
                                <SelectTrigger className="w-[250px] h-8 text-xs">
                                  <SelectValue placeholder="Vyberte surovinu..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {ingredients
                                    .filter((ing) => ing.active)
                                    .sort((a, b) =>
                                      a.name.localeCompare(b.name)
                                    )
                                    .map((ingredient) => (
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
                          </div>
                        ))}
                    </div>

                    <p className="text-xs text-red-700 mt-2">
                      💡 Vyberte správnou surovinu z rozevíracího seznamu pro
                      namapování položky. Případně můžete přejít do{" "}
                      <strong>
                        Admin → Šablony faktur → Nenamapované kódy
                      </strong>{" "}
                      pro trvalé uložení mapování.
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
