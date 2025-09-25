import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Filter } from "lucide-react";
import { useAuthStore } from "@/lib/supabase";
import { useUsers } from "@/hooks/useProfiles";
import { useTransfers } from "@/hooks/useTransfers";
import TransferForm from "./TransferForm";
import TransfersTable from "./TransfersTable";

export default function Transfers() {
  const { user } = useAuthStore();
  const {
    data: profiles = [],
    isLoading: profilesLoading,
    error: profilesError,
  } = useUsers();
  const { data: transfers = [] } = useTransfers();

  // Filter states
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [monthPeriod, setMonthPeriod] = useState<string>("");
  const [selectedSender, setSelectedSender] = useState<string>("");
  const [selectedReceiver, setSelectedReceiver] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Check if user is admin
  const isAdmin = user?.role === "admin";

  // Get unique senders and receivers from actual transfers
  const existingSenders = Array.from(
    new Set(transfers.map((transfer) => transfer.sender.id))
  );
  const existingReceivers = Array.from(
    new Set(transfers.map((transfer) => transfer.receiver.id))
  );

  // Filter profiles to only show those who have transfers
  const availableSenders = profiles.filter(
    (profile) =>
      profile?.id &&
      profile?.role &&
      ["store", "expedition"].includes(profile.role) &&
      existingSenders.includes(profile.id)
  );

  const availableReceivers = profiles.filter(
    (profile) =>
      profile?.id &&
      profile?.role &&
      ["user", "store", "expedition", "admin"].includes(profile.role) &&
      existingReceivers.includes(profile.id)
  );

  // Handle month period selection
  const handleMonthPeriodChange = (value: string) => {
    setMonthPeriod(value);
    if (value) {
      const now = new Date();
      const year = now.getFullYear();
      const month = parseInt(value);

      // Set date range for the selected month
      // month is 1-indexed (1=January, 9=September), but Date() uses 0-indexed months
      const startDate = new Date(year, month - 1, +2); // First day of selected month
      const endDate = new Date(year, month, +1); // Last day of selected month

      setDateFrom(startDate.toISOString().split("T")[0]);
      setDateTo(endDate.toISOString().split("T")[0]);
    } else {
      setDateFrom("");
      setDateTo("");
    }
  };

  // Handle downloading report
  const handleDownloadReport = () => {
    // First filter by user role
    const userTransfers = transfers.filter((transfer) => {
      // Admin sees all transfers
      if (user?.role === "admin") return true;

      // Other users only see transfers where they are sender or receiver
      return (
        user?.id &&
        (transfer.sender.id === user.id || transfer.receiver.id === user.id)
      );
    });

    // Then apply selected filters
    const filteredTransfers = userTransfers.filter((transfer) => {
      // Date filters
      const transferDate = new Date(transfer.date);
      const matchesDateFrom = !dateFrom || transferDate >= new Date(dateFrom);
      const matchesDateTo = !dateTo || transferDate <= new Date(dateTo);

      // Sender/Receiver filters
      const matchesSender =
        !selectedSender || transfer.sender.id === selectedSender;
      const matchesReceiver =
        !selectedReceiver || transfer.receiver.id === selectedReceiver;
      return (
        matchesDateFrom && matchesDateTo && matchesSender && matchesReceiver
      );
    });

    // Sum up ingredients across all transfers
    const ingredientSums = filteredTransfers.reduce<
      Record<
        number,
        { name: string; unit: string; quantity: number; kiloPerUnit: number }
      >
    >((sums, transfer) => {
      transfer.transfer_items.forEach((item) => {
        const key = item.ingredient.id;
        if (!sums[key]) {
          sums[key] = {
            name: item.ingredient.name,
            unit: item.ingredient.unit,
            quantity: 0,
            kiloPerUnit: item.ingredient.kiloPerUnit,
          };
        }
        sums[key].quantity += item.quantity;
      });
      return sums;
    }, {});

    // Get filter info
    const selectedSenderProfile = selectedSender
      ? profiles.find(
          (p) => p.id === selectedSender || p.id.toString() === selectedSender
        )
      : null;
    const selectedSenderName = selectedSenderProfile
      ? selectedSenderProfile.full_name || selectedSenderProfile.username
      : "Všichni";

    const selectedReceiverProfile = selectedReceiver
      ? profiles.find(
          (p) =>
            p.id === selectedReceiver || p.id.toString() === selectedReceiver
        )
      : null;
    const selectedReceiverName = selectedReceiverProfile
      ? selectedReceiverProfile.full_name || selectedReceiverProfile.username
      : "Všichni";
    const periodText =
      dateFrom && dateTo
        ? `${new Date(dateFrom).toLocaleDateString("cs-CZ")} - ${new Date(dateTo).toLocaleDateString("cs-CZ")}`
        : "Celé období";

    // Create CSV content
    const csvContent = [
      // Report info
      ["Období:", periodText].join(","),
      ["Odesílatel:", selectedSenderName].join(","),
      ["Příjemce:", selectedReceiverName].join(","),
      [""].join(","), // Empty line
      // Header row
      ["Surovina", "Množství", "Jednotka", "Hmotnost (kg)"].join(","),
      // Data rows
      ...Object.values(ingredientSums).map((item) =>
        [
          item.name,
          item.quantity.toFixed(3),
          item.unit,
          (item.quantity * item.kiloPerUnit).toFixed(3),
        ].join(",")
      ),
    ].join("\n");

    // Create and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `prevody-souhrn-${dateFrom || "all"}-${dateTo || "all"}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Clear all filters
  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setMonthPeriod("");
    setSelectedSender("");
    setSelectedReceiver("");
  };

  // Filter object to pass to TransfersTable
  const filters = {
    dateFrom,
    dateTo,
    senderId: selectedSender,
    receiverId: selectedReceiver,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Objednávky / Převodky surovin
          </h1>
          <p className="text-muted-foreground">
            Zobrazují se všechny objednávky surovin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filtry
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadReport}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Stáhnout report
              </Button>
            </>
          )}
          <TransferForm />
        </div>
      </div>

      {/* Admin Filters */}
      {isAdmin && showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtry pro report
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profilesLoading ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground">Načítání uživatelů...</p>
              </div>
            ) : profilesError ? (
              <div className="text-center py-4">
                <p className="text-red-500">Chyba při načítání uživatelů</p>
              </div>
            ) : (
              <>
                <div className="space-y-6">
                  {/* Month Period Filter */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Měsíc</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={monthPeriod === "" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleMonthPeriodChange("")}
                      >
                        Všechny měsíce
                      </Button>
                      {Array.from({ length: 12 }, (_, i) => {
                        const month = i + 1;
                        const monthNames = [
                          "Leden",
                          "Únor",
                          "Březen",
                          "Duben",
                          "Květen",
                          "Červen",
                          "Červenec",
                          "Srpen",
                          "Září",
                          "Říjen",
                          "Listopad",
                          "Prosinec",
                        ];
                        return (
                          <Button
                            key={month}
                            variant={
                              monthPeriod === month.toString()
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            onClick={() =>
                              handleMonthPeriodChange(month.toString())
                            }
                          >
                            {monthNames[i]}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Date Range Filter */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Datum</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        placeholder="Datum od"
                        className="w-auto"
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        placeholder="Datum do"
                        className="w-auto"
                      />
                    </div>
                  </div>

                  {/* Sender Filter */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Odesílatel</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={selectedSender === "" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedSender("")}
                      >
                        Všichni odesílatelé
                      </Button>
                      {availableSenders.map((profile) => (
                        <Button
                          key={profile.id}
                          variant={
                            selectedSender === profile.id
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => setSelectedSender(profile.id)}
                        >
                          {profile.full_name || profile.username}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Receiver Filter */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Příjemce</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={
                          selectedReceiver === "" ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => setSelectedReceiver("")}
                      >
                        Všichni příjemci
                      </Button>
                      {availableReceivers.map((profile) => (
                        <Button
                          key={profile.id}
                          variant={
                            selectedReceiver === profile.id
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => setSelectedReceiver(profile.id)}
                        >
                          {profile.full_name || profile.username}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Filter Actions */}
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={clearFilters}>
                    Vymazat filtry
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6">
        <TransfersTable filters={filters} />
      </div>
    </div>
  );
}
