import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Eye,
  Trash2,
  Search,
  Calendar,
  User,
  Package,
  ArrowRightLeft,
  X,
} from "lucide-react";
import {
  useTransfers,
  useDeleteTransfer,
  Transfer,
} from "@/hooks/useTransfers";
import { useAuthStore } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface TransferDetailsDialogProps {
  transfer: Transfer | null;
  isOpen: boolean;
  onClose: () => void;
}

function TransferDetailsDialog({
  transfer,
  isOpen,
  onClose,
}: TransferDetailsDialogProps) {
  if (!transfer) return null;

  // Group transfer items by ingredient category
  const groupedItems = transfer.transfer_items.reduce(
    (acc, item) => {
      const categoryName =
        (item.ingredient as any).ingredient_categories?.name || "Uncategorized";

      if (!acc[categoryName]) {
        acc[categoryName] = [];
      }
      acc[categoryName].push(item);
      return acc;
    },
    {} as Record<string, typeof transfer.transfer_items>
  );

  // Calculate total weight
  const totalWeight = transfer.transfer_items.reduce(
    (sum, item) => sum + item.quantity * item.ingredient.kiloPerUnit,
    0
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-xl font-semibold">
            Transfer Details #{transfer.id}
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-6">
          {/* Transfer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                Transfer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Date
                  </Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      {format(new Date(transfer.date), "PPP")}
                    </p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Sender
                  </Label>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {transfer.sender.full_name || transfer.sender.username}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {transfer.sender.role}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Receiver
                  </Label>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {transfer.receiver.full_name ||
                        transfer.receiver.username}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {transfer.receiver.role}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transfer Items by Category */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Transfer Items ({transfer.transfer_items.length})
                <Badge variant="secondary" className="ml-auto">
                  Total: {totalWeight.toFixed(3)} kg
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(groupedItems).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No items in this transfer</p>
                </div>
              ) : (
                Object.entries(groupedItems).map(([categoryName, items]) => (
                  <div key={categoryName} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm text-muted-foreground">
                        {categoryName}
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        {items.length} items
                      </Badge>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-1/2">Ingredient</TableHead>
                            <TableHead className="w-1/6">Unit</TableHead>
                            <TableHead className="w-1/6 text-right">
                              Quantity
                            </TableHead>
                            <TableHead className="w-1/6 text-right">
                              Weight (kg)
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                {item.ingredient.name}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {item.ingredient.unit}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {item.quantity}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {(
                                  item.quantity * item.ingredient.kiloPerUnit
                                ).toFixed(3)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TransfersTable() {
  const { user } = useAuthStore();
  const { data: transfers = [], isLoading, error } = useTransfers();
  const deleteTransfer = useDeleteTransfer();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(
    null
  );
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const filteredTransfers = transfers.filter((transfer) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      transfer.sender.full_name?.toLowerCase().includes(searchLower) ||
      transfer.sender.username?.toLowerCase().includes(searchLower) ||
      transfer.receiver.full_name?.toLowerCase().includes(searchLower) ||
      transfer.receiver.username?.toLowerCase().includes(searchLower) ||
      transfer.id.toString().includes(searchLower)
    );
  });

  const handleViewDetails = (transfer: Transfer) => {
    setSelectedTransfer(transfer);
    setIsDetailsOpen(true);
  };

  const handleDelete = async (transferId: number) => {
    if (
      window.confirm(
        "Are you sure you want to delete this transfer? This action cannot be undone."
      )
    ) {
      try {
        await deleteTransfer.mutateAsync(transferId);
        toast({
          title: "Success",
          description: "Transfer deleted successfully",
        });
      } catch (error) {
        console.error("Error deleting transfer:", error);
        toast({
          title: "Error",
          description: "Failed to delete transfer. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const canDelete = (transfer: Transfer) => {
    // Only allow deletion if user is the sender or admin
    return user?.id === transfer.sender_id || user?.role === "admin";
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading transfers...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">
            Error loading transfers: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transfers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transfers by sender, receiver, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredTransfers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No transfers found</p>
              {searchTerm && (
                <p className="text-sm">Try adjusting your search terms</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Receiver</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell className="font-medium">
                      #{transfer.id}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(transfer.date), "MMM dd, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {transfer.sender.full_name ||
                            transfer.sender.username}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {transfer.sender.role}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {transfer.receiver.full_name ||
                            transfer.receiver.username}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {transfer.receiver.role}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span>{transfer.transfer_items.length} items</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(transfer)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        {canDelete(transfer) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(transfer.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TransferDetailsDialog
        transfer={selectedTransfer}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedTransfer(null);
        }}
      />
    </div>
  );
}
