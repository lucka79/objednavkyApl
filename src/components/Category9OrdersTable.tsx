import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrdersWithCategory9 } from "@/hooks/useOrders";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderItem } from "../../types";
import { Printer, CalendarIcon } from "lucide-react";
import { Button } from "./ui/button";
import { ThermalPrinterService } from "@/services/ThermalPrinterService";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Category9OrderDetails } from "./Category9OrderDetails";

const filterOrdersByDate = (
  orders: any[],
  period: "tomorrow" | "afterTomorrow" | "week" | "month" | "specific",
  specificDate?: Date
) => {
  if (period === "specific" && specificDate) {
    return orders.filter((order) => {
      const orderDate = new Date(order.date);
      return orderDate.toDateString() === specificDate.toDateString();
    });
  }

  const now = new Date();

  return orders.filter((order) => {
    const orderDate = new Date(order.date);

    switch (period) {
      case "tomorrow":
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return orderDate.toDateString() === tomorrow.toDateString();

      case "afterTomorrow":
        const afterTomorrow = new Date(now);
        afterTomorrow.setDate(afterTomorrow.getDate() + 2);
        return orderDate.toDateString() === afterTomorrow.toDateString();

      case "week":
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return orderDate >= weekStart && orderDate <= weekEnd;

      case "month":
        return (
          orderDate.getMonth() === now.getMonth() &&
          orderDate.getFullYear() === now.getFullYear()
        );
    }
  });
};

const calculateProductTotals = (orders: any[]) => {
  const totals = new Map<string, { name: string; quantity: number }>();

  orders.forEach((order) => {
    order.order_items
      .filter((item: OrderItem) => item.product.category_id === 9)
      .forEach((item: OrderItem) => {
        const existing = totals.get(item.product.id.toString());
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          totals.set(item.product.id.toString(), {
            name: item.product.name,
            quantity: item.quantity,
          });
        }
      });
  });

  return Array.from(totals.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
};

