import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useDocumentAI } from "@/hooks/useDocumentAI";
import { TestTube, AlertCircle, CheckCircle } from "lucide-react";

export function DocumentAIDebug() {
  const { processDocument, isProcessing } = useDocumentAI();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [supplierId, setSupplierId] = useState("pesek-rambousek");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
      setError(null);
    }
  };

  const handleTestParser = async () => {
    if (!selectedFile) {
      setError("Prosím vyberte soubor k testování");
      return;
    }

    setTestStatus("testing");
    setError(null);
    setResult(null);

    try {
      console.log(`Testing Document AI parser for supplier: ${supplierId}`);
      console.log(
        `File: ${selectedFile.name}, Size: ${selectedFile.size} bytes, Type: ${selectedFile.type}`
      );

      const response = await processDocument(selectedFile, supplierId);

      if (response.success) {
        setResult(response.data);
        setTestStatus("success");
        console.log("Document AI processing successful:", response.data);
      } else {
        setError(response.error || "Neznámá chyba při zpracování");
        setTestStatus("error");
        console.error("Document AI processing failed:", response.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Neznámá chyba";
      setError(errorMessage);
      setTestStatus("error");
      console.error("Document AI test error:", err);
    }
  };

  const getStatusIcon = () => {
    switch (testStatus) {
      case "testing":
        return <TestTube className="h-4 w-4 animate-spin" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <TestTube className="h-4 w-4" />;
    }
  };

  const getStatusText = () => {
    switch (testStatus) {
      case "testing":
        return "Testování parseru...";
      case "success":
        return "Parser funguje správně";
      case "error":
        return "Chyba parseru";
      default:
        return "Připraveno k testování";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Debug Document AI Parser
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Supplier Selection */}
          <div>
            <Label htmlFor="supplier-select">Dodavatel</Label>
            <select
              id="supplier-select"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full p-2 border rounded-md"
            >
              <option value="pesek-rambousek">
                Pešek - Rambousek (bakery_aplica_parser)
              </option>
              <option value="default">Default Parser</option>
            </select>
          </div>

          {/* File Upload */}
          <div>
            <Label htmlFor="file-upload">Testovací soubor</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="mt-1"
            />
            {selectedFile && (
              <div className="mt-2 text-sm text-gray-600">
                <strong>Soubor:</strong> {selectedFile.name} (
                {Math.round(selectedFile.size / 1024)} KB)
              </div>
            )}
          </div>

          {/* Test Button */}
          <Button
            onClick={handleTestParser}
            disabled={!selectedFile || isProcessing}
            className="w-full"
          >
            {getStatusIcon()}
            <span className="ml-2">{getStatusText()}</span>
          </Button>

          {/* Status */}
          {testStatus !== "idle" && (
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span
                className={
                  testStatus === "success"
                    ? "text-green-600"
                    : testStatus === "error"
                      ? "text-red-600"
                      : ""
                }
              >
                {getStatusText()}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Chyba
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Result Display */}
      {result && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Výsledek zpracování
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Dodavatel</Label>
                <p className="font-semibold">{result.supplier}</p>
              </div>
              <div>
                <Label>Číslo faktury</Label>
                <p className="font-semibold">{result.invoiceNumber}</p>
              </div>
              <div>
                <Label>Datum</Label>
                <p className="font-semibold">{result.date}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Celková částka</Label>
                <p className="text-lg font-bold">
                  {result.totalAmount?.toFixed(2)} Kč
                </p>
              </div>
              <div>
                <Label>Spolehlivost</Label>
                <Badge
                  variant={result.confidence > 0.8 ? "default" : "destructive"}
                >
                  {(result.confidence * 100).toFixed(1)}%
                </Badge>
              </div>
            </div>

            {/* Items */}
            {result.items && result.items.length > 0 && (
              <div>
                <Label>Položky faktury ({result.items.length})</Label>
                <div className="mt-2 space-y-2">
                  {result.items.map((item: any, index: number) => (
                    <div key={index} className="p-3 bg-white rounded border">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-sm text-gray-600">
                            {item.quantity} {item.unit} ×{" "}
                            {item.price?.toFixed(2)} Kč ={" "}
                            {item.total?.toFixed(2)} Kč
                          </p>
                          {item.supplierCode && (
                            <p className="text-xs text-gray-500">
                              Kód: {item.supplierCode}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant={
                            item.confidence > 0.8 ? "default" : "destructive"
                          }
                        >
                          {(item.confidence * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw JSON */}
            <div>
              <Label>Raw JSON Response</Label>
              <Textarea
                value={JSON.stringify(result, null, 2)}
                readOnly
                className="mt-1 font-mono text-xs"
                rows={10}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
