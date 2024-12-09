import { useFetchReturnById } from "@/hooks/useReturns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "./ui/badge";
import { ReturnItems } from "./ReturnItems";
import { useAuthStore } from "@/lib/supabase";

import UpdateReturnCart from "./UpdateReturnCart";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
          {returns?.map((return_) => (
            <Card key={return_.id}>
              <CardHeader>
                <CardTitle className="flex justify-between">
                  {return_.user?.full_name}
                  <Badge variant="outline">
                    {new Date(return_.date).toLocaleDateString()}
                  </Badge>
                </CardTitle>
                <CardDescription className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span>Return #{return_.id}</span>
                    <span className="text-muted-foreground font-semibold">
                      {new Date(return_.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {user?.role === "admin" ? (
                  <UpdateReturnCart
                    items={return_.return_items}
                    returnId={return_.id}
                    selectedUserId={return_.user?.id}
                    onUpdate={() => refetch().then(() => {})}
                  />
                ) : (
                  <ReturnItems items={return_.return_items} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