const calculateDriverTotals = (orders: any[]) => {
  const driverTotals = new Map<
    string,
    {
      driverName: string;
      products: Map<string, { name: string; quantity: number }>;
    }
  >();

  orders.forEach((order) => {
    const driverId = order.driver?.id || "unassigned";
    const driverName = order.driver?.full_name || "Nepřiřazený řidič";

    if (!driverTotals.has(driverId)) {
      driverTotals.set(driverId, {
        driverName,
        products: new Map(),
      });
    }

    const driverData = driverTotals.get(driverId)!;

    order.order_items
      .filter((item: OrderItem) => item.product.category_id === 9)
      .forEach((item: OrderItem) => {
        const productId = item.product.id.toString();
        const existing = driverData.products.get(productId);

        if (existing) {
          existing.quantity += item.quantity;
        } else {
          driverData.products.set(productId, {
            name: item.product.name,
            quantity: item.quantity,
          });
        }
      });
  });

  // Convert to array and sort products within each driver
  return Array.from(driverTotals.values())
    .map((driver) => ({
      driverName: driver.driverName,
      products: Array.from(driver.products.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    }))
    .sort((a, b) => a.driverName.localeCompare(b.driverName));
};

const formatDriverPrintContent = (driver: {
  driverName: string;
  products: { name: string; quantity: number }[];
}) => {
  const date = new Date().toLocaleDateString("cs-CZ");
  let content = "";

  // Header
  content += "================================\n";
  content += `${driver.driverName}\n`;
  content += `${date}\n`;
  content += "================================\n\n";

  // Products
  driver.products.forEach((product) => {
    content += `${product.name}\n`;
    content += `Pocet: ${product.quantity} ks\n`;
    content += "--------------------------------\n";
  });

  // Footer with signature line
  content += "\n";
  content += "Podpis: ______________________\n";

  // Add extra lines before cutting
  content += "\n\n\n\n\n\n";

  return content;
};

const formatTotalsPrintContent = (
  products: { name: string; quantity: number }[]
) => {
  const date = new Date().toLocaleDateString("cs-CZ");
  let content = "";

  // Header
  content += "================================\n";
  content += "Souhrn FRESH výrobků\n";
  content += `${date}\n`;
  content += "================================\n\n";

  // Products
  products.forEach((product) => {
    content += `${product.name}\n`;
    content += `Pocet: ${product.quantity} ks\n`;
    content += "--------------------------------\n";
  });

  // Footer with signature line
  content += "\n";
  content += "Podpis: ______________________\n";

  // Add extra lines before cutting
  content += "\n\n\n\n\n\n";

  return content;
};

export function Category9OrdersTable() {
  const { data: orders, isLoading, error } = useOrdersWithCategory9();
  const { toast } = useToast();
  const [date, setDate] = useState<Date>();
  const [isPrinterConnected, setIsPrinterConnected] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [quantityChanges, setQuantityChanges] = useState<
    Record<
      number,
      {
        oldQuantity: number;
        newQuantity: number;
      }
    >
  >({});

  useEffect(() => {
    // Check printer connection status on mount and when localStorage changes
    const checkPrinterStatus = () => {
      const isConnected =
        localStorage.getItem("thermal_printer_connected") === "true";
      setIsPrinterConnected(isConnected);
    };

    checkPrinterStatus();

    // Listen for storage changes
    window.addEventListener("storage", checkPrinterStatus);
    return () => window.removeEventListener("storage", checkPrinterStatus);
  }, []);

  // Clear quantity changes after 3 seconds
  useEffect(() => {
    const timeouts: Record<number, NodeJS.Timeout> = {};

    Object.keys(quantityChanges).forEach((itemId) => {
      const id = Number(itemId);
      if (timeouts[id]) {
        clearTimeout(timeouts[id]);
      }

      timeouts[id] = setTimeout(() => {
        setQuantityChanges((prev) => {
          const { [id]: _, ...rest } = prev;
          return rest;
        });
      }, 3000);
    });

    return () => Object.values(timeouts).forEach(clearTimeout);
  }, [quantityChanges]);

  if (isLoading) return <div>Loading orders...</div>;
  if (error) return <div>Error loading orders</div>;

  const handlePrint = async (driver: {
    driverName: string;
    products: { name: string; quantity: number }[];
  }) => {
    if (!isPrinterConnected) return;

    try {
      const printerService = ThermalPrinterService.getInstance();
      const content = formatDriverPrintContent(driver);
      await printerService.printReceipt(content);

      toast({
        title: "Tisk úspěšný",
        description: `Seznam pro ${driver.driverName} byl vytištěn.`,
      });
    } catch (error) {
      console.error("Printing error:", error);
      toast({
        variant: "destructive",
        title: "Chyba tisku",
        description:
          "Nepodařilo se vytisknout seznam. Zkontrolujte připojení tiskárny.",
      });
    }
  };

  const handlePrintTotals = async (
    products: { name: string; quantity: number }[]
  ) => {
    try {
      const printerService = ThermalPrinterService.getInstance();
      const content = formatTotalsPrintContent(products);
      await printerService.printReceipt(content);

      toast({
        title: "Tisk úspěšný",
        description: "Souhrn FRESH výrobků byl vytištěn.",
      });
    } catch (error) {
      console.error("Printing error:", error);
      toast({
        variant: "destructive",
        title: "Chyba tisku",
        description:
          "Nepodařilo se vytisknout seznam. Zkontrolujte připojení tiskárny.",
      });
    }
  };

  const handleQuantityChange = (
    itemId: number,
    oldQuantity: number,
    newQuantity: number
  ) => {
    setQuantityChanges((prev) => ({
      ...prev,
      [itemId]: { oldQuantity, newQuantity },
    }));
  };

  return (
    <>
      <Card className="my-0 p-4">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Objednávky FRESH výrobků</h2>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date
                      ? format(date, "PPP", { locale: cs })
                      : "Vybrat datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <Badge variant="secondary">
                {orders?.length || 0} objednávek
              </Badge>
            </div>
          </div>

          <Tabs
            defaultValue={date ? "specific" : "tomorrow"}
            className="w-full"
          >
            <TabsList>
              {[
                { value: "tomorrow", label: "Zítra" },
                { value: "afterTomorrow", label: "Pozítří" },
                { value: "week", label: "Tento týden" },
                { value: "month", label: "Tento měsíc" },
                ...(date
                  ? [
                      {
                        value: "specific",
                        label: format(date, "d.M.yyyy", { locale: cs }),
                      },
                    ]
                  : []),
              ].map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}{" "}
                  <Badge variant="outline" className="ml-2">
                    {
                      filterOrdersByDate(orders || [], tab.value as any, date)
                        .length
                    }
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {[
              "tomorrow",
              "afterTomorrow",
              "week",
              "month",
              ...(date ? ["specific"] : []),
            ].map((period) => {
              const filteredOrders = filterOrdersByDate(
                orders || [],
                period as any,
                date
              );
              const productTotals = calculateProductTotals(filteredOrders);
              const driverTotals = calculateDriverTotals(filteredOrders);

              return (
                <TabsContent key={period} value={period}>
                  {/* Total Products Card */}
                  <Card className="mb-4 p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-md font-semibold">
                        Souhrn FRESH výrobků (pouze mobil)
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrintTotals(productTotals)}
                        disabled={!isPrinterConnected}
                        className={cn(
                          "h-8 w-8 p-0",
                          !isPrinterConnected && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Printer className="h-4 w-4 text-orange-500" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
                      {productTotals
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((product) => (
                          <Badge
                            key={product.name}
                            variant="outline"
                            className="text-base py-2 border-orange-500 text-orange-500 flex flex-col"
                          >
                            <div className="flex flex-col items-center">
                              <span>{product.name}</span>
                              <span>{product.quantity} ks</span>
                            </div>
                          </Badge>
                        ))}
                    </div>
                  </Card>

                  {/* Driver Totals Card */}
                  <Card className="mb-4 p-4">
                    <h3 className="text-md font-semibold mb-3">
                      Souhrn podle řidičů
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {driverTotals.map((driver) => (
                        <div
                          key={driver.driverName}
                          className="space-y-2 border rounded-lg p-3"
                        >
                          <div className="flex justify-between items-center border-b pb-2">
                            <h4 className="font-medium text-orange-500">
                              {driver.driverName}
                            </h4>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePrint(driver)}
                              disabled={!isPrinterConnected}
                              className={cn(
                                "h-8 w-8 p-0",
                                !isPrinterConnected &&
                                  "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <Printer className="h-4 w-4 text-orange-500" />
                            </Button>
                          </div>
                          <div className="flex flex-col items-stretch gap-2">
                            {driver.products.map((product) => (
                              <Badge
                                key={`${driver.driverName}-${product.name}`}
                                variant="outline"
                                className="text-base py-2 w-full"
                              >
                                <div className="flex justify-between w-full">
                                  <span>{product.name}</span>
                                  <span>{product.quantity} ks</span>
                                </div>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Orders Table */}
                  <div className="border rounded-md">
                    <div className="max-h-[800px] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead>Datum</TableHead>
                            <TableHead>Odběratel</TableHead>
                            <TableHead>Řidič</TableHead>
                            <TableHead>FRESH výrobky</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredOrders.length > 0 ? (
                            filteredOrders.map((order) => (
                              <TableRow
                                key={order.id}
                                onClick={() => setSelectedOrderId(order.id)}
                                className="cursor-pointer hover:bg-muted/50"
                              >
                                <TableCell>
                                  {new Date(order.date).toLocaleDateString()}
                                </TableCell>
                                <TableCell>{order.user?.full_name}</TableCell>
                                <TableCell>
                                  {order.driver?.full_name || "-"}
                                </TableCell>
                                <TableCell>
                                  {order.order_items
                                    .filter(
                                      (item: OrderItem) =>
                                        item.product.category_id === 9
                                    )
                                    .map((item: OrderItem) => (
                                      <Badge
                                        key={item.id}
                                        variant="outline"
                                        className={cn(
                                          "mr-2 mb-1",
                                          quantityChanges[item.id] &&
                                            "relative animate-pulse bg-muted"
                                        )}
                                      >
                                        {item.product.name}: {item.quantity}
                                        {quantityChanges[item.id] && (
                                          <span className="absolute -top-3 -right-3 text-xs text-orange-500">
                                            {
                                              quantityChanges[item.id]
                                                .oldQuantity
                                            }{" "}
                                            →{" "}
                                            {
                                              quantityChanges[item.id]
                                                .newQuantity
                                            }
                                          </span>
                                        )}
                                      </Badge>
                                    ))}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="outline">
                                    {order.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="h-24 text-center"
                              >
                                Žádné objednávky s výrobky kategorie 9.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </Card>

      <Category9OrderDetails
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        onQuantityChange={handleQuantityChange}
      />
    </>
  );
}
