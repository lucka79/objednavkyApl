import { useFetchReturnById } from "@/hooks/useReturns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "./ui/badge";
import { useAuthStore } from "@/lib/supabase";

// import UpdateReturnCart from "./UpdateReturnCart";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddReturnProduct } from "./AddReturnProduct";
import { Button } from "./ui/button";
import { Plus } from "lucide-react";
import UpdateReturnCart from "./UpdateReturnCart";

export function ReturnDetailsDialog({
  returnId,
  onClose,
}: {
  returnId: number | null;
  onClose: () => void;
}) {
  const user = useAuthStore((state) => state.user);

  const {
    data: returns,
    error,
    isLoading,
    refetch,
  } = useFetchReturnById(returnId);

  console.log("ReturnDetailsDialog - returnId:", returnId);
  console.log("ReturnDetailsDialog - error:", error);
  console.log("ReturnDetailsDialog - returns:", returns);

  if (!returnId) {
    return null;
  }

  if (isLoading) return <div>Loading return details...</div>;
  if (error) return <div>Error loading return details</div>;

  return (
    <Dialog open={!!returnId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Detail vratky</DialogTitle>
          <DialogDescription>
            Detail vratky včetně informací o zákazníkovi a položkách
          </DialogDescription>
        </DialogHeader>
        <div>
          {returns?.map((returnItem) => (
            <Card key={returnItem.id}>
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
                <div className="flex justify-end mb-4">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Product
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Vyberte položku vratky</DialogTitle>
                      </DialogHeader>
                      <AddReturnProduct
                        returnId={returnItem.id}
                        onUpdate={async () => {
                          await refetch();
                        }}
                        selectedUserRole={user?.role || ""}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
                <UpdateReturnCart
                  items={returnItem.return_items}
                  returnId={returnItem.id}
                  selectedUserRole={returnItem.user?.role || ""}
                  onUpdate={async () => {
                    await refetch();
                  }}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
