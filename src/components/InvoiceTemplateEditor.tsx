import { useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Copy, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InvoiceTemplateEditorProps {
  supplierId: string;
}

export function InvoiceTemplateEditor({
  supplierId,
}: InvoiceTemplateEditorProps) {
  const {
    templates,
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    toggleActive,
  } = useInvoiceTemplates(supplierId);

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
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (
                              confirm("Opravdu chcete smazat tuto šablonu?")
                            ) {
                              deleteTemplate(template.id);
                            }
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
    config: JSON.stringify(
      template?.config || {
        ocr_settings: {
          dpi: 300,
          language: "ces",
          psm: 6,
        },
        patterns: {
          invoice_number: "Faktura č\\.: (\\d+)",
          date: "Datum: (\\d{2}\\.\\d{2}\\.\\d{4})",
          total_amount: "Celkem:\\s+([\\d\\s,]+)",
          table_start: "Kód\\s+Položka\\s+Množství",
          table_end: "Celkem:",
        },
        table_columns: {
          line_pattern:
            "^(\\d+)\\s+(.+?)\\s+(\\d+[.,]?\\d*)\\s+(.+?)\\s+(\\d+[.,]?\\d*)\\s+(\\d+[.,]?\\d*)$",
        },
      },
      null,
      2
    ),
  });

  const [configError, setConfigError] = useState<string | null>(null);

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
        <Label htmlFor="config">Konfigurace (JSON)</Label>
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
