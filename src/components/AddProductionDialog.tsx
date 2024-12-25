import { useState } from "react";
import {
  useInsertProduction,
  useCheckExistingProduction,
} from "@/hooks/useProductions";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUsers } from "@/hooks/useProfiles";
import { useAuthStore } from "@/lib/supabase";
import { Profile } from "../../types";
import { useProductionItemsStore } from "@/providers/productionStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AddProductionDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AddProductionDialog({
  open,
  onClose,
}: AddProductionDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [date, setDate] = useState<Date>(new Date());
  const { data: users } = useUsers();
  const insertProduction = useInsertProduction();
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);
  const setSelectedProductionId = useProductionItemsStore(
    (state) => state.setSelectedProductionId
  );
  const checkExistingProduction = useCheckExistingProduction();

  const filteredUsers = users?.filter(
    (user: Profile) => user.role === "store" || user.role === "expedition"
  );

  const handleSubmit = async () => {
    try {
      const effectiveUserId = user?.role === "store" ? user.id : selectedUserId;

      if (!effectiveUserId) {
        toast({
          title: "Error",
          description: "Please select a user",
          variant: "destructive",
        });
        return;
      }

      const existingProduction = await checkExistingProduction.mutateAsync({
        userId: effectiveUserId,
        date: format(date, "yyyy-MM-dd"),
      });

      if (existingProduction) {
        toast({
          title: "Production Exists",
          description: "A production already exists for this date",
          variant: "destructive",
        });
        return;
      }

      const result = await insertProduction.mutateAsync({
        user_id: effectiveUserId,
        date: format(date, "yyyy-MM-dd"),
        total: 0,
      });

      toast({
        title: "Success",
        description: "Production created successfully",
      });

      onClose();
      setSelectedProductionId(result.id);

      setSelectedUserId("");
      setDate(new Date());
    } catch (error) {
      console.error("Error creating production:", error);
      toast({
        title: "Error",
        description: "Failed to create production",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Vytvořit výrobu</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {user?.role === "admin" && (
            <div className="space-y-2">
              <Select
                value={selectedUserId}
                onValueChange={(value) => setSelectedUserId(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte uživatele" />
                </SelectTrigger>
                <SelectContent>
                  {filteredUsers?.map((user: Profile) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Card className="p-4">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(date) => date && setDate(date)}
              disabled={(date) => {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                const nextMonth = new Date();
                nextMonth.setMonth(nextMonth.getMonth() + 1, 0);

                return date < yesterday || date > nextMonth;
              }}
              initialFocus
              className="rounded-md border"
              classNames={{
                day_selected:
                  "bg-orange-800 text-white hover:bg-orange-700 focus:bg-orange-700",
              }}
            />
          </Card>

          <Button variant="outline" onClick={handleSubmit} className="w-full">
            Vytvořit výrobu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
