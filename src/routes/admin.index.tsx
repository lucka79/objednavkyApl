import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuthStore, supabase } from "../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CreateUserForm } from "@/components/CreateUserForm";
import { CirclePlus } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import { useState, Suspense, useMemo } from "react";
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
import { CreateUserEmailForm } from "@/components/CreateUserEmailForm";
import { useUsers } from "@/hooks/useProfiles";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const user = useAuthStore((state) => state.user);
  const [openMobile, setOpenMobile] = useState(false);
  const [openEmail, setOpenEmail] = useState(false);
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useUsers();

  const updateProfile = useMutation({
    mutationFn: async ({
      id,
      address,
      ico,
      mo_partners,
    }: {
      id: string;
      address?: string;
      ico?: string;
      mo_partners?: string;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          ...(address && { address }),
          ...(ico && { ico }),
          ...(mo_partners && { mo_partners }),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const updatePaidBy = useMutation({
    mutationFn: async ({ id, paid_by }: { id: string; paid_by: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ paid_by })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const updateActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const columnHelper = createColumnHelper<any>();

  const columns = [
    // columnHelper.accessor("id", {
    //   header: "ID",
    //   cell: (info) => info.getValue(),
    // }),
    columnHelper.accessor("full_name", {
      header: "Name",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("ico", {
      header: "IČO",
      cell: ({ row, getValue }) => {
        const [isEditing, setIsEditing] = useState(false);
        const [value, setValue] = useState(getValue());

        const onBlur = () => {
          setIsEditing(false);
          if (value !== getValue()) {
            updateProfile.mutate({
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
            updateProfile.mutate({
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
            updatePaidBy.mutate({
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
            updateRole.mutate({
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
              updateProfile.mutate({
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
              updateActive.mutate({
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
  ];

  const table = useReactTable({
    data: users ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (user?.role !== "admin") {
    return <div>Access denied. Admin only.</div>;
  }

  if (isLoading) return <div>Loading...</div>;

  return (
    <Card className="flex flex-col gap-4 my-0 p-4 print:border-none print:shadow-none print:absolute print:top-0 print:left-0 print:right-0 print:m-0 print:h-auto print:overflow-visible print:transform-none">
      <div className="flex flex-row gap-4">
        {user?.role === "admin" && (
          <Dialog open={openMobile} onOpenChange={setOpenMobile}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <CirclePlus className="h-4 w-4 mr-2" />
                Nový uživatel - mobil
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Vytvořit nového uživatele - mobil</DialogTitle>
                <DialogDescription>
                  Vyplňte formulář pro vytvoření nového uživatele s mobilním
                  přístupem.
                </DialogDescription>
              </DialogHeader>
              <CreateUserForm
                onSuccess={() => {
                  setOpenMobile(false);
                  queryClient.invalidateQueries({ queryKey: ["users"] });
                }}
              />
            </DialogContent>
          </Dialog>
        )}

        {user?.role === "admin" && (
          <Dialog open={openEmail} onOpenChange={setOpenEmail}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <CirclePlus className="h-4 w-4 mr-2" />
                Nový uživatel - email
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Vytvořit nového uživatele - email</DialogTitle>
                <DialogDescription>
                  Vyplňte formulář pro vytvoření nového uživatele s emailovým
                  přístupem.
                </DialogDescription>
              </DialogHeader>
              <Suspense fallback={<div>Loading...</div>}>
                <CreateUserEmailForm
                  onSuccess={() => {
                    setOpenEmail(false);
                    queryClient.invalidateQueries({ queryKey: ["users"] });
                  }}
                />
              </Suspense>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <CardHeader>
        <CardTitle>Admin Dashboard</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
