import { format } from "date-fns";
import { cs } from "date-fns/locale";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import { OrderChange } from "@/hooks/useOrderChanges";
import { useEffect } from "react";

interface OrderChangesDialogProps {
  orderId: number;
  isOpen: boolean;
  onClose: () => void;
  changes: OrderChange[];
}

const getChangeTypeLabel = (type: string) => {
  switch (type) {
    case "status_change":
      return "Změna stavu";
    case "quantity_update":
      return "Změna množství";
    case "price_update":
      return "Změna ceny";
    case "item_added":
      return "Přidána položka";
    case "item_removed":
      return "Odebrána položka";
    case "driver_change":
      return "Změna řidiče";
    case "crate_change":
      return "Změna přepravek";
    case "crateSmall_change":
      return "Změna malých přepravek";
    case "crateBig_change":
      return "Změna velkých přepravek";
    case "crateSmall_received_change":
      return "Změna vrácených malých přepravek";
    case "crateBig_received_change":
      return "Změna vrácených velkých přepravek";
    case "note_change":
      return "Změna poznámky";
    case "checked_update":
      return "Změna kontroly";
    case "lock_change":
      return "Změna uzamčení";
    case "order_update":
      return null; // Hide these test entries
    default:
      console.warn("OrderChangesDialog - Unknown change type:", type);
      return "Neznámá změna";
  }
};

const getChangeDescription = (change: OrderChange) => {
  const userName = change.user
    ? change.user.full_name || change.user.username || change.user.email
    : "Unknown User";

  // Debug logging
  console.log("OrderChangesDialog - Processing change:", {
    change_type: change.change_type,
    field_name: change.field_name,
    old_value: change.old_value,
    new_value: change.new_value,
  });

  switch (change.change_type) {
    case "status_change":
      return `${userName} změnil(a) stav z "${change.old_value}" na "${change.new_value}"`;
    case "quantity_update":
      return `${userName} změnil(a) množství${change.item ? ` u položky "${change.item.product.name}"` : ""} z ${change.old_value} na ${change.new_value}`;
    case "price_update":
      return `${userName} změnil(a) cenu${change.item ? ` u položky "${change.item.product.name}"` : ""} z ${change.old_value ? `${change.old_value} Kč` : "N/A"} na ${change.new_value ? `${change.new_value} Kč` : "N/A"}`;
    case "item_added":
      const addedItem = change.new_value ? JSON.parse(change.new_value) : null;
      return `${userName} přidal(a) položku${change.item ? ` "${change.item.product.name}"` : ""} s množstvím ${addedItem?.quantity || "N/A"}`;
    case "item_removed":
      const removedItem = change.old_value
        ? JSON.parse(change.old_value)
        : null;
      return `${userName} odebral(a) položku${change.item ? ` "${change.item.product.name}"` : ""} s množstvím ${removedItem?.quantity || "N/A"}`;
    case "driver_change":
      const oldDriver = change.old_value || "Žádný řidič";
      const newDriver = change.new_value || "Žádný řidič";
      return `${userName} změnil(a) řidiče z "${oldDriver}" na "${newDriver}"`;
    case "crate_change":
      if (change.field_name === "crate_small") {
        return `${userName} změnil(a) počet malých přepravek z ${change.old_value || "0"} na ${change.new_value}`;
      } else {
        return `${userName} změnil(a) počet velkých přepravek z ${change.old_value || "0"} na ${change.new_value}`;
      }
    case "crateSmall_change":
      const smallCrateField =
        change.field_name === "crateSmallReceived"
          ? "vrácených malých přepravek"
          : "malých přepravek";
      return `${userName} změnil(a) počet ${smallCrateField} z ${change.old_value || "0"} na ${change.new_value}`;
    case "crateBig_change":
      const bigCrateField =
        change.field_name === "crateBigReceived"
          ? "vrácených velkých přepravek"
          : "velkých přepravek";
      return `${userName} změnil(a) počet ${bigCrateField} z ${change.old_value || "0"} na ${change.new_value}`;
    case "crateSmall_received_change":
      return `${userName} změnil(a) počet vrácených malých přepravek z ${change.old_value || "0"} na ${change.new_value}`;
    case "crateBig_received_change":
      return `${userName} změnil(a) počet vrácených velkých přepravek z ${change.old_value || "0"} na ${change.new_value}`;
    case "note_change":
      return `${userName} změnil(a) poznámku${change.old_value ? ` z "${change.old_value}"` : ""} na "${change.new_value}"`;
    case "checked_update":
      return `${userName} ${change.new_value === "true" ? "označil(a)" : "odznačil(a)"} položku${change.item ? ` "${change.item.product.name}"` : ""}`;
    case "lock_change":
      return `${userName} ${change.new_value === "true" ? "uzamkl(a)" : "odemkl(a)"} objednávku`;
    default:
      console.warn(
        "OrderChangesDialog - Unknown change type in description:",
        change.change_type
      );
      return "Neznámá změna";
  }
};

export default function OrderChangesDialog({
  orderId,
  isOpen,
  onClose,
  changes,
}: OrderChangesDialogProps) {
  console.log("OrderChangesDialog - Rendering with:", {
    orderId,
    isOpen,
    changesCount: changes?.length,
    changes,
  });

  // Log each change for debugging
  if (changes && changes.length > 0) {
    console.log("OrderChangesDialog - Recent changes:", changes.slice(0, 5));
  }
  // Filter out unwanted changes and group by date
  const filteredChanges = changes.filter(
    (change) =>
      change.change_type !== "order_update" &&
      change.change_type !== "manual_test"
  );

  const groupedChanges = filteredChanges.reduce<Record<string, OrderChange[]>>(
    (acc, change) => {
      const date = format(new Date(change.created_at), "yyyy-MM-dd");
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(change);
      return acc;
    },
    {}
  );

  useEffect(() => {
    console.log("OrderChangesDialog - Dialog state changed:", {
      isOpen,
      orderId,
    });
  }, [isOpen, orderId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <History className="h-5 w-5" />
            Historie změn objednávky #{orderId}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {Object.entries(groupedChanges)
            .sort((a, b) => b[0].localeCompare(a[0])) // Sort dates in descending order
            .map(([date, dayChanges]) => (
              <Card key={date}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {format(new Date(date), "EEEE d. MMMM yyyy", {
                      locale: cs,
                    })}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Čas</TableHead>
                        <TableHead className="w-32">Typ změny</TableHead>
                        <TableHead>Popis</TableHead>
                        <TableHead className="w-32">Uživatel</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dayChanges
                        .sort(
                          (a, b) =>
                            new Date(b.created_at).getTime() -
                            new Date(a.created_at).getTime()
                        )
                        .map((change) => (
                          <TableRow key={change.id}>
                            <TableCell>
                              {format(new Date(change.created_at), "HH:mm:ss")}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {getChangeTypeLabel(change.change_type)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {getChangeDescription(change)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">
                                  {change.user
                                    ? change.user.full_name ||
                                      change.user.username
                                    : "Unknown User"}
                                </span>
                                {change.user && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {change.user.role}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}

          {changes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Žádné změny nebyly zaznamenány</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
