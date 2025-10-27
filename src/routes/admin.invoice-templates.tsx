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
import { FileText, Code2, BookOpen, Upload, RotateCcw } from "lucide-react";
import { useState, useEffect } from "react";
import { useDocumentAI } from "@/hooks/useDocumentAI";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useInvoiceTemplates } from "@/hooks/useInvoiceTemplates";

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

        {result && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                ✅ Faktura úspěšně zpracována!
              </AlertDescription>
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
                        👆 Klikněte na tlačítko "✏️ Použít označený text" u
                        pole, které chcete aktualizovat
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
                      <CardTitle className="text-sm">Náhled faktury</CardTitle>
                      <CardDescription className="text-xs">
                        {pdfUrl &&
                          "Označte text v PDF a použijte tlačítka v kartách vpravo"}
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
                          📄 PDF soubor: {uploadedFile.name}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Raw OCR Text</CardTitle>
                      <CardDescription className="text-xs">
                        Vyberte text myší a použijte tlačítka výše
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
                            {result.raw_text}
                          </pre>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          OCR text není k dispozici
                        </div>
                      )}
                    </CardContent>
                  </Card>
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

                        // Separate line_pattern and table_end from other patterns
                        const { line_pattern, table_end, ...otherPatterns } =
                          editedPatterns;

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

                        const updatedConfig = {
                          ...activeTemplate.config,
                          patterns: updatedPatterns,
                          // Add line_pattern to table_columns if it exists
                          ...(line_pattern && {
                            table_columns: {
                              ...activeTemplate.config.table_columns,
                              line_pattern: line_pattern,
                            },
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
                        dokladu 2531898") a klikněte na "✏️ Použít označený
                        text"
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

                    {/* Always show table_end if it exists */}
                    {activeTemplate?.config?.patterns?.table_end && (
                      <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                        <p className="text-xs font-semibold">
                          ⚙️ table_end aktivní:
                        </p>
                        <code className="text-xs bg-white px-2 py-1 rounded block mt-1">
                          {activeTemplate.config.patterns.table_end}
                        </code>
                        <p className="text-xs text-muted-foreground mt-1">
                          Extrakce zastaví při nalezení tohoto textu
                        </p>
                        <p className="text-xs text-orange-600 mt-1 font-semibold">
                          💡 Pro multi-page: Označte text AFTER všech položek
                          (např. "Celková částka" nebo "Zaokrouhlení")
                        </p>
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
                    </div>
                  )}
                  {(editedPatterns.table_start ||
                    editedPatterns.table_end !== undefined) && (
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
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* QR Codes Display */}
            {result.qr_codes && result.qr_codes.length > 0 && (
              <Card className="border-purple-200 bg-purple-50/30">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="text-lg">📱</span>
                    QR kódy nalezené ve faktuře
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Automaticky detekovány a dekódovány ze všech stránek
                    dokumentu
                  </CardDescription>
                </CardHeader>
                <CardContent>
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
                              Typ: {qr.type}
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
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-sm">Extrahované položky</CardTitle>
                  <CardDescription className="text-xs">
                    🔍 Mapování: Kód produktu → ingredient_supplier_codes →
                    surovina
                  </CardDescription>
                </div>
                {selectedText && result.items && result.items.length > 0 && (
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
                )}
              </CardHeader>
              <CardContent>
                {editedPatterns.line_pattern && (
                  <Alert className="mb-4 bg-yellow-50">
                    <AlertDescription className="text-xs">
                      <strong>⚠️ Upravený vzor řádku:</strong>
                      <br />
                      <code className="text-xs bg-white px-2 py-1 rounded mt-1 inline-block break-all">
                        {editedPatterns.line_pattern}
                      </code>
                      <p className="mt-2 text-muted-foreground">
                        {editedPatterns.line_pattern.includes("\\n") ? (
                          <>
                            ✓ Multi-řádkový vzor detekován
                            <br />
                            Extrakt: Název (řádek 1) → Kód, Počet MU, Cena
                            (řádek 2)
                          </>
                        ) : (
                          "Jednoř. vzor: číslo zboží, počet MU, název zboží, zákl. cena, jedn. v MU, cena za MU, cena celkem"
                        )}
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
                            Označte v OCR textu OBA řádky položky (popis +
                            data):
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
                            Systém vygeneruje multi-řádkový regex vzor pro
                            správné rozdělení
                          </li>
                        </ol>
                      </AlertDescription>
                    </Alert>
                  )}

                {/* Layout based on template configuration */}
                {(() => {
                  const layout =
                    activeTemplate?.config?.display_layout || "standard";

                  if (layout === "makro") {
                    return (
                      <div className="overflow-x-auto border rounded-md">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-gray-50">
                              <th className="text-left p-2 text-xs">
                                číslo zboží
                              </th>
                              <th className="text-right p-2 text-xs">
                                počet MU
                              </th>
                              <th className="text-left p-2 text-xs">
                                název zboží
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
                            </tr>
                          </thead>
                          <tbody>
                            {result.items?.map((item: any, idx: number) => {
                              const priceTotal =
                                item.line_total ||
                                item.quantity * item.unit_price ||
                                0;

                              return (
                                <tr
                                  key={idx}
                                  className="border-b hover:bg-gray-50"
                                >
                                  {/* číslo zboží */}
                                  <td className="p-2">
                                    <code className="text-xs bg-blue-100 px-1 py-0.5 rounded font-mono">
                                      {item.product_code || "???"}
                                    </code>
                                  </td>
                                  {/* počet MU */}
                                  <td className="p-2 text-right text-xs font-semibold">
                                    {item.description?.startsWith("*") ? (
                                      <span className="text-purple-600">
                                        {item.total_weight_kg?.toLocaleString(
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
                                    {item.description || "-"}
                                  </td>
                                  {/* hmot. bal. (package weight) */}
                                  <td className="p-2 text-right text-xs text-blue-600">
                                    {item.package_weight_kg
                                      ? `${(
                                          item.package_weight_kg * 1000
                                        ).toLocaleString("cs-CZ", {
                                          maximumFractionDigits: 0,
                                        })} g`
                                      : "-"}
                                  </td>
                                  {/* celk. hmot. (total weight) */}
                                  <td className="p-2 text-right text-xs text-green-600 font-medium">
                                    {item.total_weight_kg
                                      ? `${item.total_weight_kg.toLocaleString(
                                          "cs-CZ",
                                          {
                                            minimumFractionDigits: 3,
                                            maximumFractionDigits: 3,
                                          }
                                        )} kg`
                                      : "-"}
                                  </td>
                                  {/* zákl. cena (base price per package OR price per kg for * items) */}
                                  <td className="p-2 text-right text-xs">
                                    {item.base_price ? (
                                      <span
                                        className={
                                          item.description?.startsWith("*")
                                            ? "text-purple-600 font-medium"
                                            : ""
                                        }
                                      >
                                        {item.base_price.toLocaleString(
                                          "cs-CZ",
                                          {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          }
                                        )}
                                        {item.description?.startsWith("*") &&
                                          " /kg"}
                                      </span>
                                    ) : (
                                      "-"
                                    )}
                                  </td>
                                  {/* jedn. v MU (units in MU) */}
                                  <td className="p-2 text-right text-xs">
                                    {item.units_in_mu || "1"}
                                  </td>
                                  {/* cena za MU (price per MU) */}
                                  <td className="p-2 text-right text-xs">
                                    {item.unit_price?.toLocaleString("cs-CZ", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </td>
                                  {/* cena celkem */}
                                  <td className="p-2 text-right text-xs font-semibold">
                                    {priceTotal.toLocaleString("cs-CZ", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </td>
                                  {/* Cena/kg (calculated) */}
                                  <td className="p-2 text-right text-xs bg-orange-50">
                                    {item.price_per_kg ? (
                                      <span className="text-orange-600 font-bold">
                                        {item.price_per_kg.toLocaleString(
                                          "cs-CZ",
                                          {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          }
                                        )}{" "}
                                        Kč/kg
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  } else if (layout === "two-line") {
                    /* Two-line layout for Pešek-Rambousek */
                    return (
                      <div className="overflow-x-auto border border-gray-300 rounded-lg">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b-2 border-gray-300">
                              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
                                Kód
                              </th>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
                                Název položky
                              </th>
                              <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
                                Množství
                              </th>
                              <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
                                Jedn. cena
                              </th>
                              <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
                                Celkem bez DPH
                              </th>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">
                                Namapováno
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            {result.items?.map((item: any, idx: number) => {
                              const priceTotal =
                                item.line_total ||
                                item.quantity * item.unit_price ||
                                0;

                              return (
                                <tr
                                  key={idx}
                                  className={`border-b border-gray-200 hover:bg-gray-50 ${
                                    item.matched_ingredient_id
                                      ? ""
                                      : item.suggested_ingredient_name
                                        ? "bg-orange-50/30"
                                        : "bg-red-50/30"
                                  }`}
                                >
                                  <td className="px-3 py-2 border-r border-gray-200">
                                    <code className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">
                                      {item.product_code || "???"}
                                    </code>
                                  </td>
                                  <td className="px-3 py-2 text-sm text-gray-900 border-r border-gray-200">
                                    {item.description || "-"}
                                  </td>
                                  <td className="px-3 py-2 text-right text-sm text-gray-900 border-r border-gray-200">
                                    {item.quantity.toLocaleString("cs-CZ")}{" "}
                                    <span className="text-gray-500 text-xs">
                                      {item.unit_of_measure}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right text-sm text-gray-700 border-r border-gray-200">
                                    {item.unit_price?.toLocaleString("cs-CZ", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </td>
                                  <td className="px-3 py-2 text-right text-sm font-medium text-gray-900 border-r border-gray-200">
                                    {priceTotal.toLocaleString("cs-CZ", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </td>
                                  <td className="px-3 py-2 text-sm">
                                    {item.matched_ingredient_id ? (
                                      <div className="flex items-center gap-1 text-green-700">
                                        <span className="text-sm">✓</span>
                                        {item.matched_ingredient_name}
                                      </div>
                                    ) : item.suggested_ingredient_name ? (
                                      <div className="flex items-center gap-1 text-orange-600">
                                        <span className="text-sm">⚠</span>
                                        {item.suggested_ingredient_name}
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1 text-red-600">
                                        <span className="text-sm">✗</span>
                                        Neznámý kód
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  } else {
                    /* Standard table layout */
                    return (
                      <div className="overflow-x-auto border border-gray-300 rounded-lg">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b-2 border-gray-300">
                              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
                                Kód
                              </th>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
                                Název položky
                              </th>
                              <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
                                Množství
                              </th>
                              <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
                                Jedn. cena
                              </th>
                              <th className="text-right px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
                                Celkem
                              </th>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-700">
                                Namapováno
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            {result.items?.map((item: any, idx: number) => {
                              const priceTotal =
                                item.line_total ||
                                item.quantity * item.unit_price ||
                                0;

                              return (
                                <tr
                                  key={idx}
                                  className={`border-b border-gray-200 hover:bg-gray-50 ${
                                    item.matched_ingredient_id
                                      ? ""
                                      : item.suggested_ingredient_name
                                        ? "bg-orange-50/30"
                                        : "bg-red-50/30"
                                  }`}
                                >
                                  <td className="px-3 py-2 border-r border-gray-200">
                                    <code className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">
                                      {item.product_code || "???"}
                                    </code>
                                  </td>
                                  <td className="px-3 py-2 text-sm text-gray-900 border-r border-gray-200">
                                    {item.description || "-"}
                                  </td>
                                  <td className="px-3 py-2 text-right text-sm text-gray-900 border-r border-gray-200">
                                    {item.quantity.toLocaleString("cs-CZ")}{" "}
                                    <span className="text-gray-500 text-xs">
                                      {item.unit_of_measure}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right text-sm text-gray-700 border-r border-gray-200">
                                    {item.unit_price?.toLocaleString("cs-CZ", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </td>
                                  <td className="px-3 py-2 text-right text-sm font-medium text-gray-900 border-r border-gray-200">
                                    {priceTotal.toLocaleString("cs-CZ", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </td>
                                  <td className="px-3 py-2 text-sm">
                                    {item.matched_ingredient_id ? (
                                      <div className="flex items-center gap-1 text-green-700">
                                        <span className="text-sm">✓</span>
                                        {item.matched_ingredient_name}
                                      </div>
                                    ) : item.suggested_ingredient_name ? (
                                      <div className="flex items-center gap-1 text-orange-600">
                                        <span className="text-sm">⚠</span>
                                        {item.suggested_ingredient_name}
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1 text-red-600">
                                        <span className="text-sm">✗</span>
                                        Neznámý kód
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  }
                })()}
              </CardContent>
            </Card>

            {/* Mapping Statistics */}
            <div className="grid grid-cols-3 gap-4">
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
                        !i.matched_ingredient_id && i.suggested_ingredient_name
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
                        !i.matched_ingredient_id && !i.suggested_ingredient_name
                    ).length || 0}
                  </div>
                  <div className="text-xs text-gray-600">✗ Neznámé</div>
                </CardContent>
              </Card>
            </div>

            {result.unmapped_codes > 0 && (
              <Alert>
                <AlertDescription>
                  💡 Přejděte na záložku "Nenamapované kódy" pro přiřazení
                  surovin k nenamapovaným kódům pomocí product_code.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
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
      // Replace date pattern (DD.MM.YYYY or D.M.YYYY)
      return escaped.replace(
        /\d{1,2}\.\d{1,2}\.\d{4}/g,
        "(\\d{1,2}\\.\\d{1,2}\\.\\d{4})"
      );

    case "total_amount":
      // Replace numbers and decimals
      return escaped.replace(/[\d\s,\.]+/g, "([\\d\\s,\\.]+)");

    case "table_start":
    case "table_end":
      // Make whitespace flexible
      return escaped.replace(/\s+/g, "\\s+");

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

  // Single line format fallback
  // Split by multiple spaces or tabs
  const parts = exampleLine.split(/\s{2,}|\t/);

  if (parts.length < 2) {
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
