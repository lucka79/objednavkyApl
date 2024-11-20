import { useFavoriteOrders } from "@/hooks/useFavorites";
import { useAuthStore } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "./ui/badge";
import { FavoriteItems } from "./FavoriteItems";
import FavoriteCart from "./FavoriteCart";
import { AddFavoriteProduct } from "./AddFavoriteProduct";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { Plus } from "lucide-react";

interface FavoriteDetailsDialogProps {
  favoriteOrderId: number | null;
  onClose: () => void;
}

export function FavoriteDetailsDialog({
  favoriteOrderId,
  onClose,
}: FavoriteDetailsDialogProps) {
  const user = useAuthStore((state) => state.user);
  const { data: favorites, isLoading, error, refetch } = useFavoriteOrders();

  if (!favoriteOrderId) {
    return null;
  }

  const currentFavorite = favorites?.find((f) => f.id === favoriteOrderId);

  if (isLoading) return <div>Loading favorite details...</div>;
  if (error) return <div>Error loading favorite details</div>;

  return (
    <Dialog
      open={!!favoriteOrderId}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail oblíbené objednávky</DialogTitle>
          <DialogDescription>
            Detail oblíbené objednávky včetně položek
          </DialogDescription>
        </DialogHeader>
        <div>
          {currentFavorite && (
            <Card key={currentFavorite.id}>
              <CardHeader>
                <CardTitle className="flex justify-between">
                  {currentFavorite.user?.full_name}
                  <Badge variant="outline">{currentFavorite.day}</Badge>
                </CardTitle>
                <CardDescription className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span>Favorite #{currentFavorite.id}</span>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {user?.role === "admin" ? (
                  <>
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
                            <DialogTitle>Add Product to Favorite</DialogTitle>
                          </DialogHeader>
                          <AddFavoriteProduct
                            favoriteOrderId={currentFavorite.id}
                            onUpdate={async () => {
                              await refetch();
                            }}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                    <FavoriteCart
                      items={currentFavorite.favorite_items}
                      favoriteOrderId={currentFavorite.id}
                      onUpdate={() => refetch().then(() => {})}
                    />
                  </>
                ) : (
                  <FavoriteItems items={currentFavorite.favorite_items} />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
