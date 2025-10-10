import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  FileText,
  Search,
  Calendar,
  Package,
  User,
  Eye,
  Trash2,
  Edit,
  Save,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { useUsers } from "@/hooks/useProfiles";
import {
  useReceivedInvoices,
  useDeleteReceivedInvoice,
  useUpdateReceivedInvoice,
  ReceivedInvoice,
} from "@/hooks/useReceivedInvoices";
import { AddReceivedInvoiceForm } from "./AddReceivedInvoiceForm";

export function ReceivedInvoices() {
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [receiverFilter, setReceiverFilter] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  // const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] =
    useState<ReceivedInvoice | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    receiver_id: "",
  });

  const { data: allUsers } = useUsers();
  const { data: invoices, isLoading } = useReceivedInvoices();
  const deleteInvoiceMutation = useDeleteReceivedInvoice();
  const updateInvoiceMutation = useUpdateReceivedInvoice();

  // Filter users by role
  const storeUsers = allUsers?.filter((user) => user.role === "store") || [];
  const supplierUsers =
    allUsers?.filter((user) => user.role === "supplier") || [];

  // Filter invoices based on search and filters
  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];

    return invoices.filter((invoice) => {
      const matchesSearch =
        invoice.invoice_number
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (invoice.supplier?.full_name || invoice.supplier_name || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (invoice.receiver?.full_name || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesSupplier =
        supplierFilter === "all" || invoice.supplier_id === supplierFilter;

      const matchesReceiver =
        receiverFilter === "all" || invoice.receiver_id === receiverFilter;

      const matchesDate = (() => {
        const invoiceDate = invoice.invoice_date
          ? new Date(invoice.invoice_date)
          : null;
        if (!invoiceDate) return false;

        // Check if invoice date is within the selected month
        return (
          invoiceDate.getFullYear() === selectedMonth.getFullYear() &&
          invoiceDate.getMonth() === selectedMonth.getMonth()
        );
      })();

      // const matchesStatus =
      //   statusFilter === "all" || invoice.processing_status === statusFilter;

      return matchesSearch && matchesSupplier && matchesReceiver && matchesDate;
    });
  }, [invoices, searchTerm, supplierFilter, receiverFilter, selectedMonth]);

  // Calculate totals
  const totals = useMemo(() => {
    if (!filteredInvoices) return { count: 0, totalAmount: 0 };

    const count = filteredInvoices.length;
    const totalAmount = filteredInvoices.reduce(
      (sum, invoice) => sum + (invoice.total_amount || 0),
      0
    );

    return { count, totalAmount };
  }, [filteredInvoices]);

  const handleViewInvoice = (invoice: ReceivedInvoice) => {
    setSelectedInvoice(invoice);
    setEditForm({
      receiver_id: invoice.receiver_id || "",
    });
    setIsEditing(false);
    setIsDetailDialogOpen(true);
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      await deleteInvoiceMutation.mutateAsync(invoiceId);
      toast({
        title: "Úspěch",
        description: "Faktura byla úspěšně smazána",
      });
    } catch (error) {
      toast({
        title: "Chyba",
        description: "Nepodařilo se smazat fakturu",
        variant: "destructive",
      });
    }
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    if (isEditing) {
      // Reset form when canceling edit
      setEditForm({
        receiver_id: selectedInvoice?.receiver_id || "",
      });
    }
  };

  const handleUpdateInvoice = async () => {
    if (!selectedInvoice) return;

    try {
      await updateInvoiceMutation.mutateAsync({
        id: selectedInvoice.id,
        receiver_id: editForm.receiver_id,
      });

      // Update the selected invoice with new data
      setSelectedInvoice({
        ...selectedInvoice,
        receiver_id: editForm.receiver_id,
      });

      setIsEditing(false);
      toast({
        title: "Úspěch",
        description: "Faktura byla úspěšně aktualizována",
      });
    } catch (error: any) {
      console.error("Error updating invoice:", error);
      toast({
        title: "Chyba",
        description:
          error?.message ||
          "Nepodařilo se aktualizovat fakturu. Zkontrolujte, zda je sloupec receiver_id přidán do databáze.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Přijaté faktury
            </CardTitle>
            <AddReceivedInvoiceForm />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Hledat podle čísla faktury, dodavatele, příjemce..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Dodavatel</Label>
                <Select
                  value={supplierFilter}
                  onValueChange={setSupplierFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Všichni dodavatelé" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všichni dodavatelé</SelectItem>
                    {(supplierUsers || []).map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Příjemce</Label>
                <Select
                  value={receiverFilter}
                  onValueChange={setReceiverFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Všichni příjemci" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všichni příjemci</SelectItem>
                    {storeUsers.map((receiver) => (
                      <SelectItem key={receiver.id} value={receiver.id}>
                        {receiver.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Měsíc</Label>
                <Select
                  value={`${selectedMonth.getFullYear()}-${selectedMonth.getMonth()}`}
                  onValueChange={(value) => {
                    const [year, month] = value.split("-");
                    setSelectedMonth(
                      new Date(parseInt(year), parseInt(month), 1)
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(() => {
                        const months = [
                          "Leden",
                          "Únor",
                          "Březen",
                          "Duben",
                          "Květen",
                          "Červen",
                          "Červenec",
                          "Srpen",
                          "Září",
                          "Říjen",
                          "Listopad",
                          "Prosinec",
                        ];
                        return `${months[selectedMonth.getMonth()]} ${selectedMonth.getFullYear()}`;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const months = [
                        "Leden",
                        "Únor",
                        "Březen",
                        "Duben",
                        "Květen",
                        "Červen",
                        "Červenec",
                        "Srpen",
                        "Září",
                        "Říjen",
                        "Listopad",
                        "Prosinec",
                      ];
                      const currentYear = new Date().getFullYear();
                      const options = [];

                      // Add current year months
                      for (let month = 0; month < 12; month++) {
                        options.push(
                          <SelectItem
                            key={`${currentYear}-${month}`}
                            value={`${currentYear}-${month}`}
                          >
                            {months[month]} {currentYear}
                          </SelectItem>
                        );
                      }

                      // Add previous year months
                      for (let month = 0; month < 12; month++) {
                        options.push(
                          <SelectItem
                            key={`${currentYear - 1}-${month}`}
                            value={`${currentYear - 1}-${month}`}
                          >
                            {months[month]} {currentYear - 1}
                          </SelectItem>
                        );
                      }

                      return options;
                    })()}
                  </SelectContent>
                </Select>
              </div>

              {/* <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Všechny statusy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všechny statusy</SelectItem>
                    <SelectItem value="pending">Čekající</SelectItem>
                    <SelectItem value="approved">Schváleno</SelectItem>
                    <SelectItem value="rejected">Zamítnuto</SelectItem>
                    <SelectItem value="processed">Zpracováno</SelectItem>
                    <SelectItem value="failed">Chyba</SelectItem>
                  </SelectContent>
                </Select>
              </div> */}

              <div className="space-y-2">
                <Label>Statistiky</Label>
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-md">
                  <div className="text-sm">
                    <span className="font-medium">{totals.count}</span> faktur
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">
                      {totals.totalAmount.toFixed(2)} Kč
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices List */}
      <Card>
        <CardContent>
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Žádné faktury nebyly nalezeny.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Číslo faktury</TableHead>
                    <TableHead>Dodavatel</TableHead>
                    <TableHead>Příjemce</TableHead>
                    <TableHead>Datum přijetí</TableHead>
                    <TableHead>Částka bez DPH</TableHead>
                    {/* <TableHead>Status</TableHead> */}
                    <TableHead>Položky</TableHead>
                    <TableHead className="text-right">Akce</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {invoice.supplier?.full_name ||
                            invoice.supplier_name ||
                            "Neznámý dodavatel"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {invoice.receiver?.full_name || "Neznámý příjemce"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {invoice.invoice_date
                            ? new Date(invoice.invoice_date).toLocaleDateString(
                                "cs-CZ"
                              )
                            : "Neznámé datum"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {(invoice.total_amount || 0).toFixed(2)} Kč
                        </div>
                      </TableCell>
                      {/* <TableCell>
                        <Badge
                          variant={
                            invoice.processing_status === "approved"
                              ? "default"
                              : invoice.processing_status === "rejected"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {invoice.processing_status === "pending" &&
                            "Čekající"}
                          {invoice.processing_status === "approved" &&
                            "Schváleno"}
                          {invoice.processing_status === "rejected" &&
                            "Zamítnuto"}
                          {!invoice.processing_status && "Neznámý"}
                        </Badge>
                      </TableCell> */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {invoice.items?.length || 0} položek
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewInvoice(invoice)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteInvoice(invoice.id)}
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

      {/* Invoice Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Detail faktury
              </DialogTitle>
              <div className="flex gap-2">
                {!isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditToggle}
                    className="flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Upravit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEditToggle}
                      className="flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      Zrušit
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleUpdateInvoice}
                      className="flex items-center gap-2"
                      disabled={updateInvoiceMutation.isPending}
                    >
                      <Save className="h-4 w-4" />
                      Uložit
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-6">
              {/* Invoice Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informace o faktuře</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">
                        Číslo faktury
                      </Label>
                      <p className="text-lg font-semibold">
                        {selectedInvoice.invoice_number}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Dodavatel</Label>
                      <p className="text-lg">
                        {selectedInvoice.supplier?.full_name ||
                          selectedInvoice.supplier_name ||
                          "Neznámý dodavatel"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">
                        Datum faktury
                      </Label>
                      <p>
                        {selectedInvoice.invoice_date
                          ? new Date(
                              selectedInvoice.invoice_date
                            ).toLocaleDateString("cs-CZ")
                          : "Neznámé datum"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">
                        Celková částka
                      </Label>
                      <p className="text-lg font-semibold text-green-600">
                        {(selectedInvoice.total_amount || 0).toFixed(2)} Kč
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Příjemce</Label>
                      {isEditing ? (
                        <Select
                          value={editForm.receiver_id}
                          onValueChange={(value) =>
                            setEditForm((prev) => ({
                              ...prev,
                              receiver_id: value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Vyberte příjemce" />
                          </SelectTrigger>
                          <SelectContent>
                            {storeUsers.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-lg">
                          {selectedInvoice.receiver_id
                            ? storeUsers.find(
                                (user) =>
                                  user.id === selectedInvoice.receiver_id
                              )?.full_name || "Neznámý příjemce"
                            : "Není nastaven"}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Invoice Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Položky faktury</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="border rounded-md">
                      <div className="px-3 py-2 bg-gray-50 border-b text-xs text-muted-foreground font-medium">
                        <div className="grid grid-cols-5 gap-4">
                          <span>Surovina</span>
                          <span>Množství</span>
                          <span>Jednotková cena</span>
                          <span>Celková cena</span>
                          <span>Akce</span>
                        </div>
                      </div>
                      <div className="divide-y">
                        {selectedInvoice.items?.map((item) => (
                          <div
                            key={item.id}
                            className="px-3 py-2 hover:bg-gray-50"
                          >
                            <div className="grid grid-cols-5 gap-4 items-center">
                              <div className="font-medium">
                                {item.ingredient?.name || "Neznámá surovina"}
                              </div>
                              <div className="w-full [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none">
                                {item.quantity || 0}
                              </div>
                              <div className="w-full [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none">
                                {(item.unit_price || 0).toFixed(2)} Kč
                              </div>
                              <div className="font-medium">
                                {(item.line_total || 0).toFixed(2)} Kč
                              </div>
                              <div className="flex justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
