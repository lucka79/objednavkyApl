import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../lib/supabase";
import { Card, CardContent } from "@/components/ui/card";

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
import { useState, Suspense, lazy } from "react";

import { CreateUserEmailForm } from "@/components/CreateUserEmailForm";

// Lazy load the AdminTable for better performance
const AdminTable = lazy(() =>
  import("@/components/AdminTable").then((module) => ({
    default: module.AdminTable,
  }))
);

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const user = useAuthStore((state) => state.user);
  const [openMobile, setOpenMobile] = useState(false);
  const [openEmail, setOpenEmail] = useState(false);
  const queryClient = useQueryClient();

  if (user?.role !== "admin") {
    return <div>Access denied. Admin only.</div>;
  }

  return (
    <>
      <Card className="flex flex-col gap-4 my-0 p-4 min-h-0 h-[calc(100vh-2rem)] print:border-none print:shadow-none print:absolute print:top-0 print:left-0 print:right-0 print:m-0 print:h-auto print:overflow-visible print:transform-none">
        <div className="flex flex-row gap-4 flex-shrink-0 print:hidden">
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

        <CardContent className="flex-1 p-0 min-h-0">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64">
                Loading admin table...
              </div>
            }
          >
            <AdminTable />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}
