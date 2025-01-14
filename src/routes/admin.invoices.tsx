import { UserSelect } from "@/components/UserSelect";
import { useState } from "react";
import { InvoiceGenerator } from "@/components/InvoiceGenerator";
import { createFileRoute } from "@tanstack/react-router";
import { InvoiceTable } from "@/components/InvoiceTable";

export const Route = createFileRoute("/admin/invoices")({
  component: InvoicesDashboard,
});

function InvoicesDashboard() {
  const [selectedUser, setSelectedUser] = useState<string>();

  return (
    <>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Generování faktur</h1>

        {/* Add user selection component */}
        <UserSelect onSelect={setSelectedUser} />

        {selectedUser && <InvoiceGenerator userId={selectedUser} />}
      </div>
      <div>
        <InvoiceTable />
      </div>
    </>
  );
}
