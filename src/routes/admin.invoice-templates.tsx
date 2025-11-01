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
import { FileText, Code2, Upload, RotateCcw } from "lucide-react";
import { useState, useEffect } from "react";
import { useDocumentAI } from "@/hooks/useDocumentAI";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useInvoiceTemplates } from "@/hooks/useInvoiceTemplates";
import {
  MakroInvoiceLayout,
  PesekLineInvoiceLayout,
  ZeelandiaInvoiceLayout,
} from "@/components/invoice-layouts";

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

      {/* Rychlý start */}
      {/* <Card className="border-blue-200 bg-blue-50/50">
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
      </Card> */}

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
            <InvoiceTestUpload
              key={selectedSupplierId}
              supplierId={selectedSupplierId}
            />
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
      {/* <Card>
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
      </Card> */}
    </div>
  );
}

// Invoice test upload component
function InvoiceTestUpload({ supplierId }: { supplierId: string }) {
  const { processDocumentWithTemplate, isProcessing } = useDocumentAI();
  const { templates, updateTemplate } = useInvoiceTemplates(supplierId);

  // Persist state in sessionStorage to survive tab switches
  const [result, setResult] = useState<any>(() => {
    const saved = sessionStorage.getItem(`invoice_result_${supplierId}`);
    return saved ? JSON.parse(saved) : null;
  });
  const [error, setError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(
    () => {
      return sessionStorage.getItem(`invoice_filename_${supplierId}`);
    }
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const [editedPatterns, setEditedPatterns] = useState<any>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [columnMappings, setColumnMappings] = useState<any>({});

  // Get the active template for this supplier
  const activeTemplate = templates.find((t) => t.is_active);

  // Persist result to sessionStorage when it changes
  useEffect(() => {
    if (result) {
      sessionStorage.setItem(
        `invoice_result_${supplierId}`,
        JSON.stringify(result)
      );
    }
  }, [result, supplierId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResult(null);
    setError(null);
    setUploadedFile(file);
    setUploadedFileName(file.name);
    sessionStorage.setItem(`invoice_filename_${supplierId}`, file.name);

    // Create preview for images and PDFs
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else if (file.type === "application/pdf") {
      // Create blob URL for PDF preview
      const blobUrl = URL.createObjectURL(file);
      setPdfUrl(blobUrl);
      setFilePreview("PDF");
    }

    console.log("Processing file:", file.name, "for supplier:", supplierId);

    const uploadResult = await processDocumentWithTemplate(file, supplierId);

    if (uploadResult.success) {
      console.log("InvoiceTestUpload - Received data:", {
        payment_type: uploadResult.data.payment_type,
        paymentType: uploadResult.data.paymentType,
        allKeys: Object.keys(uploadResult.data),
      });
      console.log("InvoiceTestUpload - Extracted items:", {
        itemsCount: uploadResult.data.items?.length || 0,
        items: uploadResult.data.items,
        firstItem: uploadResult.data.items?.[0],
        allItemsDetails: uploadResult.data.items?.map(
          (item: any, idx: number) => ({
            index: idx,
            product_code: item.product_code,
            description: item.description,
            quantity: item.quantity,
            unit_of_measure: item.unit_of_measure,
            unit_price: item.unit_price,
            line_total: item.line_total,
            vat_rate: item.vat_rate,
            line_number: item.line_number,
          })
        ),
      });
      setResult(uploadResult.data);
    } else {
      setError(uploadResult.error || "Unknown error");
    }
  };

  // Re-process the same file (after mapping new codes)
  const handleReprocess = async () => {
    if (!uploadedFile) {
      alert(
        "Soubor již není v paměti. Nahrajte fakturu znovu pro aktualizované výsledky."
      );
      return;
    }

    setResult(null);
    setError(null);

    console.log(
      "Re-processing file:",
      uploadedFile.name,
      "for supplier:",
      supplierId
    );

    const uploadResult = await processDocumentWithTemplate(
      uploadedFile,
      supplierId
    );

    if (uploadResult.success) {
      console.log("InvoiceTestUpload - Reprocess data:", {
        payment_type: uploadResult.data.payment_type,
        paymentType: uploadResult.data.paymentType,
        allKeys: Object.keys(uploadResult.data),
      });
      console.log("InvoiceTestUpload - Reprocess extracted items:", {
        itemsCount: uploadResult.data.items?.length || 0,
        items: uploadResult.data.items,
        firstItem: uploadResult.data.items?.[0],
        allItemsDetails: uploadResult.data.items?.map(
          (item: any, idx: number) => ({
            index: idx,
            product_code: item.product_code,
            description: item.description,
            quantity: item.quantity,
            unit_of_measure: item.unit_of_measure,
            unit_price: item.unit_price,
            line_total: item.line_total,
            vat_rate: item.vat_rate,
            line_number: item.line_number,
          })
        ),
      });
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
        <div className="flex gap-4 items-start">
          <div className="flex-1">
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
          {(uploadedFile || uploadedFileName) && !isProcessing && (
            <Button
              onClick={handleReprocess}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Znovu zpracovat
            </Button>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              <strong>Chyba:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {result && !uploadedFile && uploadedFileName && (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertDescription className="text-amber-800">
              <strong>ℹ️ Info:</strong> Zobrazuji uložené výsledky pro soubor "
              <strong>{uploadedFileName}</strong>". Pro aktualizované výsledky s
              novými mapováními nahrajte fakturu znovu.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      {result && (
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>✅ Faktura úspěšně zpracována!</AlertDescription>
          </Alert>

          {/* Invoice Preview and Raw Text with Annotation Tools */}
          {uploadedFile && (
            <div className="space-y-4">
              {/* Selected Text Indicator */}
              {selectedText && (
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <div>
                        <strong>✓ Text označen:</strong>{" "}
                        <code className="bg-white px-2 py-1 rounded text-sm">
                          {selectedText.length > 50
                            ? selectedText.substring(0, 50) + "..."
                            : selectedText}
                        </code>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedText("")}
                      >
                        ✕ Zrušit
                      </Button>
                    </div>
                    <p className="text-xs mt-2 text-muted-foreground">
                      👆 Klikněte na tlačítko "✏️ Použít označený text" u pole,
                      které chcete aktualizovat
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {/* Quick Instructions */}
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-sm">🎯 Jak použít</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="text-xs space-y-1 list-decimal list-inside">
                    <li>Označte text v PDF nebo v OCR výstupu myší</li>
                    <li>
                      Klikněte na tlačítko "✏️ Použít označený text" u
                      příslušného pole
                    </li>
                    <li>Systém automaticky vytvoří regex vzor</li>
                    <li>Zkontrolujte vzory a klikněte "💾 Uložit změny"</li>
                    <li>Nahrajte fakturu znovu pro test nových vzorů</li>
                  </ol>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Raw OCR Text</CardTitle>
                    <CardDescription className="text-xs">
                      Vyberte text myší a použijte tlačítka vpravo
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {result.raw_text ? (
                      <div
                        className="bg-gray-50 p-4 rounded border max-h-96 overflow-y-auto select-text"
                        onMouseUp={() => {
                          const selection = window.getSelection();
                          const text = selection?.toString().trim();
                          if (text) {
                            setSelectedText(text);
                          }
                        }}
                      >
                        <pre className="text-xs whitespace-pre-wrap font-mono">
                          {highlightMappedText(result.raw_text, columnMappings)}
                        </pre>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        OCR text není k dispozici
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Column Mapping Interface OR PDF Preview */}
                {showColumnMapping &&
                result.items &&
                result.items.length > 0 ? (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardHeader>
                      <CardTitle className="text-sm">
                        🎯 Mapování řádků - {result.items.length} položek
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Označte text v OCR a přiřaďte ho ke sloupcům pro každý
                        řádek
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {result.items.map((item: any, rowIndex: number) => (
                          <Card
                            key={rowIndex}
                            className="bg-white border border-gray-200"
                          >
                            <CardHeader className="pb-2">
                              <CardTitle className="text-xs">
                                Řádek {rowIndex + 1}:{" "}
                                {item.product_code || "N/A"} -{" "}
                                {item.description || "N/A"}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="grid grid-cols-2 gap-1">
                                <div className="space-y-1">
                                  <Button
                                    size="sm"
                                    variant={
                                      columnMappings[`row_${rowIndex}_code`]
                                        ? "default"
                                        : "outline"
                                    }
                                    className="w-full justify-start text-xs h-7"
                                    onClick={() => {
                                      if (selectedText) {
                                        setColumnMappings((prev: any) => ({
                                          ...prev,
                                          [`row_${rowIndex}_code`]:
                                            selectedText,
                                        }));
                                      }
                                    }}
                                    disabled={!selectedText}
                                  >
                                    {columnMappings[`row_${rowIndex}_code`]
                                      ? `✓ Kód: ${columnMappings[`row_${rowIndex}_code`]}`
                                      : "Kód"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={
                                      columnMappings[
                                        `row_${rowIndex}_description`
                                      ]
                                        ? "default"
                                        : "outline"
                                    }
                                    className="w-full justify-start text-xs h-7"
                                    onClick={() => {
                                      if (selectedText) {
                                        setColumnMappings((prev: any) => ({
                                          ...prev,
                                          [`row_${rowIndex}_description`]:
                                            selectedText,
                                        }));
                                      }
                                    }}
                                    disabled={!selectedText}
                                  >
                                    {columnMappings[
                                      `row_${rowIndex}_description`
                                    ]
                                      ? `✓ Popis: ${columnMappings[`row_${rowIndex}_description`]}`
                                      : "Popis"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={
                                      columnMappings[`row_${rowIndex}_quantity`]
                                        ? "default"
                                        : "outline"
                                    }
                                    className="w-full justify-start text-xs h-7"
                                    onClick={() => {
                                      if (selectedText) {
                                        setColumnMappings((prev: any) => ({
                                          ...prev,
                                          [`row_${rowIndex}_quantity`]:
                                            selectedText,
                                        }));
                                      }
                                    }}
                                    disabled={!selectedText}
                                  >
                                    {columnMappings[`row_${rowIndex}_quantity`]
                                      ? `✓ Množství: ${columnMappings[`row_${rowIndex}_quantity`]}`
                                      : "Množství"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={
                                      columnMappings[`row_${rowIndex}_unit`]
                                        ? "default"
                                        : "outline"
                                    }
                                    className="w-full justify-start text-xs h-7"
                                    onClick={() => {
                                      if (selectedText) {
                                        setColumnMappings((prev: any) => ({
                                          ...prev,
                                          [`row_${rowIndex}_unit`]:
                                            selectedText,
                                        }));
                                      }
                                    }}
                                    disabled={!selectedText}
                                  >
                                    {columnMappings[`row_${rowIndex}_unit`]
                                      ? `✓ Jednotka: ${columnMappings[`row_${rowIndex}_unit`]}`
                                      : "Jednotka"}
                                  </Button>
                                </div>
                                <div className="space-y-1">
                                  <Button
                                    size="sm"
                                    variant={
                                      columnMappings[`row_${rowIndex}_obsah`]
                                        ? "default"
                                        : "outline"
                                    }
                                    className="w-full justify-start text-xs h-7"
                                    onClick={() => {
                                      if (selectedText) {
                                        setColumnMappings((prev: any) => ({
                                          ...prev,
                                          [`row_${rowIndex}_obsah`]:
                                            selectedText,
                                        }));
                                      }
                                    }}
                                    disabled={!selectedText}
                                  >
                                    {columnMappings[`row_${rowIndex}_obsah`]
                                      ? `✓ Obsah: ${columnMappings[`row_${rowIndex}_obsah`]}`
                                      : "Obsah"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={
                                      columnMappings[`row_${rowIndex}_fakt_mn`]
                                        ? "default"
                                        : "outline"
                                    }
                                    className="w-full justify-start text-xs h-7"
                                    onClick={() => {
                                      if (selectedText) {
                                        setColumnMappings((prev: any) => ({
                                          ...prev,
                                          [`row_${rowIndex}_fakt_mn`]:
                                            selectedText,
                                        }));
                                      }
                                    }}
                                    disabled={!selectedText}
                                  >
                                    {columnMappings[`row_${rowIndex}_fakt_mn`]
                                      ? `✓ Fakt.mn: ${columnMappings[`row_${rowIndex}_fakt_mn`]}`
                                      : "Fakt.mn"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={
                                      columnMappings[
                                        `row_${rowIndex}_unit_price`
                                      ]
                                        ? "default"
                                        : "outline"
                                    }
                                    className="w-full justify-start text-xs h-7"
                                    onClick={() => {
                                      if (selectedText) {
                                        setColumnMappings((prev: any) => ({
                                          ...prev,
                                          [`row_${rowIndex}_unit_price`]:
                                            selectedText,
                                        }));
                                      }
                                    }}
                                    disabled={!selectedText}
                                  >
                                    {columnMappings[
                                      `row_${rowIndex}_unit_price`
                                    ]
                                      ? `✓ Cena/jed: ${columnMappings[`row_${rowIndex}_unit_price`]}`
                                      : "Cena/jed"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={
                                      columnMappings[
                                        `row_${rowIndex}_total_price`
                                      ]
                                        ? "default"
                                        : "outline"
                                    }
                                    className="w-full justify-start text-xs h-7"
                                    onClick={() => {
                                      if (selectedText) {
                                        setColumnMappings((prev: any) => ({
                                          ...prev,
                                          [`row_${rowIndex}_total_price`]:
                                            selectedText,
                                        }));
                                      }
                                    }}
                                    disabled={!selectedText}
                                  >
                                    {columnMappings[
                                      `row_${rowIndex}_total_price`
                                    ]
                                      ? `✓ Cena celkem: ${columnMappings[`row_${rowIndex}_total_price`]}`
                                      : "Cena celkem"}
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}

                        <div className="flex gap-1 pt-2 border-t">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs flex-1"
                            onClick={() => {
                              // Generate pattern from all mapped rows
                              const pattern =
                                generatePatternFromMappings(columnMappings);
                              setEditedPatterns((prev: any) => ({
                                ...prev,
                                line_pattern: pattern,
                              }));
                              setHasChanges(true);
                              setShowColumnMapping(false);
                            }}
                            disabled={Object.keys(columnMappings).length < 3}
                          >
                            🔧 Generovat z{" "}
                            {
                              Object.keys(columnMappings).filter((key) =>
                                key.startsWith("row_")
                              ).length
                            }{" "}
                            řádků
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => {
                              setColumnMappings({});
                              setSelectedText("");
                            }}
                          >
                            🗑️
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => {
                              setShowColumnMapping(false);
                            }}
                          >
                            ❌
                          </Button>
                        </div>
                      </div>

                      {selectedText && (
                        <Alert className="mt-3 bg-green-50 border-green-200">
                          <AlertDescription className="text-xs">
                            <div className="flex items-center justify-between">
                              <div>
                                <strong>✓ Označený text:</strong> {selectedText}
                                <br />
                                Klikněte na sloupec v řádku pro přiřazení
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() => setSelectedText("")}
                              >
                                ✕
                              </Button>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  /* PDF Preview - shown when column mapping is not active */
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Náhled faktury</CardTitle>
                      <CardDescription className="text-xs">
                        {pdfUrl &&
                          "Označte text v PDF a použijte tlačítka v kartách vlevo"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {pdfUrl ? (
                        <div className="relative">
                          <iframe
                            src={pdfUrl}
                            className="w-full h-96 border rounded"
                            title="Invoice PDF"
                            onLoad={(event) => {
                              // Enable text selection in iframe
                              const iframe = event.target as HTMLIFrameElement;
                              try {
                                iframe.contentWindow?.addEventListener(
                                  "mouseup",
                                  () => {
                                    const selection =
                                      iframe.contentWindow?.getSelection();
                                    const text = selection?.toString().trim();
                                    if (text && text.length > 0) {
                                      setSelectedText(text);
                                    }
                                  }
                                );
                              } catch (err) {
                                console.log(
                                  "Cannot access iframe content (CORS)"
                                );
                              }
                            }}
                          />
                        </div>
                      ) : filePreview && filePreview !== "PDF" ? (
                        <img
                          src={filePreview}
                          alt="Invoice preview"
                          className="w-full border rounded"
                        />
                      ) : (
                        <div className="border rounded p-8 text-center text-muted-foreground">
                          📄 PDF soubor:{" "}
                          {uploadedFile?.name || "Neznámý soubor"}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* Quick Update Patterns */}
          {hasChanges && (
            <Alert>
              <AlertDescription className="flex items-center justify-between">
                <span>✏️ Máte neuložené změny ve vzorech</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditedPatterns({});
                      setHasChanges(false);
                    }}
                  >
                    Zrušit
                  </Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!activeTemplate) return;

                      // Separate line_pattern, table_end, and ignore_patterns from other patterns
                      const {
                        line_pattern,
                        table_end,
                        ignore_patterns,
                        ...otherPatterns
                      } = editedPatterns;

                      // Build updated patterns, removing table_end if it's null
                      const updatedPatterns = {
                        ...activeTemplate.config.patterns,
                        ...otherPatterns,
                      };

                      // Handle table_end: remove if null, update if provided
                      if (table_end === null) {
                        delete updatedPatterns.table_end;
                      } else if (table_end) {
                        updatedPatterns.table_end = table_end;
                      }

                      // Build updated table_columns
                      const updatedTableColumns = {
                        ...activeTemplate.config.table_columns,
                      };

                      // Add line_pattern if it exists
                      if (line_pattern) {
                        updatedTableColumns.line_pattern = line_pattern;
                      }

                      // Add ignore_patterns if they exist
                      if (ignore_patterns) {
                        (updatedTableColumns as any).ignore_patterns =
                          ignore_patterns;
                      }

                      const updatedConfig = {
                        ...activeTemplate.config,
                        patterns: updatedPatterns,
                        ...(Object.keys(updatedTableColumns).length > 0 && {
                          table_columns: updatedTableColumns,
                        }),
                      };

                      await updateTemplate({
                        id: activeTemplate.id,
                        updates: { config: updatedConfig },
                      });

                      setEditedPatterns({});
                      setHasChanges(false);
                      alert(
                        "Vzory úspěšně uloženy! Nahrajte fakturu znovu pro test."
                      );
                    }}
                  >
                    💾 Uložit změny
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Číslo faktury</CardTitle>
                {selectedText && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const pattern = generateRegexPattern(
                        selectedText,
                        "invoice_number"
                      );
                      setEditedPatterns((prev: any) => ({
                        ...prev,
                        invoice_number: pattern,
                      }));
                      setHasChanges(true);
                      setSelectedText("");
                    }}
                  >
                    ✏️ Použít označený text
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {result.invoiceNumber || (
                    <span className="text-orange-600">Nenalezeno</span>
                  )}
                </p>
                {editedPatterns.invoice_number && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ Nový vzor: {editedPatterns.invoice_number}
                  </p>
                )}
                {result.invoiceNumber && result.invoiceNumber.length <= 2 && (
                  <Alert className="mt-2">
                    <AlertDescription className="text-xs">
                      ⚠️ Číslo "{result.invoiceNumber}" vypadá jako číslo
                      stránky!
                      <br />
                      Označte v OCR textu správné číslo faktury (např. "Číslo
                      dokladu 2531898") a klikněte na "✏️ Použít označený text"
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Datum</CardTitle>
                {selectedText && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const pattern = generateRegexPattern(
                        selectedText,
                        "date"
                      );
                      setEditedPatterns((prev: any) => ({
                        ...prev,
                        date: pattern,
                      }));
                      setHasChanges(true);
                      setSelectedText("");
                    }}
                  >
                    ✏️ Použít označený text
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {result.date || (
                    <span className="text-orange-600">Nenalezeno</span>
                  )}
                </p>
                {editedPatterns.date && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ Nový vzor: {editedPatterns.date}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Celková částka</CardTitle>
                {selectedText && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const pattern = generateRegexPattern(
                        selectedText,
                        "total_amount"
                      );
                      setEditedPatterns((prev: any) => ({
                        ...prev,
                        total_amount: pattern,
                      }));
                      setHasChanges(true);
                      setSelectedText("");
                    }}
                  >
                    ✏️ Použít označený text
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {result.totalAmount ? (
                    `${result.totalAmount.toLocaleString("cs-CZ")} Kč`
                  ) : (
                    <span className="text-orange-600">Nenalezeno</span>
                  )}
                </p>
                {editedPatterns.total_amount && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ Nový vzor: {editedPatterns.total_amount}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Způsob platby</CardTitle>
                {selectedText && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const pattern = generateRegexPattern(
                        selectedText,
                        "payment_type"
                      );
                      setEditedPatterns((prev: any) => ({
                        ...prev,
                        payment_type: pattern,
                      }));
                      setHasChanges(true);
                      setSelectedText("");
                    }}
                  >
                    ✏️ Použít označený text
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {result.payment_type || result.paymentType || (
                    <span className="text-orange-600">Nenalezeno</span>
                  )}
                </p>
                {editedPatterns.payment_type && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ Nový vzor: {editedPatterns.payment_type}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* QR Codes Display - Moved next to Celková částka */}
            <Card className="border-purple-200 bg-purple-50/30">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="text-lg">📱</span>
                  QR kódy a čárové kódy
                </CardTitle>
                <CardDescription className="text-xs">
                  Automatická detekce QR kódů, čárových kódů a Data Matrix ze
                  všech stránek
                </CardDescription>
              </CardHeader>
              <CardContent>
                {result.qr_codes && result.qr_codes.length > 0 ? (
                  <div className="space-y-3">
                    {result.qr_codes.map((qr: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-white border border-purple-200 rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-1 rounded">
                              Strana {qr.page}
                            </span>
                            <span className="text-xs text-gray-500">
                              {qr.type === "QRCODE" ? "QR kód" : "Čárový kód"}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                              navigator.clipboard.writeText(qr.data);
                              alert("QR kód zkopírován do schránky!");
                            }}
                          >
                            📋 Kopírovat
                          </Button>
                        </div>
                        <div className="bg-gray-50 p-2 rounded border border-gray-200">
                          <code className="text-xs break-all">{qr.data}</code>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : result.qr_codes !== undefined ? (
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertDescription className="text-sm">
                      ℹ️ Žádné QR kódy ani čárové kódy nebyly nalezeny na této
                      faktuře.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertDescription className="text-sm">
                      ⚠️ QR detekce není dostupná - OCR služba se aktualizuje.
                      <br />
                      <span className="text-xs text-gray-600 mt-1 block">
                        Nahrajte fakturu znovu za chvíli pro aktivaci QR
                        detekce.
                      </span>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Položky and PDF Preview in 1-column layout */}
            <div className="grid grid-cols-1 xl:grid-cols-1 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Položky</CardTitle>
                  {activeTemplate?.config?.patterns?.table_end && (
                    <CardDescription className="text-xs text-orange-600">
                      ⚠️ table_end: "{activeTemplate.config.patterns.table_end}"
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-lg font-semibold">
                      {result.items?.length || 0} položek
                    </p>
                    {result.unmapped_codes > 0 && (
                      <p className="text-sm text-orange-600">
                        {result.unmapped_codes} nenamapovaných kódů
                      </p>
                    )}

                    {/* Always show table_end if it exists (or was just deactivated) */}
                    {(activeTemplate?.config?.patterns?.table_end ||
                      editedPatterns.table_end === null) && (
                      <div
                        className={`p-2 rounded border ${
                          editedPatterns.table_end === null
                            ? "bg-gray-50 border-gray-300"
                            : "bg-blue-50 border-blue-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            {editedPatterns.table_end === null ? (
                              <>
                                <p className="text-xs font-semibold text-gray-600">
                                  🗑️ table_end deaktivován (čeká na uložení):
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  table_end bude odstraněn z konfigurace.
                                  Extrakce poběží až do konce dokumentu.
                                </p>
                                <p className="text-xs text-blue-600 mt-1 font-semibold">
                                  💡 Ideální pro multi-page faktury, kde se
                                  položky opakují na více stránkách
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-xs font-semibold">
                                  ⚙️ table_end aktivní:
                                </p>
                                <code className="text-xs bg-white px-2 py-1 rounded block mt-1">
                                  {activeTemplate?.config?.patterns?.table_end}
                                </code>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Extrakce zastaví při nalezení tohoto textu
                                </p>
                                <p className="text-xs text-orange-600 mt-1 font-semibold">
                                  💡 Pro multi-page: Označte text AFTER všech
                                  položek (např. "Celková částka" nebo
                                  "Zaokrouhlení")
                                </p>
                              </>
                            )}
                          </div>
                          {editedPatterns.table_end !== null &&
                            activeTemplate?.config?.patterns?.table_end && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs shrink-0"
                                onClick={() => {
                                  setEditedPatterns((prev: any) => ({
                                    ...prev,
                                    table_end: null, // Deactivate table_end
                                  }));
                                  setHasChanges(true);
                                }}
                                title="Deaktivovat table_end (pro multi-page faktury)"
                              >
                                🗑️ Deaktivovat
                              </Button>
                            )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Multi-page warning - detect if table seems incomplete */}
                  {result.items &&
                    result.items.length > 0 &&
                    result.items.length < 20 &&
                    activeTemplate?.config?.patterns?.table_end && (
                      <Alert className="mt-2 bg-orange-50 border-orange-200">
                        <AlertDescription className="text-xs">
                          ⚠️{" "}
                          <strong>
                            Extrahováno jen {result.items.length} položek -
                            možná chybí položky z dalších stránek!
                          </strong>
                          <br />
                          <br />
                          <strong>Problém:</strong> table_end "
                          {activeTemplate.config.patterns.table_end}" je
                          pravděpodobně na konci stránky 1.
                          <br />
                          <br />
                          <strong>Řešení A:</strong> Přenastavte table_end na
                          text AFTER všech položek:
                          <ol className="list-decimal list-inside ml-2 mt-1 space-y-1">
                            <li>Scroll v OCR textu úplně dolů</li>
                            <li>
                              Označte text jako "Celková částka" nebo
                              "Zaokrouhlení:"
                            </li>
                            <li>Klikněte "✏️ Nastavit jako konec tabulky"</li>
                          </ol>
                          <br />
                          <strong>Řešení B:</strong> Nebo odeberte table_end
                          úplně:
                          <br />
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 text-xs"
                            onClick={() => {
                              setEditedPatterns((prev: any) => ({
                                ...prev,
                                table_end: null, // Remove table_end
                              }));
                              setHasChanges(true);
                            }}
                          >
                            🗑️ Odstranit table_end vzor
                          </Button>
                        </AlertDescription>
                      </Alert>
                    )}

                  {selectedText && (
                    <div className="mt-2 space-y-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                        onClick={() => {
                          const pattern = generateRegexPattern(
                            selectedText,
                            "table_start"
                          );
                          setEditedPatterns((prev: any) => ({
                            ...prev,
                            table_start: pattern,
                          }));
                          setHasChanges(true);
                          setSelectedText("");
                        }}
                      >
                        ✏️ Nastavit jako začátek tabulky
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                        onClick={() => {
                          const pattern = generateRegexPattern(
                            selectedText,
                            "table_end"
                          );
                          setEditedPatterns((prev: any) => ({
                            ...prev,
                            table_end: pattern,
                          }));
                          setHasChanges(true);
                          setSelectedText("");
                        }}
                      >
                        ✏️ Nastavit jako konec tabulky
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                        onClick={() => {
                          const pattern = generateRegexPattern(
                            selectedText,
                            "ignore_line"
                          );
                          // Get current ignore patterns
                          const currentIgnores =
                            (activeTemplate?.config?.table_columns as any)
                              ?.ignore_patterns || [];

                          // Check if pattern already exists
                          const ignorePatterns = Array.isArray(currentIgnores)
                            ? currentIgnores.includes(pattern)
                              ? currentIgnores
                              : [...currentIgnores, pattern]
                            : currentIgnores
                              ? currentIgnores === pattern
                                ? [currentIgnores]
                                : [currentIgnores, pattern]
                              : [pattern];

                          setEditedPatterns((prev: any) => ({
                            ...prev,
                            ignore_patterns: ignorePatterns,
                          }));
                          setHasChanges(true);
                          setSelectedText("");
                        }}
                      >
                        🚫 Ignorovat tento řádek
                      </Button>
                      {/* Quick add for common patterns */}
                      {selectedText.toLowerCase().includes("šarže") &&
                        selectedText.toLowerCase().includes("počet") &&
                        selectedText.toLowerCase().includes("jednotka") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs bg-orange-50 border-orange-200"
                            onClick={() => {
                              const pattern = "^Šarže\\s+Počet\\s+Jednotka$";
                              const currentIgnores =
                                (activeTemplate?.config?.table_columns as any)
                                  ?.ignore_patterns || [];

                              const ignorePatterns = Array.isArray(
                                currentIgnores
                              )
                                ? currentIgnores.includes(pattern)
                                  ? currentIgnores
                                  : [...currentIgnores, pattern]
                                : [pattern];

                              setEditedPatterns((prev: any) => ({
                                ...prev,
                                ignore_patterns: ignorePatterns,
                              }));
                              setHasChanges(true);
                              setSelectedText("");
                            }}
                          >
                            🚫 Ignorovat: "Šarže Počet Jednotka" (hlavička)
                          </Button>
                        )}
                    </div>
                  )}
                  {(editedPatterns.table_start ||
                    editedPatterns.table_end !== undefined ||
                    editedPatterns.ignore_patterns) && (
                    <div className="text-xs text-green-600 mt-2 space-y-1">
                      {editedPatterns.table_start && (
                        <p>✓ Začátek: {editedPatterns.table_start}</p>
                      )}
                      {editedPatterns.table_end === null && (
                        <p>✓ Konec: (odstraněno pro multi-page)</p>
                      )}
                      {editedPatterns.table_end && (
                        <p>✓ Konec: {editedPatterns.table_end}</p>
                      )}
                      {editedPatterns.ignore_patterns && (
                        <div>
                          <p className="font-semibold">
                            ✓ Ignorované řádky (
                            {editedPatterns.ignore_patterns.length}):
                          </p>
                          <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                            {editedPatterns.ignore_patterns.map(
                              (pattern: string, idx: number) => (
                                <li key={idx}>
                                  <code className="text-xs bg-white px-1 py-0.5 rounded">
                                    {pattern}
                                  </code>
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-sm">Extrahované položky</CardTitle>
                <CardDescription className="text-xs">
                  🔍 Mapování: Kód produktu → ingredient_supplier_codes →
                  surovina
                </CardDescription>
              </div>
              {selectedText && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      // Generate a line pattern from selected text
                      const pattern = generateLineItemPattern(selectedText);
                      setEditedPatterns((prev: any) => ({
                        ...prev,
                        line_pattern: pattern,
                      }));
                      setHasChanges(true);
                      setSelectedText("");
                    }}
                  >
                    ✏️ Použít jako vzor řádku
                  </Button>
                  {result.items && result.items.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // Show column mapping interface
                        setShowColumnMapping(true);
                      }}
                    >
                      🎯 Mapovat sloupce
                    </Button>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {/* Debug: Log items when component renders */}
              {(() => {
                console.log("Extrahované položky - CardContent render:", {
                  hasResult: !!result,
                  hasItems: !!result?.items,
                  itemsCount: result?.items?.length || 0,
                  items: result?.items,
                  resultKeys: result ? Object.keys(result) : [],
                });

                // Log each item individually for debugging
                if (result?.items && result.items.length > 0) {
                  console.log("Extrahované položky - Detailed item breakdown:");
                  result.items.forEach((item: any, idx: number) => {
                    console.log(`Item ${idx + 1}:`, {
                      product_code: item.product_code,
                      description: item.description,
                      description_length: item.description?.length || 0,
                      description_type: typeof item.description,
                      quantity: item.quantity,
                      unit_of_measure: item.unit_of_measure,
                      unit_price: item.unit_price,
                      line_total: item.line_total,
                      vat_rate: item.vat_rate,
                      line_number: item.line_number,
                      allKeys: Object.keys(item),
                      rawItem: item,
                    });
                  });
                }

                return null;
              })()}

              {/* Alert when no items are extracted - need to create line_pattern */}
              {result.items && result.items.length === 0 && (
                <Alert className="mb-4 bg-red-50 border-red-200">
                  <AlertDescription className="text-xs">
                    <strong>⚠️ Nebyly extrahovány žádné položky!</strong>
                    <p className="mt-2 font-semibold">
                      Pravděpodobně chybí nebo je nesprávný{" "}
                      <code className="bg-white px-1 py-0.5 rounded">
                        line_pattern
                      </code>{" "}
                      v konfiguraci šablony.
                    </p>
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                      <li>
                        V sekci <strong>"Raw OCR Text"</strong> níže najděte a{" "}
                        <strong>označte myší jeden celý řádek položky</strong>
                        <br />
                        <code className="text-xs bg-white px-1 py-0.5 mt-1 block">
                          Příklad: "02543250 Kobliha 20 % 25 kg 25 kg 166,000 4
                          150,00 | 12%"
                        </code>
                      </li>
                      <li>
                        Po označení textu se objeví tlačítko{" "}
                        <strong>"✏️ Použít jako vzor řádku"</strong> vpravo
                        nahoře
                      </li>
                      <li>
                        Klikněte na něj - systém automaticky vytvoří regex
                        pattern pro extrakci položek
                      </li>
                      <li>
                        Zobrazí se upravený pattern, klikněte na{" "}
                        <strong>"💾 Uložit změny"</strong> nahoře
                      </li>
                      <li>
                        Znovu nahrajte fakturu pro test extrakce s novým
                        patternem
                      </li>
                    </ol>
                  </AlertDescription>
                </Alert>
              )}
              {editedPatterns.line_pattern && (
                <Alert className="mb-4 bg-green-50 border-green-200">
                  <AlertDescription className="text-xs">
                    <strong>✅ Nový vzor řádku vytvořen:</strong>
                    <div className="mt-2 p-2 bg-white rounded border border-green-200">
                      <code className="text-xs break-all font-mono">
                        {editedPatterns.line_pattern}
                      </code>
                    </div>
                    <p className="mt-2 text-muted-foreground">
                      {editedPatterns.line_pattern.includes("\\n") ? (
                        <>
                          ✓ Multi-řádkový vzor detekován
                          <br />
                          Extrakt: Název (řádek 1) → Kód, Počet MU, Cena (řádek
                          2)
                        </>
                      ) : editedPatterns.line_pattern.includes("\\d{8}") ? (
                        <>
                          ✓ Backaldrin formát detekován (8-místný kód)
                          <br />
                          Formát: KÓD → Název → DPH% → Množství → Jednotka →
                          Cena → Celkem
                        </>
                      ) : (
                        "✓ Jednořádkový vzor: kód produktu, název, množství, jednotka, cena, celkem"
                      )}
                    </p>
                    <p className="mt-2 font-semibold text-green-700">
                      💾 Nezapomeňte kliknout na "Uložit změny" nahoře pro
                      uložení patternu do šablony!
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {/* Check if description looks wrong (contains only numbers) */}
              {result.items &&
                result.items.length > 0 &&
                result.items.some(
                  (item: any) =>
                    item.description && /^\d+$/.test(item.description.trim())
                ) && (
                  <Alert className="mb-4 bg-orange-50 border-orange-200">
                    <AlertDescription className="text-xs">
                      ⚠️ <strong>Popis obsahuje pouze čísla!</strong>
                      <br />
                      Vzor extrakce řádků je pravděpodobně špatný.
                      <br />
                      <strong>Jak opravit:</strong>
                      <ol className="list-decimal list-inside mt-2 space-y-1">
                        <li>
                          Označte v OCR textu OBA řádky položky (popis + data):
                          <br />
                          <code className="text-xs bg-white px-1 py-0.5">
                            sůl jemná 25kg
                            <br />
                            0201 50kg 6,80 12 % 340,00
                          </code>
                        </li>
                        <li>
                          Klikněte na tlačítko "✏️ Použít jako vzor řádku"
                          vpravo nahoře
                        </li>
                        <li>
                          Systém vygeneruje multi-řádkový regex vzor pro správné
                          rozdělení
                        </li>
                      </ol>
                    </AlertDescription>
                  </Alert>
                )}

              {/* Layout based on template configuration */}
              {(() => {
                const layout =
                  activeTemplate?.config?.display_layout || "standard";

                console.log("Extrahované položky - Rendering table:", {
                  layout,
                  itemsCount: result.items?.length || 0,
                  items: result.items,
                  activeTemplate: activeTemplate?.template_name,
                  display_layout: activeTemplate?.config?.display_layout,
                  itemsDetails: result.items?.map((item: any, idx: number) => ({
                    index: idx,
                    product_code: item.product_code,
                    description: item.description,
                    quantity: item.quantity,
                    unit_of_measure: item.unit_of_measure,
                    unit_price: item.unit_price,
                    line_total: item.line_total,
                    vat_rate: item.vat_rate,
                    line_number: item.line_number,
                    matched_ingredient_id: item.matched_ingredient_id,
                    suggested_ingredient_name: item.suggested_ingredient_name,
                  })),
                });

                if (layout === "makro") {
                  return <MakroInvoiceLayout items={result.items} />;
                } else if (layout === "pesek") {
                  return <PesekLineInvoiceLayout items={result.items} />;
                } else if (layout === "zeelandia") {
                  return <ZeelandiaInvoiceLayout items={result.items} />;
                } else {
                  return <PesekLineInvoiceLayout items={result.items} />;
                }
              })()}

              {/* Mapping Statistics */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <Card className="bg-green-50">
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-green-600">
                      {result.items?.filter((i: any) => i.matched_ingredient_id)
                        .length || 0}
                    </div>
                    <div className="text-xs text-gray-600">✓ Namapováno</div>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50">
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-orange-600">
                      {result.items?.filter(
                        (i: any) =>
                          !i.matched_ingredient_id &&
                          i.suggested_ingredient_name
                      ).length || 0}
                    </div>
                    <div className="text-xs text-gray-600">⚠ Navrženo</div>
                  </CardContent>
                </Card>
                <Card className="bg-red-50">
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-red-600">
                      {result.items?.filter(
                        (i: any) =>
                          !i.matched_ingredient_id &&
                          !i.suggested_ingredient_name
                      ).length || 0}
                    </div>
                    <div className="text-xs text-gray-600">✗ Neznámé</div>
                  </CardContent>
                </Card>
              </div>

              {result.unmapped_codes > 0 && (
                <Alert className="mt-6">
                  <AlertDescription>
                    💡 Přejděte na záložku "Nenamapované kódy" pro přiřazení
                    surovin k nenamapovaným kódům pomocí product_code.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </CardContent>
      )}
    </Card>
  );
}

// Helper function to generate regex patterns from selected text
function generateRegexPattern(text: string, mode: string): string {
  // Escape special regex characters
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  switch (mode) {
    case "invoice_number":
      // Extract numbers from the text, but make it more specific
      // Look for longer number sequences (5+ digits) to avoid page numbers
      const numbers = text.match(/\d{5,}/g); // At least 5 digits
      if (numbers) {
        // Replace long numbers with pattern
        return escaped.replace(/\d{5,}/g, "(\\d{5,})");
      }
      // Fallback: look for "Číslo" or "číslo" followed by number
      return escaped.replace(/\d+/g, "(\\d+)");

    case "date":
      // Check if text contains Makro-specific "Čas dodání:" pattern
      if (text.includes("Čas dodání:")) {
        // Create pattern for "Čas dodání: DD.MM.YYYY"
        return escaped.replace(
          /\d{1,2}\.\d{1,2}\.\d{4}/g,
          "(\\d{1,2}\\.\\d{1,2}\\.\\d{4})"
        );
      }
      // Default: Replace date pattern (DD.MM.YYYY or D.M.YYYY)
      return escaped.replace(
        /\d{1,2}\.\d{1,2}\.\d{4}/g,
        "(\\d{1,2}\\.\\d{1,2}\\.\\d{4})"
      );

    case "total_amount":
      // Replace numbers and decimals
      return escaped.replace(/[\d\s,\.]+/g, "([\\d\\s,\\.]+)");

    case "payment_type":
      // Extract the payment type text after the label
      // Example: "Plateb.podmínky Hotově" -> "Plateb\.podmínky\s+([a-zA-Zá-žÁ-Ž]+)"
      // Example: "Způsob platby: Hotově" -> "Způsob platby:\s*([a-zA-Zá-žÁ-Ž]+)"
      // Only captures letters (Czech + English), stops at numbers or special chars
      const words = text.trim().split(/\s+/);
      if (words.length > 1) {
        // Find the label (everything before the last word)
        const labelWords = words.slice(0, -1);

        // Create pattern: Label + capture only letters
        const labelEscaped = labelWords
          .join(" ")
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return `${labelEscaped}\\s*([a-zA-Zá-žÁ-Ž]+)`;
      }
      // Fallback for simple text - capture only word characters
      return escaped.replace(/[a-záčďéěíňóřšťúůýž]+$/gi, "([a-zA-Zá-žÁ-Ž]+)");

    case "table_start":
    case "table_end":
      // Make whitespace flexible
      return escaped.replace(/\s+/g, "\\s+");

    case "ignore_line":
      // For ignore patterns, create a pattern that matches the exact line (with flexible whitespace)
      // Anchor to start and end of line
      let pattern = "^" + escaped.replace(/\s+/g, "\\s+") + "$";

      // Special handling for common patterns:
      // 1. "Šarže Počet Jednotka" - header row pattern
      if (
        text.trim().toLowerCase().includes("šarže") &&
        text.trim().toLowerCase().includes("počet") &&
        text.trim().toLowerCase().includes("jednotka")
      ) {
        // Make it flexible to match variations
        pattern = "^Šarže\\s+Počet\\s+Jednotka$";
      }

      // 2. Batch/date pattern: "02498362 10.07.2026 25 kg" (batch number + date + quantity)
      // Match: 8-digit batch number, date (DD.MM.YYYY), quantity + unit
      if (/^\d{8}\s+\d{1,2}\.\d{1,2}\.\d{4}\s+\d+/.test(text.trim())) {
        // Flexible pattern for batch lines
        pattern =
          "^\\d{8}\\s+\\d{1,2}\\.\\d{1,2}\\.\\d{4}\\s+[\\d,\\.\\s]+[a-zA-Z]+$";
      }

      return pattern;

    default:
      return escaped;
  }
}

// Helper function to generate line item pattern from example line
function generateLineItemPattern(exampleLine: string): string {
  // Example multi-line format:
  // Line 1: "sůl jemná 25kg"
  // Line 2: "0201 50kg 6,80 12 % 340,00"

  // Check if it's a multi-line pattern (contains newline)
  if (exampleLine.includes("\n")) {
    // Multi-line format: description on line 1, data on line 2
    const lines = exampleLine.split("\n").map((l) => l.trim());

    if (lines.length >= 2) {
      // Line 1: Description (anything)
      // Line 2: Code Quantity+Unit Price VAT% Total
      const pattern =
        "^([^\\n]+?)\\s*\\n" + // Description (line 1)
        "\\s*(\\d+)\\s+" + // Product code (flexible length)
        "([\\d,]+)\\s*" + // Quantity (digits only)
        "([a-zA-Z]{1,5})\\s+" + // Unit (letters only: kg, ks, lt, ml, kr, etc)
        "([\\d,\\s]+)\\s+" + // Unit price (allow spaces in numbers)
        "\\d+\\s*%?\\s*\\d*\\s+" + // VAT % (optional % and optional number after)
        "([\\d,\\.\\s]+)"; // Total price (allow spaces and dots)

      return pattern;
    }
  }

  // Check for backaldrin format: "02543250 Kobliha 20 % 25 kg 25 kg 166,000 4 150,00 | 12%"
  // Format: CODE DESCRIPTION (with optional "%" at end of description) QTY1 UNIT1 QTY2 UNIT2 UNIT_PRICE TOTAL | VAT%
  // Note: "20 %" is part of the description, not separate VAT field
  const backaldrinPattern =
    /^(\d{8})\s+([A-Za-zá-žÁ-Ž]+(?:\s+[A-Za-zá-žÁ-Ž]+)*(?:\s+\d+\s*%)?)\s+([\d,]+)\s+([a-zA-Z]{1,5})\s+([\d,]+)\s+([a-zA-Z]{1,5})\s+([\d,\s]+)\s+([\d\s,]+)\s*\|\s*(\d+)%/;

  if (backaldrinPattern.test(exampleLine.trim())) {
    // Backaldrin format - 9 groups: code, description (with optional "20 %"), qty1, unit1, qty2, unit2, unit_price, total, vat_percent
    return "^(\\d{8})\\s+([A-Za-zá-žÁ-Ž]+(?:\\s+[A-Za-zá-žÁ-Ž]+)*(?:\\s+\\d+\\s*%)?)\\s+([\\d,]+)\\s+([a-zA-Z]{1,5})\\s+([\\d,]+)\\s+([a-zA-Z]{1,5})\\s+([\\d,\\s]+)\\s+([\\d\\s,]+)\\s*\\|\\s*(\\d+)%";
  }

  // Single line format fallback
  // Split by multiple spaces or tabs
  const parts = exampleLine.split(/\s{2,}|\t/);

  if (parts.length < 2) {
    // Try to detect pattern based on content
    // Check if line starts with product code (8 digits for backaldrin)
    if (/^\d{8}\s+/.test(exampleLine)) {
      // Backaldrin-like format: CODE DESCRIPTION (with optional "20 %") QTY1 UNIT1 QTY2 UNIT2 UNIT_PRICE TOTAL | VAT%
      // Note: "20 %" is part of description, not separate VAT field
      return "^(\\d{8})\\s+([A-Za-zá-žÁ-Ž]+(?:\\s+[A-Za-zá-žÁ-Ž]+)*(?:\\s+\\d+\\s*%)?)\\s+([\\d,]+)\\s+([a-zA-Z]{1,5})\\s+([\\d,]+)\\s+([a-zA-Z]{1,5})\\s+([\\d,\\s]+)\\s+([\\d\\s,]+)\\s*\\|\\s*(\\d+)%";
    }

    // Fallback: Try to identify components
    // Typical format: [description] [code] [quantity][unit] [price] [total]
    const pattern =
      "^([\\w\\s-]+?)\\s+(\\d+)\\s+([\\d,]+)(\\w+)\\s+([\\d,]+)\\s+.*?([\\d,]+)$";
    return pattern;
  }

  // Build pattern based on detected structure
  let pattern = "^";

  // First part is usually description (letters, spaces, numbers)
  pattern += "([\\w\\s-]+?)\\s+";

  // Product code (flexible length)
  pattern += "(\\d+)\\s+";

  // Quantity and unit (e.g., "50kg")
  pattern += "([\\d,]+)(\\w+)\\s+";

  // Unit price
  pattern += "([\\d,]+)\\s+";

  // Skip DPH percentage and capture total
  pattern += ".*?([\\d,]+)$";

  return pattern;
}

// Generate pattern from column mappings using highlighted text positions
function generatePatternFromMappings(mappings: any) {
  // Analyze all mapped values to create intelligent patterns
  const columnGroups: { [columnType: string]: string[] } = {};

  // Group all mappings by column type
  Object.entries(mappings).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim()) {
      const columnType = key.replace(/^row_\d+_/, "");
      if (!columnGroups[columnType]) {
        columnGroups[columnType] = [];
      }
      columnGroups[columnType].push(value.trim());
    }
  });

  // Use the highlighted mappings to create the pattern
  // If we have mappings, use them; otherwise fall back to default pattern
  if (Object.keys(columnGroups).length > 0) {
    // Create pattern based on actual highlighted values
    const createPatternFromMappings = (
      columnType: string,
      values: string[]
    ) => {
      if (values.length === 0) {
        // Default patterns if no data
        switch (columnType) {
          case "code":
            return "(\\d{7})";
          case "description":
            return "([A-Za-zá-žÁ-Ž]+(?:\\s+[A-Za-zá-žÁ-Ž]+)*(?:\\s+\\d+[a-zA-Z]+)?)";
          case "quantity":
            return "(\\d+)";
          case "unit":
            return "(BAG|BKT|PCE|KG)";
          case "obsah":
            return "([\\d,\\s]+)";
          case "fakt_mn":
            return "([\\d,\\s]+)";
          case "unit_price":
            return "([\\d,\\s]+)";
          case "total_price":
            return "([\\d,\\s]+)";
          case "currency":
            return "([A-Z]+)";
          case "vat_rate":
            return "(\\d+)%";
          default:
            return "(.+?)";
        }
      }

      // Use the actual highlighted values to create patterns
      const uniqueValues = [...new Set(values)];

      if (columnType === "total_price") {
        // For total_price, use a pattern that handles Czech numbers with currency
        // This ensures Czech numbers with spaces are captured correctly
        // Pattern: digits, optional space, more digits, comma, two digits, optional currency
        // Examples: "768,00" or "7 579,00" or "1575,00CZK"
        return "([\\d]+\\s*[\\d]*,\\d{2}[A-Z]*)";
      } else if (columnType === "unit") {
        // Use all observed unit values
        const unitValues = uniqueValues
          .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("|");
        return `(${unitValues})`;
      } else if (columnType === "currency") {
        // Use all observed currency values
        const currencyValues = uniqueValues
          .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("|");
        return `(${currencyValues})`;
      } else if (["obsah", "fakt_mn", "unit_price"].includes(columnType)) {
        // Czech number format for other price fields
        return "([\\d,\\s]+)";
      } else if (columnType === "code") {
        return "(\\d{7})";
      } else if (columnType === "description") {
        return "([A-Za-zá-žÁ-Ž]+(?:\\s+[A-Za-zá-žÁ-Ž]+)*(?:\\s+\\d+[a-zA-Z]+)?)";
      } else if (columnType === "quantity") {
        return "(\\d+)";
      } else if (columnType === "vat_rate") {
        return "(\\d+)%";
      }

      return "(.+?)";
    };

    // Build pattern using the highlighted mappings
    const columnOrder = [
      "code",
      "description",
      "quantity",
      "unit",
      "obsah",
      "unit",
      "fakt_mn",
      "unit",
      "unit_price",
      "total_price",
      "currency",
      "vat_rate",
    ];

    const patternParts = columnOrder.map((column) => {
      return createPatternFromMappings(column, columnGroups[column] || []);
    });

    return `^${patternParts.join("\\s+")}`;
  }

  // Fallback to default pattern if no mappings
  const patternParts = [
    "(\\d{7})", // Code: 7 digits
    "([A-Za-zá-žÁ-Ž]+(?:\\s+[A-Za-zá-žÁ-Ž]+)*(?:\\s+\\d+[a-zA-Z]+)?)", // Description: letters + optional weight (e.g. "Bolognese 5kg")
    "(\\d+)", // Quantity: number
    "(BAG|BKT|PCE)", // Unit: specific values
    "([\\d,\\s]+)", // Obsah: Czech number format
    "(KG|PCE)", // Obsah unit: specific values
    "([\\d,\\s]+)", // Fakt.mn: Czech number format
    "(KG|PCE)", // Fakt.mn unit: specific values
    "([\\d,\\s]+)", // Unit price: Czech number format
    "([\\d]+\\s*[\\d]*,\\d{2}[A-Z]*)", // Total price: Czech number format (with spaces for thousands)
    "([A-Z]+)", // Currency: uppercase letters
    "(\\d+)%", // VAT rate: number with %
  ];

  return `^${patternParts.join("\\s+")}`;
}

// Highlight mapped text in OCR
function highlightMappedText(text: string, mappings: any) {
  if (!mappings || Object.keys(mappings).length === 0) {
    return text;
  }

  let highlightedText = text;
  const colors = {
    code: "bg-blue-200 border border-blue-300",
    description: "bg-green-200 border border-green-300",
    quantity: "bg-yellow-200 border border-yellow-300",
    unit: "bg-purple-200 border border-purple-300",
    obsah: "bg-orange-200 border border-orange-300",
    fakt_mn: "bg-pink-200 border border-pink-300",
    unit_price: "bg-indigo-200 border border-indigo-300",
    total_price: "bg-red-200 border border-red-300",
    vat_rate: "bg-teal-200 border border-teal-300",
  };

  // Group mappings by column type to handle multiple rows
  const columnGroups: { [columnType: string]: string[] } = {};

  Object.entries(mappings).forEach(([key, mappedText]) => {
    if (!mappedText || typeof mappedText !== "string") return;

    const columnType = key.replace(/^row_\d+_/, "");
    if (!columnGroups[columnType]) {
      columnGroups[columnType] = [];
    }
    columnGroups[columnType].push(mappedText);
  });

  // Process each column type
  Object.entries(columnGroups).forEach(([columnType, values]) => {
    const color =
      colors[columnType as keyof typeof colors] ||
      "bg-gray-200 border border-gray-300";
    const label = `[${columnType}]`;

    // Remove duplicates and sort by length (longest first to avoid partial matches)
    const uniqueValues = [...new Set(values)].sort(
      (a, b) => b.length - a.length
    );

    uniqueValues.forEach((mappedText) => {
      // Create a more specific regex that considers context
      let regex;
      if (columnType === "quantity") {
        // For quantity, look for numbers that are likely quantities
        regex = new RegExp(
          `\\b${mappedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b(?=\\s*(BAG|BKT|PCE|KG|ks|kg|g|ml|l|lt)?\\s|$)`,
          "g"
        );
      } else if (columnType === "code") {
        // For codes, match the exact pattern
        regex = new RegExp(
          `\\b${mappedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "g"
        );
      } else if (columnType === "total_price") {
        // For total prices, be more specific to avoid matching other numbers
        // Look for numbers that are likely prices (with commas, spaces, etc.)
        // Handle cases where currency is directly attached (e.g., "1575,00CZK")
        // or separated by space (e.g., "7 579,00 CZ")
        const escapedText = mappedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        // Try multiple patterns to catch different formats
        const patterns = [
          `\\b${escapedText}(?=\\s+[A-Z]|\\s*$|$)`, // Space before currency or end
          `\\b${escapedText}(?=[A-Z]|$)`, // Direct currency or end
          `\\b${escapedText}\\b`, // Word boundary fallback
        ];

        // Use the first pattern that matches
        for (const pattern of patterns) {
          const testRegex = new RegExp(pattern, "g");
          if (testRegex.test(text)) {
            regex = testRegex;
            break;
          }
        }

        // Fallback to the most permissive pattern
        if (!regex) {
          regex = new RegExp(`\\b${escapedText}\\b`, "g");
        }
      } else {
        // For other fields, use word boundaries
        regex = new RegExp(
          `\\b${mappedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "g"
        );
      }

      // Only replace if the text hasn't been highlighted already
      if (!highlightedText.includes(`${mappedText}[${columnType}]`)) {
        highlightedText = highlightedText.replace(
          regex,
          `<span class="${color} px-1 rounded text-xs font-semibold" title="${columnType}">${mappedText}${label}</span>`
        );
      }
    });
  });

  return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />;
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
