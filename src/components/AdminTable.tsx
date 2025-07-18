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
import { Edit, Trash2, ChevronDown, Download } from "lucide-react";
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

// Function to remove diacritics from text
const removeDiacritics = (text: string | null | undefined): string => {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

// Function to export users to CSV
const exportToCSV = (users: any[], showEmail: boolean) => {
  // Define headers based on visible columns
  const headers = [
    "Name",
    "IČO",
    ...(showEmail ? ["Email"] : []),
    "Phone",
    "Address",
    "OZ",
    "OZ New",
    "MO Partners",
    "Role",
    "Active",
    "Created At",
    "Payment Type",
    "Note",
    "Big Crates",
    "Small Crates",
  ];

  // Convert users to CSV rows
  const csvRows = users.map((user) => [
    user.full_name || "",
    user.ico || "",
    ...(showEmail ? [user.email || ""] : []),
    user.phone || "",
    user.address || "",
    user.oz ? "✅" : "❌",
    user.oz_new ? "✅" : "❌",
    user.mo_partners ? "✅" : "❌",
    user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "",
    user.active ? "✅" : "❌",
    user.created_at
      ? new Date(user.created_at).toLocaleDateString("cs-CZ")
      : "",
    user.paid_by || "",
    user.note || "",
    user.crateBig || 0,
    user.crateSmall || 0,
  ]);

  // Combine headers and rows
  const csvContent = [headers, ...csvRows]
    .map((row) => row.map((field) => `"${field}"`).join(","))
    .join("\n");

  // Create and download file
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `users_export_${new Date().toISOString().split("T")[0]}.csv`
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export function AdminTable() {
  const user = useAuthStore((state) => state.user);
  const { data: users, isLoading } = useUsers();
  const deleteUserMutation = deleteUser();

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("mobil");
  const [paidByFilter, setPaidByFilter] = useState("Hotově");
  const [activeFilter, setActiveFilter] = useState("true");
  const [checkboxFilter, setCheckboxFilter] = useState("all");
  const [createdAtFilter, setCreatedAtFilter] = useState("all");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showEmail, setShowEmail] = useState(false);

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
      activeFilter: string,
      checkboxFilter: string,
      createdAtFilter: string
    ) => {
      return users.filter((user: any) => {
        if (roleFilter !== "all" && user.role !== roleFilter) return false;
        if (paidByFilter !== "all" && user.paid_by !== paidByFilter)
          return false;
        if (activeFilter !== "all") {
          const isActive = activeFilter === "true";
          if (user.active !== isActive) return false;
        }
        if (checkboxFilter !== "all") {
          switch (checkboxFilter) {
            case "oz_true":
              if (!user.oz) return false;
              break;
            case "oz_false":
              if (user.oz) return false;
              break;
            case "oz_new_true":
              if (!user.oz_new) return false;
              break;
            case "oz_new_false":
              if (user.oz_new) return false;
              break;
            case "mo_partners_true":
              if (!user.mo_partners) return false;
              break;
            case "mo_partners_false":
              if (user.mo_partners) return false;
              break;
          }
        }
        if (createdAtFilter !== "all" && user.created_at) {
          const userDate = new Date(user.created_at);
          const userMonth = userDate.getMonth() + 1; // getMonth() returns 0-11
          const userYear = userDate.getFullYear();
          const [filterYear, filterMonth] = createdAtFilter
            .split("-")
            .map(Number);

          if (userYear !== filterYear || userMonth !== filterMonth)
            return false;
        }
        return true;
      });
    },
    []
  );

  // Filter users with optimized logic
  const filteredUsers = useMemo(() => {
    if (!users) return [];

    // Debug: Log the first user to see what fields are available
    if (users.length > 0) {
      console.log("First user data:", users[0]);
      console.log("Created at field:", users[0].created_at);
    }

    let result = users;

    // Apply search first
    if (searchQuery) {
      result = searchUsers(result, searchQuery);
    }

    // Apply filters
    result = filterUsers(
      result,
      roleFilter,
      paidByFilter,
      activeFilter,
      checkboxFilter,
      createdAtFilter
    );

    return result;
  }, [
    users,
    searchQuery,
    roleFilter,
    paidByFilter,
    activeFilter,
    checkboxFilter,
    createdAtFilter,
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
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  // handleSearch(); // Removed as per edit hint
                }
              }}
              className="max-w-sm"
            />
            {/* Removed Search button */}
            {/* {appliedSearchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSearch}
                className="text-gray-600"
              >
                Vymazat
              </Button>
            )} */}
          </div>

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

          <Select value={checkboxFilter} onValueChange={setCheckboxFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by checkbox" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">OZ/OZ Nový/MO Partners</SelectItem>
              <SelectItem value="oz_true">OZ</SelectItem>
              <SelectItem value="oz_new_true">OZ Nový </SelectItem>
              <SelectItem value="mo_partners_true">MO Partners</SelectItem>
            </SelectContent>
          </Select>

          <Select value={createdAtFilter} onValueChange={setCreatedAtFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {(() => {
                const months = [];
                const currentDate = new Date();
                const currentYear = currentDate.getFullYear();
                const currentMonth = currentDate.getMonth();

                // Generate last 12 months
                for (let i = 0; i < 12; i++) {
                  const date = new Date(currentYear, currentMonth - i, 1);
                  const year = date.getFullYear();
                  const month = date.getMonth() + 1;
                  const monthName = date.toLocaleDateString("cs-CZ", {
                    month: "long",
                    year: "numeric",
                  });
                  months.push(
                    <SelectItem
                      key={`${year}-${month}`}
                      value={`${year}-${month}`}
                    >
                      {monthName}
                    </SelectItem>
                  );
                }
                return months;
              })()}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEmail(!showEmail)}
            className="flex items-center gap-1"
          >
            Email
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showEmail ? "rotate-180" : ""}`}
            />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(filteredUsers, showEmail)}
            className="flex items-center gap-1 bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Table */}
        <div className="border rounded-md flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">IČO</th>
                {showEmail && (
                  <th className="text-left p-3 font-medium">Email</th>
                )}
                <th className="text-left p-3 font-medium">Phone</th>
                <th className="text-left p-3 font-medium">Address</th>
                <th className="text-left p-3 font-medium">OZ</th>
                <th className="text-left p-3 font-medium">OZ New</th>
                <th className="text-left p-3 font-medium">MO Partners</th>
                <th className="text-left p-3 font-medium">Role</th>
                <th className="text-left p-3 font-medium">Active</th>
                <th className="text-left p-3 font-medium">Created At</th>
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setSelectedUser(user);
                    setEditModalOpen(true);
                  }}
                >
                  <td className="p-3">{user.full_name || "-"}</td>
                  <td className="p-3">{user.ico || "-"}</td>
                  {showEmail && <td className="p-3">{user.email || "-"}</td>}
                  <td className="p-3">{user.phone || "-"}</td>
                  <td className="p-3">{user.address || "-"}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${user.oz ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                    >
                      {user.oz ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${user.oz_new ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                    >
                      {user.oz_new ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${user.mo_partners ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                    >
                      {user.mo_partners ? "Yes" : "No"}
                    </span>
                  </td>
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
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString("cs-CZ")
                      : "-"}
                  </td>
                  <td className="p-3">
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
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
