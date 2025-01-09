import { useAuthStore } from "../lib/supabase";

import { TableCell, TableHead } from "@/components/ui/table";

import { useState, useMemo, memo, useRef } from "react";
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
  updateCrateBig,
  updateCrateSmall,
  // updateNote,
  // updatePhone,
  updateOZ,
  updateMoPartners,
} from "@/hooks/useProfiles";

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
// import { useToast } from "@/hooks/use-toast";
import { useVirtualizer } from "@tanstack/react-virtual";
// import { ChevronRight, ChevronDown } from "lucide-react";
// import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useDebounce } from "@/hooks/useDebounce";

// 1. Memoize cell components more efficiently
const EditableCell = memo(
  ({
    user,
    getValue,
    fieldName,
  }: {
    user: any;
    getValue: () => string;
    fieldName: string;
  }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setLocalValue] = useState(getValue() || "");
    const updateProfileMutation = updateProfile();

    const onBlur = () => {
      setIsEditing(false);
      if (value !== (getValue() || "")) {
        updateProfileMutation.mutate({
          id: user.id,
          [fieldName]: value,
        });
      }
    };

    return isEditing ? (
      <Input
        value={value}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={onBlur}
        autoFocus
      />
    ) : (
      <div onDoubleClick={() => setIsEditing(true)}>{getValue() || "—"}</div>
    );
  }
);

// 2. Memoize filters
interface FilterSectionProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  roleFilter: string;
  setRoleFilter: (value: string) => void;
  paidByFilter: string;
  setPaidByFilter: (value: string) => void;
  activeFilter: string;
  setActiveFilter: (value: string) => void;
}

const FilterSection = memo(
  ({
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    paidByFilter,
    setPaidByFilter,
    activeFilter,
    setActiveFilter,
  }: FilterSectionProps) => (
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
  )
);

const CrateCell = memo(
  ({
    user,
    getValue,
    fieldName,
  }: {
    user: any;
    getValue: () => number;
    fieldName: string;
  }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(getValue());
    const updateCrateBigMutation = updateCrateBig();
    const updateCrateSmallMutation = updateCrateSmall();

    const onBlur = () => {
      setIsEditing(false);
      if (value !== getValue()) {
        if (fieldName === "crateBig") {
          updateCrateBigMutation.mutate({
            id: user.id,
            crateBig: value || 0,
          });
        } else {
          updateCrateSmallMutation.mutate({
            id: user.id,
            crateSmall: value || 0,
          });
        }
      }
    };

    return isEditing ? (
      <Input
        type="number"
        min="0"
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        onBlur={onBlur}
        autoFocus
      />
    ) : (
      <div onDoubleClick={() => setIsEditing(true)}>{getValue() ?? 0}</div>
    );
  }
);

export function AdminTable() {
  const user = useAuthStore((state) => state.user);
  const { data: users } = useUsers();
  // const { toast } = useToast();

  // Move mutation hooks inside component
  const updateOZMutation = updateOZ();
  const updateMoPartnersMutation = updateMoPartners();
  const updateActiveMutation = updateActive();
  const updatePaidByMutation = updatePaidBy();
  const updateRoleMutation = updateRole();
  const deleteUserMutation = deleteUser();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [roleFilter, setRoleFilter] = useState("all");
  const [paidByFilter, setPaidByFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  // Filter users without react-table
  const filteredUsers = useMemo(
    () =>
      (users ?? []).filter((user: any) => {
        if (debouncedSearch) {
          const searchTerm = debouncedSearch.toLowerCase();
          const matchesSearch = [
            user.full_name,
            user.ico,
            user.email,
            user.phone,
            user.address,
          ].some((field) => field?.toLowerCase().includes(searchTerm));

          if (!matchesSearch) return false;
        }

        if (roleFilter !== "all" && user.role !== roleFilter) return false;
        if (paidByFilter !== "all" && user.paid_by !== paidByFilter)
          return false;
        if (activeFilter !== "all") {
          const isActive = activeFilter === "true";
          if (user.active !== isActive) return false;
        }

        return true;
      }),
    [users, debouncedSearch, roleFilter, paidByFilter, activeFilter]
  );

  // Set up virtualizer
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredUsers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 5,
  });

  const gridClassName =
    "grid grid-cols-[200px_80px_190px_85px_80px_150px_60px_60px_100px_100px_60px_60px_60px_60px] gap-2 py-2 px-4 items-center border-b";

  if (user?.role !== "admin") {
    return <div>Access denied. Admin only.</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <FilterSection
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
        paidByFilter={paidByFilter}
        setPaidByFilter={setPaidByFilter}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
      />

      <div className="border rounded-md flex-1 flex flex-col overflow-hidden">
        {/* Fixed Header */}
        <div className="border-b bg-background">
          <div className={gridClassName}>
            <TableHead>Name</TableHead>
            <TableHead>IČO</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Note</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Crates Big</TableHead>
            <TableHead>Crates Small</TableHead>
            <TableHead>Typ platby</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>OZ</TableHead>
            <TableHead>MO_P</TableHead>
            <TableHead>Active</TableHead>
            <TableHead>Actions</TableHead>
          </div>
        </div>

        {/* Scrollable Content */}
        <div ref={parentRef} className="flex-1 overflow-y-scroll relative">
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const user = filteredUsers[virtualRow.index];
              return (
                <div
                  key={user.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className={gridClassName}
                  style={{
                    position: "absolute",
                    top: `${virtualRow.start}px`,
                    left: 0,
                    width: "100%",
                  }}
                >
                  <TableCell>
                    <EditableCell
                      user={user}
                      getValue={() => user.full_name}
                      fieldName="full_name"
                    />
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      user={user}
                      getValue={() => user.ico}
                      fieldName="ico"
                    />
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <EditableCell
                      user={user}
                      getValue={() => user.phone}
                      fieldName="phone"
                    />
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      user={user}
                      getValue={() => user.note}
                      fieldName="note"
                    />
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      user={user}
                      getValue={() => user.address}
                      fieldName="address"
                    />
                  </TableCell>
                  <TableCell>
                    <CrateCell
                      user={user}
                      getValue={() => user.crateBig}
                      fieldName="crateBig"
                    />
                  </TableCell>
                  <TableCell>
                    <CrateCell
                      user={user}
                      getValue={() => user.crateSmall}
                      fieldName="crateSmall"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.paid_by}
                      onValueChange={(newValue: string) => {
                        updatePaidByMutation.mutate({
                          id: user.id,
                          paid_by: newValue,
                        });
                      }}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Hotově", "Příkazem", "-"].map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(newValue: UserRole) => {
                        updateRoleMutation.mutate({
                          id: user.id,
                          role: newValue,
                        });
                      }}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "user",
                          "buyer",
                          "driver",
                          "store",
                          "mobil",
                          "expedition",
                        ].map((role) => (
                          <SelectItem key={role} value={role}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={user.oz}
                      onCheckedChange={(checked) => {
                        updateOZMutation.mutate({
                          id: user.id,
                          oz: checked as boolean,
                        });
                      }}
                      className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                    />
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={user.mo_partners}
                      onCheckedChange={(checked) => {
                        updateMoPartnersMutation.mutate({
                          id: user.id,
                          mo_partners: checked as boolean,
                        });
                      }}
                      className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                    />
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={user.active}
                      onCheckedChange={(checked) => {
                        updateActiveMutation.mutate({
                          id: user.id,
                          active: checked as boolean,
                        });
                      }}
                      className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                    />
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
