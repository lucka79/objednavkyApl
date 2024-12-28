import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../lib/supabase";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useState, useMemo } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserRole } from "../../types";
import {
  useUsers,
  updateProfile,
  updateRole,
  updatePaidBy,
  updateActive,
  deleteUser,
} from "@/hooks/useProfiles";

// import { useUsers } from "@/hooks/useProfiles";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function AdminTable() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const { data: users } = useUsers();
  const { toast } = useToast();

  const updateProfileMutation = updateProfile();
  const updateRoleMutation = updateRole();
  const updatePaidByMutation = updatePaidBy();
  const updateActiveMutation = updateActive();
  const deleteUserMutation = deleteUser();

  const columnHelper = createColumnHelper<any>();

  const columns = [
    columnHelper.accessor("full_name", {
      header: "Name",
      cell: ({ row, getValue }) => {
        const [isEditing, setIsEditing] = useState(false);
        const [value, setValue] = useState(getValue());

        const onBlur = () => {
          setIsEditing(false);
          if (value !== getValue()) {
            updateProfileMutation.mutate({
              id: row.original.id,
              full_name: value,
            });
          }
        };

        return isEditing ? (
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={onBlur}
            autoFocus
          />
        ) : (
          <div onDoubleClick={() => setIsEditing(true)}>
            {getValue() || "—"}
          </div>
        );
      },
    }),
    columnHelper.accessor("ico", {
      header: "IČO",
      cell: ({ row, getValue }) => {
        const [isEditing, setIsEditing] = useState(false);
        const [value, setValue] = useState(getValue());

        const onBlur = () => {
          setIsEditing(false);
          if (value !== getValue()) {
            updateProfileMutation.mutate({
              id: row.original.id,
              ico: value,
            });
          }
        };

        return isEditing ? (
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={onBlur}
            autoFocus
          />
        ) : (
          <div onDoubleClick={() => setIsEditing(true)}>
            {getValue() || "—"}
          </div>
        );
      },
    }),
    columnHelper.accessor("email", {
      header: "Email",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("phone", {
      header: "Phone",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("address", {
      header: "Address",
      cell: ({ row, getValue }) => {
        const [isEditing, setIsEditing] = useState(false);
        const [value, setValue] = useState(getValue());

        const onBlur = () => {
          setIsEditing(false);
          if (value !== getValue()) {
            updateProfileMutation.mutate({
              id: row.original.id,
              address: value,
            });
          }
        };

        return isEditing ? (
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={onBlur}
            autoFocus
          />
        ) : (
          <div onDoubleClick={() => setIsEditing(true)}>
            {getValue() || "—"}
          </div>
        );
      },
    }),
    columnHelper.accessor("paid_by", {
      header: "Typ platby",
      cell: ({ row, getValue }) => (
        <Select
          value={getValue()}
          onValueChange={(newValue: string) => {
            updatePaidByMutation.mutate({
              id: row.original.id,
              paid_by: newValue,
            });
          }}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["Hotově", "Příkazem"].map((type) => (
              <SelectItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    }),
    columnHelper.accessor("role", {
      header: "Role",
      cell: ({ row, getValue }) => (
        <Select
          value={getValue()}
          onValueChange={(newValue: UserRole) => {
            updateRoleMutation.mutate({
              id: row.original.id,
              role: newValue,
            });
          }}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["user", "buyer", "driver", "store", "mobil", "expedition"].map(
              (role) => (
                <SelectItem key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      ),
    }),
    columnHelper.accessor("mo_partners", {
      header: "MoPartners",
      cell: ({ row, getValue }) => {
        const handleChange = useMemo(
          () => async (checked: boolean) => {
            await Promise.all([
              queryClient.setQueryData(["users"], (oldData: any) =>
                oldData.map((user: any) =>
                  user.id === row.original.id
                    ? { ...user, mo_partners: checked ? "true" : "false" }
                    : user
                )
              ),
              updateProfileMutation.mutate({
                id: row.original.id,
                mo_partners: checked ? "true" : "false",
              }),
            ]);
          },
          [row.original.id]
        );

        return (
          <Checkbox
            checked={!!getValue()}
            onCheckedChange={handleChange}
            className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
          />
        );
      },
    }),
    columnHelper.accessor("active", {
      header: "Active",
      cell: ({ row, getValue }) => {
        const handleChange = useMemo(
          () => async (checked: boolean) => {
            await Promise.all([
              queryClient.setQueryData(["users"], (oldData: any) =>
                oldData.map((user: any) =>
                  user.id === row.original.id
                    ? { ...user, active: checked }
                    : user
                )
              ),
              updateActiveMutation.mutate({
                id: row.original.id,
                active: checked,
              }),
            ]);
          },
          [row.original.id]
        );

        return (
          <Checkbox
            checked={getValue()}
            onCheckedChange={handleChange}
            className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
          />
        );
      },
    }),
    columnHelper.accessor("actions", {
      header: "Actions",
      cell: ({ row }) => {
        const isAdmin = row.original.role === "admin";
        const handleDelete = async () => {
          try {
            // console.log("Attempting to delete user:", row.original.id);
            await deleteUserMutation.mutateAsync({ id: row.original.id });
            // console.log("Delete mutation completed");
            toast({
              title: "Success",
              description: "User deleted successfully",
            });
          } catch (error) {
            // console.error("Failed to delete user:", error);
            toast({
              title: "Error",
              description: "Failed to delete user",
              variant: "destructive",
            });
          }
        };

        return (
          <div className="flex justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  disabled={isAdmin}
                  title={isAdmin ? "Cannot delete admin users" : "Delete user"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Are you sure you want to delete this user?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete
                    the user's account and all associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      },
    }),
  ];

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [paidByFilter, setPaidByFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  const filteredUsers = useMemo(() => {
    return (users ?? []).filter((user: any) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        user.full_name?.toLowerCase().includes(searchLower) ||
        user.ico?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.phone?.toLowerCase().includes(searchLower) ||
        user.address?.toLowerCase().includes(searchLower);

      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesPaidBy =
        paidByFilter === "all" || user.paid_by === paidByFilter;
      const matchesActive =
        activeFilter === "all" ||
        (activeFilter === "true" ? user.active : !user.active);

      return matchesSearch && matchesRole && matchesPaidBy && matchesActive;
    });
  }, [users, searchQuery, roleFilter, paidByFilter, activeFilter]);

  const table = useReactTable({
    data: filteredUsers,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (user?.role !== "admin") {
    return <div>Access denied. Admin only.</div>;
  }

  return (
    <>
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
            {["Hotově", "Příkazem"].map((type) => (
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

      <div className="border rounded-md">
        <div className="max-h-[800px] overflow-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 border-b">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="bg-background h-12">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
