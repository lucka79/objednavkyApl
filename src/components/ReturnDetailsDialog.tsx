import { useFetchReturnById } from "@/hooks/useReturns";
import { useReturnItemsStore } from "@/providers/returnStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "./ui/badge";
// import { useAuthStore } from "@/lib/supabase";
import UpdateReturnCart from "./UpdateReturnCart";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ReturnDetailsDialogProps {
  returnId: number | null;
  onClose: () => void;
}

export function ReturnDetailsDialog({
  returnId,
  onClose,
}: ReturnDetailsDialogProps) {
  // const user = useAuthStore((state) => state.user);
  const { setSelectedReturnId } = useReturnItemsStore();

  const {
    data: returnItem,
    error,
    isLoading,
    refetch,
  } = useFetchReturnById(returnId ? returnId : null);

  if (!returnId) return null;
  if (isLoading) return <div>Loading return details...</div>;
  if (error) return <div>Error loading return details</div>;
  if (!returnItem) return <div>No return found</div>;

  return (
    <Dialog
      open={!!returnId}
      onOpenChange={(open) => {
        if (!open) {
          setSelectedReturnId(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail vratky</DialogTitle>
          <DialogDescription>
            Detail vratky včetně informací o zákazníkovi a položkách
          </DialogDescription>
        </DialogHeader>
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between">
                {returnItem.user?.full_name}
                <Badge variant="outline">
                  {new Date(returnItem.date).toLocaleDateString()}
                </Badge>
              </CardTitle>
              <CardDescription className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span>Return #{returnItem.id}</span>
                  <span className="text-muted-foreground font-semibold">
                    {new Date(returnItem.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UpdateReturnCart
                items={returnItem.return_items}
                returnId={returnItem.id}
                selectedUserId={returnItem.user?.id}
                selectedUserRole={returnItem.user?.role}
                onUpdate={() => refetch().then(() => {})}
              />
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
