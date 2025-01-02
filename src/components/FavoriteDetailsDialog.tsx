import { useState, useEffect } from "react";
import {
  useFavoriteOrders,
  useUpdateFavoriteOrder,
} from "@/hooks/useFavorites";
import { useAuthStore } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { ScrollArea } from "./ui/scroll-area";
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

const DAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne", "X"] as const;

export function FavoriteDetailsDialog({
  favoriteOrderId,
  onClose,
}: FavoriteDetailsDialogProps) {
  const user = useAuthStore((state) => state.user);
  const { data: favorites, isLoading, error, refetch } = useFavoriteOrders();
  const updateFavoriteOrder = useUpdateFavoriteOrder();
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  const currentFavorite = favorites?.find((f) => f.id === favoriteOrderId);

  useEffect(() => {
    if (currentFavorite) {
      setSelectedDays(currentFavorite.days || []);
    }
  }, [currentFavorite]);

  const handleDayToggle = async (
    day: (typeof DAYS)[number],
    checked: boolean
  ) => {
    if (!currentFavorite) return;

    try {
      const newDays = checked
        ? ([...selectedDays, day] as (typeof DAYS)[number][])
        : (selectedDays.filter((d) => d !== day) as (typeof DAYS)[number][]);

      await updateFavoriteOrder.mutateAsync({
        id: currentFavorite.id,
        data: {
          days: newDays.length ? newDays : undefined,
        },
      });
      setSelectedDays(newDays);
    } catch (error) {
      console.error("Failed to update days:", error);
    }
  };

  if (!favoriteOrderId) return null;
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
                  <div className="flex gap-1">
                    {selectedDays
                      .sort(
                        (a, b) =>
                          DAYS.indexOf(a as (typeof DAYS)[number]) -
                          DAYS.indexOf(b as (typeof DAYS)[number])
                      )
                      .map((day) => (
                        <Badge key={day} variant="outline">
                          {day}
                        </Badge>
                      ))}
                  </div>
                </CardTitle>
                <CardDescription className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span>Favorite #{currentFavorite.id}</span>
                  </div>
                  <ScrollArea className="h-[60px] w-full rounded-md border p-4">
                    <div className="flex items-center gap-4">
                      {DAYS.map((day) => (
                        <div key={day} className="flex items-center space-x-2">
                          <Checkbox
                            id={`day-${day}`}
                            checked={selectedDays.includes(day)}
                            onCheckedChange={(checked) =>
                              handleDayToggle(day, checked as boolean)
                            }
                            className="border-orange-800 data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
                          />
                          <label
                            htmlFor={`day-${day}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {day}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
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
                      userRole={currentFavorite.user?.role || "user"}
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
