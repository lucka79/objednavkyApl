import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";
import TransferForm from "./TransferForm";
import TransfersTable from "./TransfersTable";

export default function Transfers() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transfers</h1>
          <p className="text-muted-foreground">
            Manage ingredient transfers between users
          </p>
        </div>
        <TransferForm />
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Transfer Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TransfersTable />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
