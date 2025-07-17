import { useAuthStore } from "../lib/supabase";
import { useUsers } from "@/hooks/useProfiles";
import { useState, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteUser } from "@/hooks/useProfiles";
import { EditUserForm } from "./EditUserForm";
import { useDebounce } from "@/hooks/useDebounce";

// Function to remove diacritics from text
const removeDiacritics = (text: string | null | undefined): string => {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

export function AdminTable() {
  const user = useAuthStore((state) => state.user);
  const { data: users, isLoading } = useUsers();
  const deleteUserMutation = deleteUser();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [roleFilter, setRoleFilter] = useState("all");
  const [paidByFilter, setPaidByFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Memoized search function for better performance
  const searchUsers = useCallback((users: any[], searchTerm: string) => {
    if (!searchTerm) return users;

    const normalizedSearch = removeDiacritics(searchTerm);
    return users.filter((user: any) => {
      const searchableFields = [
        user.full_name,
        user.ico,
        user.email,
        user.phone,
        user.address,
      ];

      return searchableFields.some((field) =>
        removeDiacritics(field).includes(normalizedSearch)
      );
    });
  }, []);

  // Memoized filter function
  const filterUsers = useCallback(
    (
      users: any[],
      roleFilter: string,
      paidByFilter: string,
      activeFilter: string
    ) => {
      return users.filter((user: any) => {
        if (roleFilter !== "all" && user.role !== roleFilter) return false;
        if (paidByFilter !== "all" && user.paid_by !== paidByFilter)
          return false;
        if (activeFilter !== "all") {
          const isActive = activeFilter === "true";
          if (user.active !== isActive) return false;
        }
        return true;
      });
    },
    []
  );

  // Filter users with optimized logic
  const filteredUsers = useMemo(() => {
    if (!users) return [];

    let result = users;

    // Apply search first
    if (debouncedSearch) {
      result = searchUsers(result, debouncedSearch);
    }

    // Apply filters
    result = filterUsers(result, roleFilter, paidByFilter, activeFilter);

    return result;
  }, [
    users,
    debouncedSearch,
    roleFilter,
    paidByFilter,
    activeFilter,
    searchUsers,
    filterUsers,
  ]);

  if (user?.role !== "admin") {
    return <div>Access denied. Admin only.</div>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        Loading users...
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col">
        {/* Filters */}
        <div className="flex items-center gap-4 py-4">
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {[
                "user",
                "buyer",
                "driver",
                "store",
                "mobil",
                "expedition",
                "admin",
              ].map((role) => (
                <SelectItem key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={paidByFilter} onValueChange={setPaidByFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payments</SelectItem>
              {["Hotově", "Příkazem", "-"].map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border rounded-md flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">IČO</th>
                <th className="text-left p-3 font-medium">Email</th>
                <th className="text-left p-3 font-medium">Phone</th>
                <th className="text-left p-3 font-medium">Address</th>
                <th className="text-left p-3 font-medium">Payment</th>
                <th className="text-left p-3 font-medium">Role</th>
                <th className="text-left p-3 font-medium">Active</th>
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{user.full_name || "-"}</td>
                  <td className="p-3">{user.ico || "-"}</td>
                  <td className="p-3">{user.email || "-"}</td>
                  <td className="p-3">{user.phone || "-"}</td>
                  <td className="p-3">{user.address || "-"}</td>
                  <td className="p-3">{user.paid_by || "-"}</td>
                  <td className="p-3">
                    {user.role
                      ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
                      : "-"}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${user.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                    >
                      {user.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="hover:text-blue-600"
                        onClick={() => {
                          setSelectedUser(user);
                          setEditModalOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:text-destructive"
                            disabled={user.role === "admin"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                deleteUserMutation.mutate({ id: user.id })
                              }
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Edit User - {selectedUser?.full_name}</DialogTitle>
            <DialogDescription>
              Update user information and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            {selectedUser && (
              <EditUserForm
                user={selectedUser}
                onSuccess={() => {
                  setEditModalOpen(false);
                  setSelectedUser(null);
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
