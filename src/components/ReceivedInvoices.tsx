import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DollarSign,
  Eye,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { useSupplierUsers } from "@/hooks/useProfiles";
import {
  useReceivedInvoices,
  useDeleteReceivedInvoice,
  ReceivedInvoice,
} from "@/hooks/useReceivedInvoices";
import { AddReceivedInvoiceForm } from "./AddReceivedInvoiceForm";

export function ReceivedInvoices() {
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] =
    useState<ReceivedInvoice | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const { data: supplierUsers } = useSupplierUsers();
  const { data: invoices, isLoading } = useReceivedInvoices();
  const deleteInvoiceMutation = useDeleteReceivedInvoice();

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
          .includes(searchTerm.toLowerCase());

      const matchesSupplier =
        supplierFilter === "all" || invoice.supplier_id === supplierFilter;

      const matchesStatus =
        statusFilter === "all" || invoice.processing_status === statusFilter;

      return matchesSearch && matchesSupplier && matchesStatus;
    });
  }, [invoices, searchTerm, supplierFilter, statusFilter]);

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
                placeholder="Hledat podle čísla faktury, dodavatele nebo poznámek..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              </div>

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
                    <TableHead>Datum přijetí</TableHead>
                    <TableHead>Částka</TableHead>
                    <TableHead>Status</TableHead>
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
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          {(invoice.total_amount || 0).toFixed(2)} Kč
                        </div>
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
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
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detail faktury
            </DialogTitle>
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
                      <Label className="text-sm font-medium">Status</Label>
                      <Badge
                        variant={
                          selectedInvoice.processing_status === "approved"
                            ? "default"
                            : selectedInvoice.processing_status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {selectedInvoice.processing_status === "pending" &&
                          "Čekající"}
                        {selectedInvoice.processing_status === "approved" &&
                          "Schváleno"}
                        {selectedInvoice.processing_status === "rejected" &&
                          "Zamítnuto"}
                        {!selectedInvoice.processing_status && "Neznámý"}
                      </Badge>
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
