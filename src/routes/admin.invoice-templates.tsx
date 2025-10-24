import { createFileRoute } from "@tanstack/react-router";
import { InvoiceTemplateEditor } from "@/components/InvoiceTemplateEditor";
import { UnmappedCodesManager } from "@/components/UnmappedCodesManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText, Code2, BookOpen, Upload } from "lucide-react";
import { useState, useEffect } from "react";
import { useDocumentAI } from "@/hooks/useDocumentAI";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/admin/invoice-templates")({
  component: InvoiceTemplatesPage,
});

function InvoiceTemplatesPage() {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Správa šablon faktur</h1>
          <p className="text-muted-foreground mt-2">
            Automatické zpracování faktur pomocí OCR a šablon
          </p>
        </div>
      </div>

      {/* Quick Start Guide */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Rychlý start</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="font-semibold text-blue-600">1.</span>
            <span>
              Vytvořte šablonu pro dodavatele s regex vzory pro extrakci dat
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-semibold text-blue-600">2.</span>
            <span>
              Nahrajte testovací fakturu a zkontrolujte extrahovaná data
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-semibold text-blue-600">3.</span>
            <span>Namapujte neznámé kódy produktů na suroviny v databázi</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-semibold text-blue-600">4.</span>
            <span>
              Příští faktury se automaticky zpracují s namapovanými kódy
            </span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="test" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="test" className="gap-2">
            <Upload className="h-4 w-4" />
            Test Upload
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            Šablony faktur
          </TabsTrigger>
          <TabsTrigger value="codes" className="gap-2">
            <Code2 className="h-4 w-4" />
            Nenamapované kódy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="test" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Invoice Upload</CardTitle>
              <CardDescription>
                Upload a test invoice to see how the OCR extraction works
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SupplierSelector
                value={selectedSupplierId}
                onChange={setSelectedSupplierId}
              />
            </CardContent>
          </Card>

          {selectedSupplierId ? (
            <InvoiceTestUpload supplierId={selectedSupplierId} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Vyberte dodavatele pro test nahrání faktury
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Výběr dodavatele</CardTitle>
              <CardDescription>
                Vyberte dodavatele pro zobrazení a správu jeho šablon
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SupplierSelector
                value={selectedSupplierId}
                onChange={setSelectedSupplierId}
              />
            </CardContent>
          </Card>

          {selectedSupplierId ? (
            <InvoiceTemplateEditor supplierId={selectedSupplierId} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Vyberte dodavatele pro zobrazení šablon
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="codes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Výběr dodavatele</CardTitle>
              <CardDescription>
                Vyberte dodavatele pro zobrazení nenamapovaných kódů
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SupplierSelector
                value={selectedSupplierId}
                onChange={setSelectedSupplierId}
              />
            </CardContent>
          </Card>

          {selectedSupplierId ? (
            <UnmappedCodesManager supplierId={selectedSupplierId} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Vyberte dodavatele pro zobrazení nenamapovaných kódů
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Documentation Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dokumentace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/docs/TEMPLATE_INVOICE_QUICK_START.md"
              target="_blank"
              className="p-4 border rounded-lg hover:bg-accent transition-colors"
            >
              <div className="font-semibold">Rychlý start (30 min)</div>
              <div className="text-sm text-muted-foreground mt-1">
                Nastavení systému za 30 minut
              </div>
            </a>
            <a
              href="/docs/TEMPLATE_BASED_INVOICE_AI_SETUP.md"
              target="_blank"
              className="p-4 border rounded-lg hover:bg-accent transition-colors"
            >
              <div className="font-semibold">Kompletní průvodce</div>
              <div className="text-sm text-muted-foreground mt-1">
                Detailní dokumentace systému
              </div>
            </a>
            <a
              href="/docs/INVOICE_AI_SYSTEM_SUMMARY.md"
              target="_blank"
              className="p-4 border rounded-lg hover:bg-accent transition-colors"
            >
              <div className="font-semibold">Přehled systému</div>
              <div className="text-sm text-muted-foreground mt-1">
                Architektura a možnosti
              </div>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Invoice test upload component
function InvoiceTestUpload({ supplierId }: { supplierId: string }) {
  const { processDocumentWithTemplate, isProcessing } = useDocumentAI();
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResult(null);
    setError(null);

    console.log("Processing file:", file.name, "for supplier:", supplierId);

    const uploadResult = await processDocumentWithTemplate(file, supplierId);

    if (uploadResult.success) {
      setResult(uploadResult.data);
    } else {
      setError(uploadResult.error || "Unknown error");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Invoice</CardTitle>
        <CardDescription>
          Select a PDF or image file of an invoice to test extraction
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileUpload}
            disabled={isProcessing}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {isProcessing && (
            <p className="mt-2 text-sm text-blue-600">
              Zpracovávám fakturu... Počkejte prosím.
            </p>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              <strong>Chyba:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                ✅ Faktura úspěšně zpracována!
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Číslo faktury</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">
                    {result.invoiceNumber || "Nenalezeno"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Datum</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">
                    {result.date || "Nenalezeno"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Celková částka</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">
                    {result.totalAmount
                      ? `${result.totalAmount.toLocaleString("cs-CZ")} Kč`
                      : "Nenalezeno"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Položky</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">
                    {result.items?.length || 0} položek
                  </p>
                  {result.unmapped_codes > 0 && (
                    <p className="text-sm text-orange-600 mt-1">
                      {result.unmapped_codes} nenamapovaných kódů
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Extrahované položky</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Kód</th>
                        <th className="text-left p-2">Popis</th>
                        <th className="text-right p-2">Množství</th>
                        <th className="text-right p-2">Cena</th>
                        <th className="text-left p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.items?.map((item: any, idx: number) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2 font-mono">{item.product_code}</td>
                          <td className="p-2">{item.description || "-"}</td>
                          <td className="p-2 text-right">
                            {item.quantity} {item.unit_of_measure}
                          </td>
                          <td className="p-2 text-right">
                            {item.unit_price?.toLocaleString("cs-CZ")} Kč
                          </td>
                          <td className="p-2">
                            {item.matched_ingredient_id ? (
                              <span className="text-green-600 text-xs">
                                ✓ Namapováno
                              </span>
                            ) : (
                              <span className="text-orange-600 text-xs">
                                ⚠ Nenamapováno
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {result.unmapped_codes > 0 && (
              <Alert>
                <AlertDescription>
                  💡 Přejděte na záložku "Nenamapované kódy" pro přiřazení
                  surovin k nenamapovaným kódům.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Supplier selector component
function SupplierSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [suppliers, setSuppliers] = useState<
    Array<{ id: string; full_name: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch suppliers from profiles
  useEffect(() => {
    const fetchSuppliers = async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "supplier")
        .order("full_name");

      if (data) {
        setSuppliers(data);
      }
      setIsLoading(false);
    };

    fetchSuppliers();
  }, []);

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground">
        Načítání dodavatelů...
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full max-w-md px-3 py-2 border rounded-md"
    >
      <option value="">-- Vyberte dodavatele --</option>
      {suppliers.map((supplier) => (
        <option key={supplier.id} value={supplier.id}>
          {supplier.full_name}
        </option>
      ))}
    </select>
  );
}
