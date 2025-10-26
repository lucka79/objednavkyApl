import { useState, useRef } from "react";
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
import { Upload, FileText, CheckCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSupplierUsers } from "@/hooks/useProfiles";
import { useDocumentAI } from "@/hooks/useDocumentAI";
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
}

interface ParsedInvoice {
  id: string;
  supplier: string;
  invoiceNumber: string;
  date: string;
  totalAmount: number;
  items: ParsedInvoiceItem[];
  confidence: number;
  status: "pending" | "reviewed" | "approved" | "rejected";
  unmappedCount?: number;
  templateUsed?: string;
}

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
  const [notes, setNotes] = useState("");
  const [currentStep, setCurrentStep] = useState<
    "supplier" | "upload" | "manual" | "review"
  >("supplier");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { data: supplierUsers } = useSupplierUsers();
  const { processDocumentWithTemplate } = useDocumentAI();

  const handleSupplierSelect = (supplierId: string) => {
    setInvoiceSupplier(supplierId);
    setCurrentStep("upload");
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
          total: item.total_price || item.total,
          supplierCode: item.product_code || item.supplierCode,
          confidence: item.match_confidence || item.confidence || 0,
          matchStatus: item.match_status,
          ingredientId: item.matched_ingredient_id,
          ingredientName: item.matched_ingredient_name,
        }));

        // Calculate total amount from items
        const calculatedTotal = items.reduce((sum: number, item: any) => {
          const itemTotal = item.total || item.quantity * item.price || 0;
          return sum + itemTotal;
        }, 0);

        // Get supplier name
        const supplierName =
          supplierUsers?.find((s: any) => s.id === invoiceSupplier)
            ?.full_name || invoiceSupplier;

        setParsedInvoice({
          id: `inv_${Date.now()}`,
          supplier: supplierName,
          invoiceNumber: result.data.invoiceNumber,
          date: result.data.date,
          totalAmount: calculatedTotal,
          items,
          confidence: result.data.confidence / 100 || 0,
          status: "pending",
          unmappedCount: result.data.unmapped_codes || 0,
          templateUsed: result.data.template_used,
        });

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

  const handleApprove = () => {
    if (!parsedInvoice) return;

    // Here you would save the parsed invoice to your database
    toast({
      title: "Úspěch",
      description: "Faktura byla schválena a uložena",
    });

    setIsOpen(false);
    setParsedInvoice(null);
    setSelectedFile(null);
    setUploadProgress(0);
    setCurrentStep("supplier");
    setInvoiceSupplier("");
    setSelectedSupplier("");
    setNotes("");
  };

  const handleReject = () => {
    setParsedInvoice(null);
    setSelectedFile(null);
    setUploadProgress(0);
    setCurrentStep("supplier");
    setInvoiceSupplier("");
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                  {supplierUsers?.map((supplier: any) => (
                    <Button
                      key={supplier.id}
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center gap-2 hover:bg-orange-50 hover:border-orange-300"
                      onClick={() => handleSupplierSelect(supplier.id)}
                    >
                      <div className="font-medium">{supplier.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        Natrénovaná šablona OCR + auto-mapování
                      </div>
                    </Button>
                  ))}
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
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-md">
                  <div>
                    <Label className="text-sm font-medium">Dodavatel</Label>
                    <p className="text-sm">{parsedInvoice.supplier}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Číslo faktury</Label>
                    <p className="text-sm">{parsedInvoice.invoiceNumber}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Datum</Label>
                    <p className="text-sm">{parsedInvoice.date}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">
                      Celková částka
                    </Label>
                    <p className="text-sm font-semibold">
                      {parsedInvoice.totalAmount.toFixed(2)} Kč
                    </p>
                  </div>
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

                {/* Invoice Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">
                      Položky faktury ({parsedInvoice.items.length})
                    </Label>
                    {parsedInvoice.unmappedCount &&
                      parsedInvoice.unmappedCount > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {parsedInvoice.unmappedCount} nenamapováno
                        </Badge>
                      )}
                  </div>
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
                            <span className="font-medium">{item.name}</span>
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
                </div>

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
