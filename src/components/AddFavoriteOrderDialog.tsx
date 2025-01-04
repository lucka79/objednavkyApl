import { useState } from "react";
import { useCreateFavoriteOrder } from "@/hooks/useFavorites";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "./ui/checkbox";
import { ScrollArea } from "./ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useSubsrciberUsers } from "@/hooks/useProfiles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

const DAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne", "X"] as const;
type Day = (typeof DAYS)[number];

export function AddFavoriteOrderDialog() {
  const { toast } = useToast();
  const createFavoriteOrder = useCreateFavoriteOrder();
  const [selectedDays, setSelectedDays] = useState<Day[]>([]);
  const { data: subsrciberUsers } = useSubsrciberUsers();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  // @ts-ignore
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = subsrciberUsers?.filter((user) =>
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!selectedUserId) {
      toast({
        title: "Error",
        description: "Please select a user",
        variant: "destructive",
      });
      return;
    }

    if (selectedDays.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one day",
        variant: "destructive",
      });
      return;
    }

    try {
      // Check for existing favorite orders
      for (const day of selectedDays) {
        const { data: existingOrder, error: checkError } = await supabase
          .from("favorite_orders")
          .select(
            `
            id,
            days,
            user:profiles!favorite_orders_user_id_fkey (
              id,
              full_name
            )
          `
          )
          .eq("user_id", selectedUserId)
          .contains("days", [day])
          .maybeSingle();

        if (checkError) throw checkError;

        if (existingOrder) {
          toast({
            title: "Warning",
            description: `Favorite order already exists for ${existingOrder.user[0]?.full_name} on ${day}`,
            variant: "destructive",
            duration: 3000,
          });
          return; // Stop the entire creation process
        }
      }

      // Continue with order creation if no duplicates found
      const createPromises = selectedDays.map((day) => {
        const orderData = {
          user_id: selectedUserId,
          days: [day],
          status: "Pre-order",
        };
        console.log("Creating order with data:", orderData);

        return createFavoriteOrder.mutateAsync({
          // @ts-ignore
          data: orderData,
        });
      });

      const results = await Promise.all(createPromises);
      console.log("Created favorite orders:", results);

      toast({
        title: "Success",
        description: `Created ${selectedDays.length} favorite order(s) successfully`,
      });
      setIsOpen(false);
      setSelectedDays([]);
      setSelectedUserId("");
    } catch (error) {
      console.error("Failed to create favorite order(s):", error);
      toast({
        title: "Error",
        description: "Failed to create favorite order(s)",
        variant: "destructive",
      });
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Stálá objednávka</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Vyberte odběratele</label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Vyberte odběratele..." />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-2">
                <Input
                  placeholder="Hledat uživatele..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-2"
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              {filteredUsers?.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.full_name}
                </SelectItem>
              ))}
              {filteredUsers?.length === 0 && (
                <div className="px-2 py-2 text-sm text-muted-foreground">
                  Uživatel nenalezen
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Vyberte dny</label>
          <ScrollArea className="h-[100px] w-full rounded-md border p-4">
            <div className="flex flex-wrap gap-4">
              {DAYS.map((day) => (
                <div key={day} className="flex items-center space-x-2">
                  <Checkbox
                    id={`day-${day}`}
                    checked={selectedDays.includes(day)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedDays([...selectedDays, day]);
                      } else {
                        setSelectedDays(selectedDays.filter((d) => d !== day));
                      }
                    }}
                    className="border-orange-600 data-[state=checked]:bg-orange-600 data-[state=checked]:text-white"
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
        </div>

        <Button
          variant="outline"
          onClick={handleSubmit}
          className="w-full bg-orange-600 text-white hover:bg-orange-700 hover:text-white"
        >
          Vytvořit stálou objednávku
        </Button>
      </div>
    </DialogContent>
  );
}
