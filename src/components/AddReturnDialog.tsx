import { useState } from "react";
import { useInsertReturn } from "@/hooks/useReturns";
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
import { useFetchAllProfiles } from "@/hooks/useProfiles";
// import { useAuthStore } from "@/lib/supabase";
import { Profile } from "../../types";
import { useReturnStore } from "@/providers/returnStore";
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
  const { data: users } = useFetchAllProfiles();
  const insertReturn = useInsertReturn();
  const { toast } = useToast();
  //   const user = useAuthStore((state) => state.user);
  const setSelectedReturnId = useReturnStore(
    (state) => state.setSelectedReturnId
  );

  const filteredUsers = users?.filter(
    (user: Profile) => user.role === "store" || user.role === "mobil"
  );

  const handleSubmit = async () => {
    try {
      if (!selectedUserId) {
        toast({
          title: "Error",
          description: "Please select a user",
          variant: "destructive",
        });
        return;
      }

      const result = await insertReturn.mutateAsync({
        user_id: selectedUserId,
        date: format(date, "yyyy-MM-dd"),
        total: 0,
        // seller_id: user?.id,
      });

      toast({
        title: "Success",
        description: "Return created successfully",
      });

      // Close this dialog and open ReturnDetailsDialog
      onClose();
      setSelectedReturnId(result.id);

      // Reset form
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Vytvořit vratku</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
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
