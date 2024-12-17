import { useFetchProductionById } from "@/hooks/useProductions";
import { useProductionItemsStore } from "@/providers/productionStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "./ui/badge";
import UpdateProductionCart from "./UpdateProductionCart";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ProductionDetailsDialogProps {
  productionId: number | null;
  onClose: () => void;
}

export function ProductionDetailsDialog({
  productionId,
  onClose,
}: ProductionDetailsDialogProps) {
  const { setSelectedProductionId } = useProductionItemsStore();

  const {
    data: productionItem,
    error,
    isLoading,
    refetch,
  } = useFetchProductionById(productionId ? productionId : null);

  if (!productionId) return null;
  if (isLoading) return <div>Loading production details...</div>;
  if (error) return <div>Error loading production details</div>;
  if (!productionItem) return <div>No production found</div>;

  return (
    <Dialog
      open={!!productionId}
      onOpenChange={(open) => {
        if (!open) {
          setSelectedProductionId(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail výroby</DialogTitle>
          <DialogDescription>
            Detail výroby včetně informací o uživateli a položkách
          </DialogDescription>
        </DialogHeader>
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between">
                {productionItem.user?.full_name}
                <Badge variant="outline">
                  {new Date(productionItem.date).toLocaleDateString()}
                </Badge>
              </CardTitle>
              <CardDescription className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span>Production #{productionItem.id}</span>
                  <span className="text-muted-foreground font-semibold">
                    {new Date(productionItem.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UpdateProductionCart
                items={productionItem.production_items}
                productionId={productionItem.id}
                selectedUserId={productionItem.user?.id}
                onUpdate={() => refetch().then(() => {})}
              />
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
