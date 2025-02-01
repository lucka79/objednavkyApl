import { useState } from "react";
import {
  useInsertReturn,
  useCheckExistingReturn,
  // useUpdateStoredItems,
} from "@/hooks/useReturns";
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
import { useReturnItemsStore } from "@/providers/returnStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AddReturnDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AddReturnDialog({ open, onClose }: AddReturnDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [date, setDate] = useState<Date>(new Date());
  const { data: users } = useUsers();
  const insertReturn = useInsertReturn();
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);
  const setSelectedReturnId = useReturnItemsStore(
    (state) => state.setSelectedReturnId
  );
  const checkExistingReturn = useCheckExistingReturn();

  const filteredUsers = users?.filter(
    (user: Profile) => user.role === "store" || user.role === "mobil"
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

      const existingReturn = await checkExistingReturn.mutateAsync({
        userId: effectiveUserId,
        date: format(date, "yyyy-MM-dd"),
      });

      if (existingReturn) {
        toast({
          title: "Return Exists",
          description: "A return already exists for this date",
          variant: "destructive",
        });
        return;
      }

      const result = await insertReturn.mutateAsync({
        user_id: effectiveUserId,
        date: format(date, "yyyy-MM-dd"),
        total: 0,
      });

      toast({
        title: "Success",
        description: "Return created successfully",
      });

      onClose();
      setSelectedReturnId(result.id);

      setSelectedUserId("");
      setDate(new Date());
    } catch (error) {
      console.error("Error creating return:", error);
      toast({
        title: "Error",
        description: "Failed to create return",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Vytvořit vratku</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {user?.role === "admin" && (
            <div className="space-y-2">
              <Select
                value={selectedUserId}
                onValueChange={(value) => setSelectedUserId(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte odběratele" />
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
                yesterday.setDate(yesterday.getDate() - 10);

                const nextMonth = new Date();
                nextMonth.setMonth(nextMonth.getMonth() + 1, 0); // Last day of next month

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
            Vytvořit vratku
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
