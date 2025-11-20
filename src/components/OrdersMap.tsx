import { useState, useCallback, useMemo } from "react";
import {
  GoogleMap,
  LoadScript,
  Marker,
  InfoWindow,
} from "@react-google-maps/api";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Order } from "../../types";
import { MapPin, Package, Calendar, User, DollarSign } from "lucide-react";
import { format, addDays } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Button } from "./ui/button";
import { DatePicker } from "./ui/date-picker";
import { useDriverUsers } from "@/hooks/useProfiles";

interface OrderWithLocation extends Order {
  lat: number;
  lng: number;
}

const mapContainerStyle = {
  width: "100%",
  height: "600px",
};

const defaultCenter = {
  lat: 49.8175, // Czech Republic center
  lng: 15.473,
};

export function OrdersMap() {
  const [selectedOrder, setSelectedOrder] = useState<OrderWithLocation | null>(
    null
  );
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    addDays(new Date(), 1) // Default to tomorrow
  );
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedDriver, setSelectedDriver] = useState<string>("all");
  const { data: driverUsers } = useDriverUsers();
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Fetch orders with geolocation data
  const {
    data: orders,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["orders-map", selectedDate, statusFilter, selectedDriver],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select(
          `
          id,
          created_at,
          date,
          status,
          total,
          user_id,
          driver_id,
          note,
          paid_by,
          crateBig,
          crateSmall,
          crateBigReceived,
          crateSmallReceived,
          isLocked,
          user:profiles!orders_user_id_fkey (
            id, 
            full_name, 
            role,
            address,
            mo_partners,
            oz,
            lat,
            lng,
            formatted_address
          ),
          driver:profiles!orders_driver_id_fkey (
            id, 
            full_name, 
            role
          ),
          order_items (
            *,
            product:products (
              id,
              name,
              price
            )
          )
        `
        )
        .order("date", { ascending: false })
        .limit(1000);

      // Apply date filter if a date is selected
      if (selectedDate) {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        query = query.eq("date", dateStr);
      }

      // Apply status filter if not 'all'
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      // Apply driver filter if not 'all'
      if (selectedDriver !== "all") {
        if (selectedDriver === "none") {
          query = query.is("driver_id", null);
        } else {
          query = query.eq("driver_id", selectedDriver);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter orders that have geolocation data
      const ordersWithLocation = data
        ?.filter((order) => {
          const user = order.user as any;
          return user?.lat && user?.lng;
        })
        .map((order) => {
          const user = order.user as any;
          return {
            ...order,
            lat: user.lat,
            lng: user.lng,
          };
        }) as unknown as OrderWithLocation[];

      return ordersWithLocation || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Group orders by location to show count on markers
  const ordersByLocation = useMemo(() => {
    if (!orders) return new Map();

    const locationMap = new Map<string, OrderWithLocation[]>();

    orders.forEach((order) => {
      const key = `${order.lat},${order.lng}`;
      const existing = locationMap.get(key) || [];
      locationMap.set(key, [...existing, order]);
    });

    return locationMap;
  }, [orders]);

  // Calculate statistics
  const statistics = useMemo(() => {
    if (!orders) return { totalOrders: 0, totalValue: 0, uniqueLocations: 0 };

    const totalValue = orders.reduce((sum, order) => sum + order.total, 0);

    return {
      totalOrders: orders.length,
      totalValue,
      uniqueLocations: ordersByLocation.size,
    };
  }, [orders, ordersByLocation]);

  // Calculate center based on orders
  const mapCenter = useMemo(() => {
    if (!orders || orders.length === 0) return defaultCenter;

    const avgLat =
      orders.reduce((sum, order) => sum + order.lat, 0) / orders.length;
    const avgLng =
      orders.reduce((sum, order) => sum + order.lng, 0) / orders.length;

    return { lat: avgLat, lng: avgLng };
  }, [orders]);

  const handleMarkerClick = useCallback((order: OrderWithLocation) => {
    setSelectedOrder(order);
  }, []);

  const handleInfoWindowClose = useCallback(() => {
    setSelectedOrder(null);
  }, []);

  if (!apiKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Map Configuration Required</CardTitle>
          <CardDescription>
            Google Maps API key is not configured. Please add
            VITE_GOOGLE_MAPS_API_KEY to your environment variables.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error Loading Orders</CardTitle>
          <CardDescription>
            {error instanceof Error
              ? error.message
              : "An error occurred while loading orders"}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Orders Map
        </CardTitle>
        <CardDescription>
          {isLoading
            ? "Loading orders..."
            : `Showing ${orders?.length || 0} orders with geolocation data from ${ordersByLocation.size} locations`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-4 mb-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">
              Datum objednávky
            </label>
            <DatePicker
              date={selectedDate}
              onSelect={setSelectedDate}
              placeholder="Vyberte datum"
              className="w-full"
            />
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Řidič</label>
            <Select value={selectedDriver} onValueChange={setSelectedDriver}>
              <SelectTrigger>
                <SelectValue placeholder="Všichni řidiči" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všichni řidiči</SelectItem>
                <SelectItem value="none">Bez řidiče</SelectItem>
                {driverUsers?.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">
              Stav objednávky
            </label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny stavy</SelectItem>
                <SelectItem value="Pre-order">Pre-order</SelectItem>
                <SelectItem value="New">New</SelectItem>
                <SelectItem value="Tisk">Tisk</SelectItem>
                <SelectItem value="Expedice R">Expedice R</SelectItem>
                <SelectItem value="Expedice O">Expedice O</SelectItem>
                <SelectItem value="Přeprava">Přeprava</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              setSelectedDate(addDays(new Date(), 1));
              setStatusFilter("all");
              setSelectedDriver("all");
            }}
          >
            Reset Filters
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Orders
                  </p>
                  <h3 className="text-2xl font-bold">
                    {statistics.totalOrders}
                  </h3>
                </div>
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Value
                  </p>
                  <h3 className="text-2xl font-bold">
                    {statistics.totalValue.toLocaleString("cs-CZ")} Kč
                  </h3>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Unique Locations
                  </p>
                  <h3 className="text-2xl font-bold">
                    {statistics.uniqueLocations}
                  </h3>
                </div>
                <MapPin className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="rounded-lg overflow-hidden border">
          <LoadScript googleMapsApiKey={apiKey}>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={8}
              options={{
                streetViewControl: false,
                mapTypeControl: true,
              }}
            >
              {Array.from(ordersByLocation.entries()).map(
                ([key, locationOrders]) => {
                  const firstOrder = locationOrders[0];
                  const orderCount = locationOrders.length;

                  return (
                    <Marker
                      key={key}
                      position={{ lat: firstOrder.lat, lng: firstOrder.lng }}
                      onClick={() => handleMarkerClick(firstOrder)}
                      label={orderCount > 1 ? String(orderCount) : undefined}
                    />
                  );
                }
              )}

              {selectedOrder && (
                <InfoWindow
                  position={{ lat: selectedOrder.lat, lng: selectedOrder.lng }}
                  onCloseClick={handleInfoWindowClose}
                >
                  <div className="p-2 max-w-xs">
                    <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {(selectedOrder.user as any).full_name}
                    </h3>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-500" />
                        <span className="text-gray-700">
                          {(selectedOrder.user as any).formatted_address ||
                            (selectedOrder.user as any).address}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-700">
                          Latest order:{" "}
                          {format(new Date(selectedOrder.date), "dd.MM.yyyy")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-700">
                          Status:{" "}
                          <span className="font-medium">
                            {selectedOrder.status}
                          </span>
                        </span>
                      </div>

                      {selectedOrder.driver && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-700">
                            Řidič:{" "}
                            <span className="font-medium">
                              {(selectedOrder.driver as any).full_name}
                            </span>
                          </span>
                        </div>
                      )}

                      <div className="pt-2 mt-2 border-t">
                        <div className="font-medium text-gray-700">
                          Total orders at this location:{" "}
                          {ordersByLocation.get(
                            `${selectedOrder.lat},${selectedOrder.lng}`
                          )?.length || 1}
                        </div>
                      </div>

                      {/* Show total amount */}
                      <div className="text-right font-semibold text-lg pt-2">
                        {selectedOrder.total.toLocaleString("cs-CZ")} Kč
                      </div>
                    </div>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          </LoadScript>
        </div>

        {/* Legend */}
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <h4 className="font-semibold mb-2">Legend</h4>
          <ul className="space-y-1 text-sm">
            <li className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Order location (click for details)</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                5
              </div>
              <span>Number indicates multiple orders at the same location</span>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
