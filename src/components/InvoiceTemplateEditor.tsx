import { useState, useEffect } from "react";
import {
  useInvoiceTemplates,
  type InvoiceTemplate,
} from "@/hooks/useInvoiceTemplates";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Edit, Copy, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InvoiceTemplateEditorProps {
  supplierId: string;
}

export function InvoiceTemplateEditor({
  supplierId,
}: InvoiceTemplateEditorProps) {
  const { templates, isLoading, createTemplate, updateTemplate, toggleActive } =
    useInvoiceTemplates(supplierId);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<InvoiceTemplate | null>(null);

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (template: InvoiceTemplate) => {
    setEditingTemplate(template);
    setIsDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("cs-CZ");
  };

  if (isLoading) {
    return <div className="p-4">Načítání...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Šablony faktur</CardTitle>
            <CardDescription>
              Spravujte šablony pro automatické zpracování faktur
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                Nová šablona
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? "Upravit šablonu" : "Nová šablona faktury"}
                </DialogTitle>
                <DialogDescription>
                  Vytvořte šablonu pro automatické zpracování faktur od
                  dodavatele
                </DialogDescription>
              </DialogHeader>
              <TemplateForm
                key={editingTemplate?.id || "new"}
                supplierId={supplierId}
                template={editingTemplate}
                onSave={(template) => {
                  if (editingTemplate) {
                    updateTemplate({
                      id: editingTemplate.id,
                      updates: template,
                    });
                  } else {
                    createTemplate(template);
                  }
                  setIsDialogOpen(false);
                }}
                onCancel={() => setIsDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              Žádné šablony nenalezeny. Vytvořte první šablonu pro automatické
              zpracování faktur.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Název</TableHead>
                  <TableHead>Verze</TableHead>
                  <TableHead>Aktivní</TableHead>
                  <TableHead className="text-right">Úspěšnost</TableHead>
                  <TableHead className="text-right">Použití</TableHead>
                  <TableHead>Naposledy použito</TableHead>
                  <TableHead className="text-right">Akce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">
                      {template.template_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">v{template.version}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={template.is_active}
                        onCheckedChange={(checked) =>
                          toggleActive({ id: template.id, isActive: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {template.success_rate > 0 ? (
                        <Badge
                          variant={
                            template.success_rate >= 80
                              ? "default"
                              : template.success_rate >= 60
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {template.success_rate.toFixed(0)}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {template.usage_count}×
                    </TableCell>
                    <TableCell>
                      {template.last_used_at
                        ? formatDate(template.last_used_at)
                        : "Nikdy"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(template)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const newTemplate = {
                              ...template,
                              template_name: `${template.template_name} (kopie)`,
                              is_active: false,
                            };
                            delete (newTemplate as any).id;
                            delete (newTemplate as any).created_at;
                            delete (newTemplate as any).updated_at;
                            createTemplate(newTemplate);
                          }}
                        >
                          <Copy className="h-4 w-4" />
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
  );
}

interface TemplateFormProps {
  supplierId: string;
  template: InvoiceTemplate | null;
  onSave: (template: any) => void;
  onCancel: () => void;
}

function TemplateForm({
  supplierId,
  template,
  onSave,
  onCancel,
}: TemplateFormProps) {
  const [formData, setFormData] = useState({
    template_name: template?.template_name || "",
    version: template?.version || "1.0",
    is_active: template?.is_active ?? true,
    display_layout: template?.config?.display_layout || "standard",
    config: JSON.stringify(
      template?.config || {
        ocr_settings: {
          dpi: 300,
          language: "ces",
          psm: 6,
        },
        patterns: {
          invoice_number: "Číslo dokladu\\s+(\\d+)",
          date: "Datum uskutečnění plnění:\\s*(\\d{1,2}\\.\\d{1,2}\\.\\d{4})",
          total_amount: "Celková částka[^:]*:\\s*([\\d\\s,]+)",
          payment_type: "Způsob platby:\\s*([a-zA-Zá-žÁ-Ž]+)",
          table_start: "Označení dodávky",
        },
        table_columns: {
          // CHOOSE ONE PATTERN BELOW BASED ON YOUR SUPPLIER'S FORMAT:

          // ========== PATTERN A: Pešek-Rambousek (multi-line) ==========
          // Format: Description \n Code Quantity+Unit Price VAT% Total
          // line_pattern: "^([^\\n]+?)\\s*\\n\\s*(\\d+)\\s+([\\d,]+)\\s*([a-zA-Z]{1,5})\\s+([\\d,\\s]+)\\s+\\d+\\s*%?\\s*\\d*\\s+([\\d,\\.\\s]+)"

          // ========== PATTERN B: Tab-separated with package quantity ==========
          // Format: CODE \t PACKAGE_QTY NAME WEIGHT \t PRICE ... \t VAT_AMOUNT
          // Example: "486510\t1,000 BORŮVKY KANADSKÉ VAN. 125g\t53.7 1 53,70 53,70 12,0\t6,44"
          // line_pattern: "^(\\d+)\\s+([\\d,]+)\\s+(.+?)\\s+(\\d+[a-zA-Z]+)\\s+([\\d,]+)"

          // ========== PATTERN C: Zeelandia (single-line) ==========
          // Format: CODE Description Quantity+Unit Obsah Fakt.mn UnitPrice TotalPrice Currency VAT%
          // Example: "10000891 ON Hruška gel 1kg 12 BAG 1,00 KG 12,00 KG 64,00 768,00 CZ 2%"
          // Captures: code, description, quantity, unit(BAG/BKT/PCE), obsah, obsah_unit, fakt_mn, fakt_mn_unit, unit_price, total_price, currency, vat_rate
          line_pattern:
            "^(\\d{7})\\s+([^\\d]+?\\d*[a-zA-Z]*)\\s+(\\d+)\\s+(BAG|BKT|PCE)\\s+([\\d,]+)\\s+(KG|PCE)\\s+([\\d,]+)\\s+(KG|PCE)\\s+([\\d,]+)\\s+([\\d,]+)\\s+([A-Z]+)\\s+(\\d+)%",

          // Column mapping for PATTERN B:
          // group 1: product_code (486510)
          // group 2: package_quantity (1,000) - will be used as quantity
          // group 3: description (BORŮVKY KANADSKÉ VAN.)
          // group 4: package_weight (125g) - can be appended to description
          // group 5: unit_price (53.7 - first number in price data)

          // NOTE: Modify line_pattern in "✏️ Použít jako vzor řádku" for your format!

          // ========== CODE CORRECTIONS (for OCR errors) ==========
          // Fix common OCR misreads in product codes
          // Example for Zeelandia: OCR reads "0000891" but should be "10000891"
          code_corrections: {
            replace_pattern: [
              {
                pattern: "^(\\d{7})$",
                replacement: "1\\1",
              },
            ],
          },
          // ========== DESCRIPTION CORRECTIONS (for OCR errors) ==========
          // Fix common OCR misreads in descriptions
          // Example for Zeelandia: OCR reads "Tikg" but should be "11kg"
          description_corrections: {
            replace_pattern: [
              {
                pattern: "Tikg",
                replacement: "11kg",
              },
              {
                pattern: "Rosette 1 ",
                replacement: "Rosette 1l ",
              },
            ],
          },
        },
      },
      null,
      2
    ),
  });

  const [configError, setConfigError] = useState<string | null>(null);

  // Update form data when template changes
  useEffect(() => {
    if (template) {
      console.log(
        "Template changed, updating form with display_layout:",
        template.config?.display_layout
      );
      setFormData({
        template_name: template.template_name,
        version: template.version,
        is_active: template.is_active,
        display_layout: template.config?.display_layout || "standard",
        config: JSON.stringify(template.config, null, 2),
      });
    }
  }, [template]);

  const handleConfigChange = (value: string) => {
    setFormData({ ...formData, config: value });
    try {
      JSON.parse(value);
      setConfigError(null);
    } catch (e) {
      setConfigError("Neplatný JSON formát");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const config = JSON.parse(formData.config);
      // Merge display_layout into config
      config.display_layout = formData.display_layout;

      console.log(
        "Saving template with display_layout:",
        formData.display_layout
      );
      console.log("Config being saved:", config);

      onSave({
        supplier_id: supplierId,
        template_name: formData.template_name,
        version: formData.version,
        is_active: formData.is_active,
        config,
      });
    } catch (e) {
      setConfigError("Nelze uložit šablonu - neplatný JSON formát");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="template_name">Název šablony</Label>
        <Input
          id="template_name"
          value={formData.template_name}
          onChange={(e) =>
            setFormData({ ...formData, template_name: e.target.value })
          }
          placeholder="Např. Pešek - Rambousek Standard"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="version">Verze</Label>
          <Input
            id="version"
            value={formData.version}
            onChange={(e) =>
              setFormData({ ...formData, version: e.target.value })
            }
            placeholder="1.0"
            required
          />
        </div>

        <div className="flex items-center space-x-2 pt-8">
          <Switch
            id="is_active"
            checked={formData.is_active}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, is_active: checked })
            }
          />
          <Label htmlFor="is_active">Aktivní šablona</Label>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="display_layout">Typ zobrazení položek</Label>
        <div className="text-xs text-blue-600 mb-1">
          Current value: {formData.display_layout}
        </div>
        <Select
          value={formData.display_layout}
          onValueChange={(
            value: "standard" | "makro" | "two-line" | "zeelandia"
          ) => {
            console.log(
              "Display layout dropdown changed from",
              formData.display_layout,
              "to:",
              value
            );
            setFormData((prev) => {
              console.log("Previous state:", prev);
              const newState = { ...prev, display_layout: value };
              console.log("New state:", newState);
              return newState;
            });
          }}
        >
          <SelectTrigger id="display_layout">
            <SelectValue placeholder="Vyberte typ zobrazení" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">
              Standard (základní tabulka)
            </SelectItem>
            <SelectItem value="two-line">Two-line (Pešek-Rambousek)</SelectItem>
            <SelectItem value="makro">MAKRO (rozšířená)</SelectItem>
            <SelectItem value="zeelandia">Zeelandia</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Určuje, jak se zobrazí extrahované položky v testovacím náhledu
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="config">Konfigurace (JSON)</Label>

        <Alert className="bg-blue-50 border-blue-200">
          <AlertDescription className="text-xs">
            <strong>💡 Důležité:</strong> Systém mapuje položky pomocí{" "}
            <code className="bg-white px-1 py-0.5 rounded">product_code</code> z
            faktur:
            <br />
            <code className="text-xs">
              product_code (faktura) → ingredient_supplier_codes → ingredients
              (suroviny)
            </code>
            <br />
            Nastavte regex vzory tak, aby správně extrahovaly product_code z
            faktur.
          </AlertDescription>
        </Alert>

        <Textarea
          id="config"
          value={formData.config}
          onChange={(e) => handleConfigChange(e.target.value)}
          placeholder="JSON konfigurace šablony"
          rows={15}
          className="font-mono text-sm"
          required
        />
        {configError && (
          <p className="text-sm text-destructive">{configError}</p>
        )}
        <p className="text-sm text-muted-foreground">
          Upravte vzory (patterns) a nastavení OCR podle formátu faktur
          dodavatele. Viz dokumentace pro podrobnosti.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Zrušit
        </Button>
        <Button type="submit" disabled={!!configError}>
          Uložit šablonu
        </Button>
      </div>
    </form>
  );
}
