import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Container, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDriverUsers } from "@/hooks/useProfiles";
import {
  useCratesByDate,
  useUpsertCrates,
  calculateCrateStatsFromOrders,
  type CrateInput,
} from "@/hooks/useCrates";
import { Order } from "../../types";

interface CratesOverviewDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  orders: Order[];
  currentDate: string | null;
  period: string;
}

export function CratesOverviewDialog({
  isOpen,
  onOpenChange,
  orders,
  currentDate,
  period,
}: CratesOverviewDialogProps) {
  // Format date for display
  const formatDateForDisplay = (dateStr: string | null) => {
    if (!dateStr) return "Není vybráno";
    console.log("CratesOverviewDialog - formatting date:", dateStr);
    // Split by '-' and reverse to get DD.MM.YYYY format
    return dateStr.split("-").reverse().join(".");
  };

  // Debug logs for incoming props
  console.log("CratesOverviewDialog - received props:", {
    currentDate,
    period,
    ordersCount: orders?.length,
  });
  const [driverReceivedCrates, setDriverReceivedCrates] = useState<
    Record<string, { crateSmall: number; crateBig: number }>
  >({});
  const [driverManualCrates, setDriverManualCrates] = useState<
    Record<string, { crateSmall: number; crateBig: number }>
  >({});
  const [manualDrivers, setManualDrivers] = useState<
    Array<{ id: string; name: string; driver_id: string }>
  >([]);
  const [isSavingCrates, setIsSavingCrates] = useState(false);
  const [isAddingDriver, setIsAddingDriver] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState("");

  const { data: driverUsers } = useDriverUsers();
  const { data: existingCrates } = useCratesByDate(currentDate || "");
  const upsertCrates = useUpsertCrates();
  const { toast } = useToast();

  // Load existing crates data when dialog opens or date changes
  useEffect(() => {
    if (isOpen && currentDate) {
      const cratesMap: Record<
        string,
        { crateSmall: number; crateBig: number }
      > = {};

      const manualCratesMap: Record<
        string,
        { crateSmall: number; crateBig: number }
      > = {};

      // Initialize empty map for manually returned crates
      const driverStats = calculateCrateStatsFromOrders(orders || []);
      driverStats.forEach((driver) => {
        cratesMap[driver.driver_name] = {
          crateSmall: 0, // Start with 0 for manual returns
          crateBig: 0, // Start with 0 for manual returns
        };
      });

      // Then, load manually returned crates from database
      if (existingCrates) {
        existingCrates.forEach((crate) => {
          // Find driver name from orders
          const driver = orders?.find(
            (order) => order.driver?.id === crate.driver_id
          )?.driver;
          if (driver) {
            // For manually returned crates, we use the values directly from the database
            // These are the manually entered values, separate from order returns
            cratesMap[driver.full_name] = {
              crateSmall: crate.crate_small_received || 0,
              crateBig: crate.crate_big_received || 0,
            };

            // For manually issued crates
            manualCratesMap[driver.full_name] = {
              crateSmall: crate.crate_small_issued || 0,
              crateBig: crate.crate_big_issued || 0,
            };
          }
        });
      }

      setDriverReceivedCrates(cratesMap);
      setDriverManualCrates(manualCratesMap);
    }
  }, [isOpen, existingCrates, currentDate, orders]);

  // Add new manual driver
  const handleAddDriver = () => {
    if (!selectedDriverId) return;

    const selectedDriver = driverUsers?.find(
      (driver) => driver.id === selectedDriverId
    );
    if (!selectedDriver) return;

    // Check if driver is already added
    const isAlreadyAdded = manualDrivers.some(
      (driver) => driver.driver_id === selectedDriverId
    );
    if (isAlreadyAdded) return;

    const newDriver = {
      id: `manual-${Date.now()}`,
      name: selectedDriver.full_name,
      driver_id: selectedDriver.id,
    };

    setManualDrivers((prev) => [...prev, newDriver]);
    setSelectedDriverId("");
    setIsAddingDriver(false);
  };

  // Remove manual driver
  const handleRemoveDriver = (driverId: string) => {
    setManualDrivers((prev) => prev.filter((driver) => driver.id !== driverId));
    // Clean up associated data
    const driverName = manualDrivers.find((d) => d.id === driverId)?.name;
    if (driverName) {
      setDriverReceivedCrates((prev) => {
        const newData = { ...prev };
        delete newData[driverName];
        return newData;
      });
      setDriverManualCrates((prev) => {
        const newData = { ...prev };
        delete newData[driverName];
        return newData;
      });
    }
  };

  // Save crates data
  const handleSaveCrates = async () => {
    if (!orders || orders.length === 0) return;

    setIsSavingCrates(true);
    try {
      const cratesToSave: CrateInput[] = [];

      // Get driver stats from orders
      const driverStats = calculateCrateStatsFromOrders(orders || []);

      // Create crate records for each driver from orders
      driverStats.forEach((driver) => {
        const manualData = driverReceivedCrates[driver.driver_name];
        const manualInsertedData = driverManualCrates[driver.driver_name];

        // Use the current date directly
        const dateToSave = currentDate || format(new Date(), "yyyy-MM-dd");

        cratesToSave.push({
          date: dateToSave,
          driver_id: driver.driver_id,
          crate_small_issued:
            driver.crate_small_issued + (manualInsertedData?.crateSmall || 0),
          crate_big_issued:
            driver.crate_big_issued + (manualInsertedData?.crateBig || 0),
          crate_small_received:
            manualData?.crateSmall || driver.crate_small_received,
          crate_big_received: manualData?.crateBig || driver.crate_big_received,
        });
      });

      // Create crate records for manual drivers
      manualDrivers.forEach((driver) => {
        const manualData = driverReceivedCrates[driver.name];
        const manualInsertedData = driverManualCrates[driver.name];

        // Use the current date directly
        const dateToSave = currentDate || format(new Date(), "yyyy-MM-dd");

        cratesToSave.push({
          date: dateToSave,
          driver_id: driver.driver_id,
          crate_small_issued: manualInsertedData?.crateSmall || 0,
          crate_big_issued: manualInsertedData?.crateBig || 0,
          crate_small_received: manualData?.crateSmall || 0,
          crate_big_received: manualData?.crateBig || 0,
        });
      });

      await upsertCrates.mutateAsync(cratesToSave);

      // Show success message
      toast({
        title: "Úspěch",
        description: "Data o přepravkách byla uložena",
      });
    } catch (error) {
      console.error("Error saving crates:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se uložit data o přepravkách",
        variant: "destructive",
      });
    } finally {
      setIsSavingCrates(false);
    }
  };

  // Calculate driver stats from orders
  const calculateDriverStats = (orders: Order[]) => {
    const driverStats = new Map();

    orders.forEach((order) => {
      if (order.driver) {
        const driverId = order.driver.id;
        const driverName = order.driver.full_name;

        if (!driverStats.has(driverId)) {
          driverStats.set(driverId, {
            name: driverName,
            driver_id: driverId,
            driver_name: driverName,
            crateSmall: 0,
            crateBig: 0,
            crateSmallReceived: 0,
            crateBigReceived: 0,
            crate_small_issued: 0,
            crate_big_issued: 0,
            crate_small_received: 0,
            crate_big_received: 0,
          });
        }

        const stats = driverStats.get(driverId);
        stats.crateSmall += order.crateSmall || 0;
        stats.crateBig += order.crateBig || 0;
        stats.crateSmallReceived += order.crateSmallReceived || 0;
        stats.crateBigReceived += order.crateBigReceived || 0;
        stats.crate_small_issued += order.crateSmall || 0;
        stats.crate_big_issued += order.crateBig || 0;
        stats.crate_small_received += order.crateSmallReceived || 0;
        stats.crate_big_received += order.crateBigReceived || 0;
      } else {
        // Handle orders without drivers
        const noDriverId = "no-driver";
        const noDriverName = "Bez řidiče";

        if (!driverStats.has(noDriverId)) {
          driverStats.set(noDriverId, {
            name: noDriverName,
            driver_id: noDriverId,
            driver_name: noDriverName,
            crateSmall: 0,
            crateBig: 0,
            crateSmallReceived: 0,
            crateBigReceived: 0,
            crate_small_issued: 0,
            crate_big_issued: 0,
            crate_small_received: 0,
            crate_big_received: 0,
          });
        }

        const stats = driverStats.get(noDriverId);
        stats.crateSmall += order.crateSmall || 0;
        stats.crateBig += order.crateBig || 0;
        stats.crateSmallReceived += order.crateSmallReceived || 0;
        stats.crateBigReceived += order.crateBigReceived || 0;
        stats.crate_small_issued += order.crateSmall || 0;
        stats.crate_big_issued += order.crateBig || 0;
        stats.crate_small_received += order.crateSmallReceived || 0;
        stats.crate_big_received += order.crateBigReceived || 0;
      }
    });

    return Array.from(driverStats.values()).sort((a, b) => {
      // Put "Bez řidiče" at the end
      if (a.name === "Bez řidiče") return 1;
      if (b.name === "Bez řidiče") return -1;
      return a.name.localeCompare(b.name, "cs");
    });
  };

  const driverStats = useMemo(() => calculateDriverStats(orders), [orders]);

  // Calculate totals for each column
  const totals = useMemo(() => {
    const regularDrivers = driverStats;
    const allDrivers = [
      ...regularDrivers,
      ...manualDrivers.map((d) => ({ name: d.name, driver_id: d.driver_id })),
    ];

    return {
      manualIssuedSmall: allDrivers.reduce(
        (sum, driver) =>
          sum + (driverManualCrates[driver.name]?.crateSmall || 0),
        0
      ),
      manualIssuedBig: allDrivers.reduce(
        (sum, driver) => sum + (driverManualCrates[driver.name]?.crateBig || 0),
        0
      ),
      electronicIssuedSmall: regularDrivers.reduce(
        (sum, driver) => sum + (driver.crateSmall || 0),
        0
      ),
      electronicIssuedBig: regularDrivers.reduce(
        (sum, driver) => sum + (driver.crateBig || 0),
        0
      ),
      electronicReceivedSmall: regularDrivers.reduce(
        (sum, driver) => sum + (driver.crateSmallReceived || 0),
        0
      ),
      electronicReceivedBig: regularDrivers.reduce(
        (sum, driver) => sum + (driver.crateBigReceived || 0),
        0
      ),
      manualReceivedSmall: allDrivers.reduce(
        (sum, driver) =>
          sum + (driverReceivedCrates[driver.name]?.crateSmall || 0),
        0
      ),
      manualReceivedBig: allDrivers.reduce(
        (sum, driver) =>
          sum + (driverReceivedCrates[driver.name]?.crateBig || 0),
        0
      ),
      totalReceivedSmall: allDrivers.reduce((sum, driver) => {
        const manualReceived =
          driverReceivedCrates[driver.name]?.crateSmall || 0;
        const electronicReceived =
          regularDrivers.find((d) => d.name === driver.name)
            ?.crateSmallReceived || 0;
        return sum + manualReceived + electronicReceived;
      }, 0),
      totalReceivedBig: allDrivers.reduce((sum, driver) => {
        const manualReceived = driverReceivedCrates[driver.name]?.crateBig || 0;
        const electronicReceived =
          regularDrivers.find((d) => d.name === driver.name)
            ?.crateBigReceived || 0;
        return sum + manualReceived + electronicReceived;
      }, 0),
    };
  }, [driverStats, manualDrivers, driverManualCrates, driverReceivedCrates]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Přehled přepravek - řidičů - {period}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {currentDate
                  ? `Datum: ${formatDateForDisplay(currentDate)}`
                  : "Vyberte datum pro uložení dat"}
              </div>
              {!isAddingDriver ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingDriver(true)}
                  className="text-green-600 border-green-600 hover:bg-green-50"
                >
                  + Přidat řidiče
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedDriverId}
                    onValueChange={setSelectedDriverId}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Vyberte řidiče" />
                    </SelectTrigger>
                    <SelectContent>
                      {driverUsers
                        ?.filter(
                          (driver) =>
                            !manualDrivers.some(
                              (manual) => manual.driver_id === driver.id
                            ) &&
                            !driverStats.some(
                              (orderDriver) =>
                                orderDriver.driver_id === driver.id
                            )
                        )
                        .map((driver) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            {driver.full_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={handleAddDriver}
                    disabled={!selectedDriverId}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Přidat
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsAddingDriver(false);
                      setSelectedDriverId("");
                    }}
                  >
                    Zrušit
                  </Button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const printWindow = window.open("", "_blank");
                  if (printWindow) {
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Přehled přepravek - ${formatDateForDisplay(currentDate)}</title>
                          <style>
                            @page { size: A4 landscape; margin: 1cm; }
                            body { font-family: Arial, sans-serif; font-size: 12px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
                            th { background-color: #f5f5f5; font-weight: bold; }
                            .text-center { text-align: center; }
                            .font-medium { font-weight: 500; }
                            .bg-green-50 { background-color: #f0fdf4; }
                            .text-green-600 { color: #16a34a; }
                            .text-red-600 { color: #dc2626; }
                            .text-yellow-700 { color: #a16207; }
                            .text-red-800 { color: #991b1b; }
                            .text-gray-700 { color: #374151; }
                            .border-green-700 { border-color: #15803d; }
                            .border-red-700 { border-color: #b91c1c; }
                            .border-yellow-700 { border-color: #a16207; }
                            .border-red-800 { border-color: #991b1b; }
                            .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; border: 1px solid; font-size: 11px; }
                            .badge-outline { background-color: transparent; }
                            .badge-secondary { background-color: #f1f5f9; }
                            .input { width: 40px; text-align: center; border: 1px solid #d1d5db; padding: 2px; }
                            .header { text-align: center; margin-bottom: 20px; }
                            .date-info { margin-bottom: 10px; color: #6b7280; }
                          </style>
                        </head>
                        <body>
                          <div class="header">
                            <h1>Přehled přepravek - řidičů</h1>
                            <div class="date-info">Datum: ${formatDateForDisplay(currentDate)}</div>
                          </div>
                          <table>
                            <thead>
                              <tr>
                                <th>Řidič</th>
                                <th class="text-center">Ostaní vydané přepr.</th>
                                <th class="text-center">Vydané přep. e.DL</th>
                                <th class="text-center">Celkem vydané</th>
                                <th class="text-center">Vrácené přep. e.DL</th>
                                <th class="text-center">Vrácené přep. ručně</th>
                                <th class="text-center">Celkem vrácené</th>
                                <th class="text-center">Rozdíl</th>
                              </tr>
                              <tr style="background-color: #f3f4f6; font-weight: bold;">
                                <td class="font-semibold">CELKEM:</td>
                                <td class="text-center">
                                  ${(() => {
                                    if (
                                      totals.manualIssuedSmall === 0 &&
                                      totals.manualIssuedBig === 0
                                    )
                                      return "-";
                                    return `${totals.manualIssuedSmall} M / ${totals.manualIssuedBig} V`;
                                  })()}
                                </td>
                                <td class="text-center">
                                  ${totals.electronicIssuedSmall} M / ${totals.electronicIssuedBig} V
                                </td>
                                <td class="text-center">
                                  ${(() => {
                                    const totalSmall =
                                      totals.manualIssuedSmall +
                                      totals.electronicIssuedSmall;
                                    const totalBig =
                                      totals.manualIssuedBig +
                                      totals.electronicIssuedBig;
                                    return `${totalSmall} M / ${totalBig} V`;
                                  })()}
                                </td>
                                <td class="text-center">
                                  ${totals.electronicReceivedSmall} M / ${totals.electronicReceivedBig} V
                                </td>
                                <td class="text-center">
                                  ${(() => {
                                    if (
                                      totals.manualReceivedSmall === 0 &&
                                      totals.manualReceivedBig === 0
                                    )
                                      return "-";
                                    return `${totals.manualReceivedSmall} M / ${totals.manualReceivedBig} V`;
                                  })()}
                                </td>
                                <td class="text-center">
                                  ${totals.totalReceivedSmall} M / ${totals.totalReceivedBig} V
                                </td>
                                <td class="text-center">
                                  ${(() => {
                                    const totalIssuedSmall =
                                      totals.manualIssuedSmall +
                                      totals.electronicIssuedSmall;
                                    const totalIssuedBig =
                                      totals.manualIssuedBig +
                                      totals.electronicIssuedBig;
                                    const diffSmall =
                                      totalIssuedSmall -
                                      totals.totalReceivedSmall;
                                    const diffBig =
                                      totalIssuedBig - totals.totalReceivedBig;
                                    return `${diffSmall > 0 ? `-${diffSmall}` : diffSmall < 0 ? `+${Math.abs(diffSmall)}` : diffSmall} M / ${diffBig > 0 ? `-${diffBig}` : diffBig < 0 ? `+${Math.abs(diffBig)}` : diffBig} V`;
                                  })()}
                                </td>
                              </tr>
                            </thead>
                            <tbody>
                              ${driverStats
                                .map(
                                  (driver) => `
                                <tr${driver.name === "Bez řidiče" ? ' style="background-color: #fef3c7;"' : ""}>
                                  <td class="font-medium${driver.name === "Bez řidiče" ? " text-amber-600" : ""}">${driver.name}</td>
                                  <td class="text-center">
                                    ${(() => {
                                      const manualSmall =
                                        driverManualCrates[driver.name]
                                          ?.crateSmall || 0;
                                      const manualBig =
                                        driverManualCrates[driver.name]
                                          ?.crateBig || 0;
                                      if (manualSmall === 0 && manualBig === 0)
                                        return "-";
                                      return `${manualSmall} M / ${manualBig} V`;
                                    })()}
                                  </td>
                                  <td class="text-center">
                                    ${driver.crateSmall} M / ${driver.crateBig} V
                                  </td>
                                  <td class="text-center">
                                    ${(() => {
                                      const manualSmall =
                                        driverManualCrates[driver.name]
                                          ?.crateSmall || 0;
                                      const manualBig =
                                        driverManualCrates[driver.name]
                                          ?.crateBig || 0;
                                      const totalSmall =
                                        manualSmall + driver.crateSmall;
                                      const totalBig =
                                        manualBig + driver.crateBig;
                                      return `${totalSmall} M / ${totalBig} V`;
                                    })()}
                                  </td>
                                  <td class="text-center">
                                    ${driver.crateSmallReceived} M / ${driver.crateBigReceived} V
                                  </td>
                                  <td class="text-center">
                                    ${(() => {
                                      const manualSmall =
                                        driverReceivedCrates[driver.name]
                                          ?.crateSmall || 0;
                                      const manualBig =
                                        driverReceivedCrates[driver.name]
                                          ?.crateBig || 0;
                                      if (manualSmall === 0 && manualBig === 0)
                                        return "-";
                                      return `${manualSmall} M / ${manualBig} V`;
                                    })()}
                                  </td>
                                  <td class="text-center">
                                    ${driverReceivedCrates[driver.name]?.crateSmall || 0}${driver.crateSmallReceived > 0 ? ` (${driver.crateSmallReceived})` : ""} M / ${driverReceivedCrates[driver.name]?.crateBig || 0}${driver.crateBigReceived > 0 ? ` (${driver.crateBigReceived})` : ""} V
                                  </td>
                                  <td class="text-center">
                                    ${(() => {
                                      const totalIssuedSmall =
                                        driver.crateSmall +
                                        (driverManualCrates[driver.name]
                                          ?.crateSmall || 0);
                                      const totalIssuedBig =
                                        driver.crateBig +
                                        (driverManualCrates[driver.name]
                                          ?.crateBig || 0);
                                      const totalReceivedSmall =
                                        (driverReceivedCrates[driver.name]
                                          ?.crateSmall || 0) +
                                        (driver.crateSmallReceived || 0);
                                      const totalReceivedBig =
                                        (driverReceivedCrates[driver.name]
                                          ?.crateBig || 0) +
                                        (driver.crateBigReceived || 0);
                                      const diffSmall =
                                        totalIssuedSmall - totalReceivedSmall;
                                      const diffBig =
                                        totalIssuedBig - totalReceivedBig;
                                      return `${diffSmall > 0 ? `-${diffSmall}` : diffSmall < 0 ? `+${Math.abs(diffSmall)}` : diffSmall} M / ${diffBig > 0 ? `-${diffBig}` : diffBig < 0 ? `+${Math.abs(diffBig)}` : diffBig} V`;
                                    })()}
                                  </td>
                                </tr>
                              `
                                )
                                .join("")}
                              ${manualDrivers
                                .map(
                                  (driver) => `
                                <tr class="bg-green-50">
                                  <td class="font-medium text-green-600">${driver.name} (ručně přidaný)</td>
                                  <td class="text-center">
                                    ${(() => {
                                      const manualSmall =
                                        driverManualCrates[driver.name]
                                          ?.crateSmall || 0;
                                      const manualBig =
                                        driverManualCrates[driver.name]
                                          ?.crateBig || 0;
                                      if (manualSmall === 0 && manualBig === 0)
                                        return "-";
                                      return `${manualSmall} M / ${manualBig} V`;
                                    })()}
                                  </td>
                                  <td class="text-center">
                                    0 M / 0 V
                                  </td>
                                  <td class="text-center">
                                    ${(() => {
                                      const manualSmall =
                                        driverManualCrates[driver.name]
                                          ?.crateSmall || 0;
                                      const manualBig =
                                        driverManualCrates[driver.name]
                                          ?.crateBig || 0;
                                      return `${manualSmall} M / ${manualBig} V`;
                                    })()}
                                  </td>
                                  <td class="text-center">
                                    0 M / 0 V
                                  </td>
                                  <td class="text-center">
                                    ${(() => {
                                      const manualSmall =
                                        driverReceivedCrates[driver.name]
                                          ?.crateSmall || 0;
                                      const manualBig =
                                        driverReceivedCrates[driver.name]
                                          ?.crateBig || 0;
                                      if (manualSmall === 0 && manualBig === 0)
                                        return "-";
                                      return `${manualSmall} M / ${manualBig} V`;
                                    })()}
                                  </td>
                                  <td class="text-center">
                                    ${driverReceivedCrates[driver.name]?.crateSmall || 0} M / ${driverReceivedCrates[driver.name]?.crateBig || 0} V
                                  </td>
                                  <td class="text-center">
                                    ${(() => {
                                      const totalIssuedSmall =
                                        driverManualCrates[driver.name]
                                          ?.crateSmall || 0;
                                      const totalIssuedBig =
                                        driverManualCrates[driver.name]
                                          ?.crateBig || 0;
                                      const totalReceivedSmall =
                                        driverReceivedCrates[driver.name]
                                          ?.crateSmall || 0;
                                      const totalReceivedBig =
                                        driverReceivedCrates[driver.name]
                                          ?.crateBig || 0;
                                      const diffSmall =
                                        totalIssuedSmall - totalReceivedSmall;
                                      const diffBig =
                                        totalIssuedBig - totalReceivedBig;
                                      return `${diffSmall > 0 ? `-${diffSmall}` : diffSmall < 0 ? `+${Math.abs(diffSmall)}` : diffSmall} M / ${diffBig > 0 ? `-${diffBig}` : diffBig < 0 ? `+${Math.abs(diffBig)}` : diffBig} V`;
                                    })()}
                                  </td>
                                </tr>
                              `
                                )
                                .join("")}
                              ${
                                driverStats.length === 0 &&
                                manualDrivers.length === 0
                                  ? `
                                <tr>
                                  <td colspan="7" class="text-center text-gray-500">Žádní řidiči nenalezeni</td>
                                </tr>
                              `
                                  : ""
                              }
                            </tbody>
                          </table>
                          <div style="margin-top: 20px; text-align: right; font-size: 10px; color: #6b7280;">
                            Vytištěno: ${new Date().toLocaleString("cs-CZ")}
                          </div>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                    printWindow.print();
                  }
                }}
                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
              >
                <Printer className="h-4 w-4 mr-2" />
                Tisk
              </Button>
              <Button
                onClick={handleSaveCrates}
                disabled={!orders || orders.length === 0 || isSavingCrates}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isSavingCrates ? "Ukládám..." : "Uložit data"}
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Řidič</TableHead>
                  <TableHead className="text-center">
                    Ostaní vydané přepr.
                  </TableHead>
                  <TableHead className="text-center">
                    Vydané přepravky e.DL
                  </TableHead>
                  <TableHead className="text-center">Celkem vydané</TableHead>
                  <TableHead className="text-center">
                    Vrácené přepravky e.DL
                  </TableHead>
                  <TableHead className="text-center">
                    Vrácené přepravky ručně zadané
                  </TableHead>
                  <TableHead className="text-center">Celkem vrácené</TableHead>
                  <TableHead className="text-center">Rozdíl</TableHead>
                </TableRow>
                <TableRow className="bg-gray-100 font-semibold">
                  <TableCell className="font-semibold">CELKEM:</TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-2">
                      <Badge variant="outline" className="text-yellow-700">
                        {totals.manualIssuedSmall}
                        <Container size={16} className="ml-1" />
                      </Badge>
                      <Badge variant="outline" className="text-red-800">
                        {totals.manualIssuedBig}
                        <Container size={20} className="ml-1" />
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-2">
                      <Badge variant="outline" className="text-yellow-700">
                        {totals.electronicIssuedSmall}
                        <Container size={16} className="ml-1" />
                      </Badge>
                      <Badge variant="outline" className="text-red-800">
                        {totals.electronicIssuedBig}
                        <Container size={20} className="ml-1" />
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-2">
                      <Badge variant="outline" className="text-yellow-700">
                        {totals.manualIssuedSmall +
                          totals.electronicIssuedSmall}
                        <Container size={16} className="ml-1" />
                      </Badge>
                      <Badge variant="outline" className="text-red-800">
                        {totals.manualIssuedBig + totals.electronicIssuedBig}
                        <Container size={20} className="ml-1" />
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-2">
                      <Badge variant="secondary" className="text-yellow-700">
                        {totals.electronicReceivedSmall}
                        <Container size={16} className="ml-1" />
                      </Badge>
                      <Badge variant="secondary" className="text-red-800">
                        {totals.electronicReceivedBig}
                        <Container size={20} className="ml-1" />
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-2">
                      <Badge variant="outline" className="text-yellow-700">
                        {totals.manualReceivedSmall}
                        <Container size={16} className="ml-1" />
                      </Badge>
                      <Badge variant="outline" className="text-red-800">
                        {totals.manualReceivedBig}
                        <Container size={20} className="ml-1" />
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-2">
                      <Badge variant="secondary" className="text-yellow-700">
                        {totals.totalReceivedSmall}
                        <Container size={16} className="ml-1" />
                      </Badge>
                      <Badge variant="secondary" className="text-red-800">
                        {totals.totalReceivedBig}
                        <Container size={20} className="ml-1" />
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-2">
                      <Badge variant="outline" className="text-yellow-700">
                        {(() => {
                          const totalIssuedSmall =
                            totals.manualIssuedSmall +
                            totals.electronicIssuedSmall;
                          const diffSmall =
                            totalIssuedSmall - totals.totalReceivedSmall;
                          return diffSmall > 0
                            ? `-${diffSmall}`
                            : diffSmall < 0
                              ? `+${Math.abs(diffSmall)}`
                              : diffSmall;
                        })()}
                        <Container size={16} className="ml-1" />
                      </Badge>
                      <Badge variant="outline" className="text-red-800">
                        {(() => {
                          const totalIssuedBig =
                            totals.manualIssuedBig + totals.electronicIssuedBig;
                          const diffBig =
                            totalIssuedBig - totals.totalReceivedBig;
                          return diffBig > 0
                            ? `-${diffBig}`
                            : diffBig < 0
                              ? `+${Math.abs(diffBig)}`
                              : diffBig;
                        })()}
                        <Container size={20} className="ml-1" />
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Regular drivers from orders */}
                {driverStats.map((driver, index) => (
                  <TableRow
                    key={index}
                    className={
                      driver.name === "Bez řidiče" ? "bg-amber-50" : ""
                    }
                  >
                    <TableCell
                      className={`font-medium ${driver.name === "Bez řidiče" ? "text-amber-600" : ""}`}
                    >
                      {driver.name}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          className="w-16 h-8 text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                          value={
                            driverManualCrates[driver.name]?.crateSmall || 0
                          }
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setDriverManualCrates((prev) => ({
                              ...prev,
                              [driver.name]: {
                                ...prev[driver.name],
                                crateSmall: value,
                                crateBig: prev[driver.name]?.crateBig || 0,
                              },
                            }));
                          }}
                        />
                        <Input
                          type="number"
                          min="0"
                          className="w-16 h-8 text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                          value={driverManualCrates[driver.name]?.crateBig || 0}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setDriverManualCrates((prev) => ({
                              ...prev,
                              [driver.name]: {
                                ...prev[driver.name],
                                crateSmall: prev[driver.name]?.crateSmall || 0,
                                crateBig: value,
                              },
                            }));
                          }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Badge variant="outline" className="text-yellow-700">
                          {driver.crateSmall}
                          <Container size={16} className="ml-1" />
                        </Badge>
                        <Badge variant="outline" className="text-red-800">
                          {driver.crateBig}
                          <Container size={20} className="ml-1" />
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Badge variant="outline" className="text-yellow-700">
                          {(driverManualCrates[driver.name]?.crateSmall || 0) +
                            driver.crateSmall}
                          <Container size={16} className="ml-1" />
                        </Badge>
                        <Badge variant="outline" className="text-red-800">
                          {(driverManualCrates[driver.name]?.crateBig || 0) +
                            driver.crateBig}
                          <Container size={20} className="ml-1" />
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Badge variant="secondary" className="text-yellow-700">
                          {driver.crateSmallReceived}
                          <Container size={16} className="ml-1" />
                        </Badge>
                        <Badge variant="secondary" className="text-red-800">
                          {driver.crateBigReceived}
                          <Container size={20} className="ml-1" />
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          className="w-16 h-8 text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                          value={
                            driverReceivedCrates[driver.name]?.crateSmall || 0
                          }
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setDriverReceivedCrates((prev) => ({
                              ...prev,
                              [driver.name]: {
                                ...prev[driver.name],
                                crateSmall: value,
                                crateBig: prev[driver.name]?.crateBig || 0,
                              },
                            }));
                          }}
                        />
                        <Input
                          type="number"
                          min="0"
                          className="w-16 h-8 text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                          value={
                            driverReceivedCrates[driver.name]?.crateBig || 0
                          }
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setDriverReceivedCrates((prev) => ({
                              ...prev,
                              [driver.name]: {
                                ...prev[driver.name],
                                crateSmall: prev[driver.name]?.crateSmall || 0,
                                crateBig: value,
                              },
                            }));
                          }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Badge variant="secondary" className="text-yellow-700">
                          {driverReceivedCrates[driver.name]?.crateSmall || 0}
                          {driver.crateSmallReceived > 0 &&
                            ` (${driver.crateSmallReceived})`}
                          <Container size={16} className="ml-1" />
                        </Badge>
                        <Badge variant="secondary" className="text-red-800">
                          {driverReceivedCrates[driver.name]?.crateBig || 0}
                          {driver.crateBigReceived > 0 &&
                            ` (${driver.crateBigReceived})`}
                          <Container size={20} className="ml-1" />
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Badge
                          variant="outline"
                          className={`${
                            driver.crateSmall +
                              (driverManualCrates[driver.name]?.crateSmall ||
                                0) -
                              (driverReceivedCrates[driver.name]?.crateSmall ||
                                0) >
                            0
                              ? "text-red-700 border-red-700"
                              : driver.crateSmall +
                                    (driverManualCrates[driver.name]
                                      ?.crateSmall || 0) -
                                    (driverReceivedCrates[driver.name]
                                      ?.crateSmall || 0) <
                                  0
                                ? "text-green-700 border-green-700"
                                : "text-gray-700"
                          }`}
                        >
                          {(() => {
                            const totalIssuedSmall =
                              driver.crateSmall +
                              (driverManualCrates[driver.name]?.crateSmall ||
                                0);
                            const totalReceivedSmall =
                              (driverReceivedCrates[driver.name]?.crateSmall ||
                                0) + (driver.crateSmallReceived || 0);
                            const diffSmall =
                              totalIssuedSmall - totalReceivedSmall;
                            return diffSmall > 0
                              ? `-${diffSmall}`
                              : diffSmall < 0
                                ? `+${Math.abs(diffSmall)}`
                                : diffSmall;
                          })()}
                          <Container size={16} className="ml-1" />
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`${(() => {
                            const totalIssuedBig =
                              driver.crateBig +
                              (driverManualCrates[driver.name]?.crateBig || 0);
                            const totalReceivedBig =
                              (driverReceivedCrates[driver.name]?.crateBig ||
                                0) + (driver.crateBigReceived || 0);
                            const diffBig = totalIssuedBig - totalReceivedBig;
                            return diffBig > 0
                              ? "text-red-700 border-red-700"
                              : diffBig < 0
                                ? "text-green-700 border-green-700"
                                : "text-gray-700";
                          })()}`}
                        >
                          {(() => {
                            const totalIssuedBig =
                              driver.crateBig +
                              (driverManualCrates[driver.name]?.crateBig || 0);
                            const totalReceivedBig =
                              (driverReceivedCrates[driver.name]?.crateBig ||
                                0) + (driver.crateBigReceived || 0);
                            const diffBig = totalIssuedBig - totalReceivedBig;
                            return diffBig > 0
                              ? `-${diffBig}`
                              : diffBig < 0
                                ? `+${Math.abs(diffBig)}`
                                : diffBig;
                          })()}
                          <Container size={20} className="ml-1" />
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {/* Manual drivers */}
                {manualDrivers.map((driver) => (
                  <TableRow key={`manual-${driver.id}`} className="bg-green-50">
                    <TableCell className="font-medium flex items-center gap-2">
                      {driver.name}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveDriver(driver.id)}
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                      >
                        ×
                      </Button>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          className="w-16 h-8 text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                          value={
                            driverManualCrates[driver.name]?.crateSmall || 0
                          }
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setDriverManualCrates((prev) => ({
                              ...prev,
                              [driver.name]: {
                                ...prev[driver.name],
                                crateSmall: value,
                                crateBig: prev[driver.name]?.crateBig || 0,
                              },
                            }));
                          }}
                        />
                        <Input
                          type="number"
                          min="0"
                          className="w-16 h-8 text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                          value={driverManualCrates[driver.name]?.crateBig || 0}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setDriverManualCrates((prev) => ({
                              ...prev,
                              [driver.name]: {
                                ...prev[driver.name],
                                crateSmall: prev[driver.name]?.crateSmall || 0,
                                crateBig: value,
                              },
                            }));
                          }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Badge variant="outline" className="text-yellow-700">
                          0
                          <Container size={16} className="ml-1" />
                        </Badge>
                        <Badge variant="outline" className="text-red-800">
                          0
                          <Container size={20} className="ml-1" />
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Badge variant="outline" className="text-yellow-700">
                          {driverManualCrates[driver.name]?.crateSmall || 0}
                          <Container size={16} className="ml-1" />
                        </Badge>
                        <Badge variant="outline" className="text-red-800">
                          {driverManualCrates[driver.name]?.crateBig || 0}
                          <Container size={20} className="ml-1" />
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Badge variant="secondary" className="text-yellow-700">
                          0
                          <Container size={16} className="ml-1" />
                        </Badge>
                        <Badge variant="secondary" className="text-red-800">
                          0
                          <Container size={20} className="ml-1" />
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          className="w-16 h-8 text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                          value={
                            driverReceivedCrates[driver.name]?.crateSmall || 0
                          }
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setDriverReceivedCrates((prev) => ({
                              ...prev,
                              [driver.name]: {
                                ...prev[driver.name],
                                crateSmall: value,
                                crateBig: prev[driver.name]?.crateBig || 0,
                              },
                            }));
                          }}
                        />
                        <Input
                          type="number"
                          min="0"
                          className="w-16 h-8 text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                          value={
                            driverReceivedCrates[driver.name]?.crateBig || 0
                          }
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setDriverReceivedCrates((prev) => ({
                              ...prev,
                              [driver.name]: {
                                ...prev[driver.name],
                                crateSmall: prev[driver.name]?.crateSmall || 0,
                                crateBig: value,
                              },
                            }));
                          }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Badge variant="secondary" className="text-yellow-700">
                          {driverReceivedCrates[driver.name]?.crateSmall || 0}
                          <Container size={16} className="ml-1" />
                        </Badge>
                        <Badge variant="secondary" className="text-red-800">
                          {driverReceivedCrates[driver.name]?.crateBig || 0}
                          <Container size={20} className="ml-1" />
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Badge
                          variant="outline"
                          className={`${
                            (driverManualCrates[driver.name]?.crateSmall || 0) -
                              (driverReceivedCrates[driver.name]?.crateSmall ||
                                0) >
                            0
                              ? "text-red-700 border-red-700"
                              : (driverManualCrates[driver.name]?.crateSmall ||
                                    0) -
                                    (driverReceivedCrates[driver.name]
                                      ?.crateSmall || 0) <
                                  0
                                ? "text-green-700 border-green-700"
                                : "text-gray-700"
                          }`}
                        >
                          {(() => {
                            const diff =
                              (driverManualCrates[driver.name]?.crateSmall ||
                                0) -
                              (driverReceivedCrates[driver.name]?.crateSmall ||
                                0);
                            return diff > 0
                              ? `-${diff}`
                              : diff < 0
                                ? `+${Math.abs(diff)}`
                                : diff;
                          })()}
                          <Container size={16} className="ml-1" />
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`${
                            (driverManualCrates[driver.name]?.crateBig || 0) -
                              (driverReceivedCrates[driver.name]?.crateBig ||
                                0) >
                            0
                              ? "text-red-700 border-red-700"
                              : (driverManualCrates[driver.name]?.crateBig ||
                                    0) -
                                    (driverReceivedCrates[driver.name]
                                      ?.crateBig || 0) <
                                  0
                                ? "text-green-700 border-green-700"
                                : "text-gray-700"
                          }`}
                        >
                          {(() => {
                            const diff =
                              (driverManualCrates[driver.name]?.crateBig || 0) -
                              (driverReceivedCrates[driver.name]?.crateBig ||
                                0);
                            return diff > 0
                              ? `-${diff}`
                              : diff < 0
                                ? `+${Math.abs(diff)}`
                                : diff;
                          })()}
                          <Container size={20} className="ml-1" />
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {driverStats.length === 0 && manualDrivers.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground"
                    >
                      Žádní řidiči nenalezeni
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
