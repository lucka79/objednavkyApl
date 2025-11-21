import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  GoogleMap,
  LoadScript,
  Marker,
  InfoWindow,
  DirectionsRenderer,
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
import {
  MapPin,
  Package,
  Calendar,
  User,
  DollarSign,
  Route,
  Navigation,
} from "lucide-react";
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
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";

interface OrderWithLocation extends Order {
  lat: number;
  lng: number;
}

interface RouteData {
  driverId: string;
  driverName: string;
  directionsResult: google.maps.DirectionsResult;
  color: string;
}

const mapContainerStyle = {
  width: "100%",
  height: "600px",
};

const defaultCenter = {
  lat: 49.8175, // Czech Republic center
  lng: 15.473,
};

// Warehouse location (start and end point for all routes)
const WAREHOUSE_LOCATION = {
  address: "Výstupní 8, 400 07 Ústí nad Labem-Neštěmice, Česko",
  plusCode: "M3C9+72 Ústí nad Labem-Neštěmice, Česko",
  lat: 50.670619,
  lng: 14.0675616,
};

// Color palette for different drivers
const DRIVER_COLORS = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#FFA07A", // Light Salmon
  "#98D8C8", // Mint
  "#F7DC6F", // Yellow
  "#BB8FCE", // Purple
  "#85C1E2", // Sky Blue
  "#F8B739", // Orange
  "#52BE80", // Green
];

export function OrdersMap() {
  const [selectedOrder, setSelectedOrder] = useState<OrderWithLocation | null>(
    null
  );
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    addDays(new Date(), 1) // Default to tomorrow
  );
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedDriver, setSelectedDriver] = useState<string>("all");
  const [showRoutes, setShowRoutes] = useState<boolean>(false);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [isCalculatingRoutes, setIsCalculatingRoutes] =
    useState<boolean>(false);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(
    null
  );
  const mapRef = useRef<google.maps.Map | null>(null);
  const { data: driverUsers } = useDriverUsers();
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Fetch all drivers with orders for the selected date (for dropdown, without driver filter)
  const { data: allOrdersForDrivers } = useQuery({
    queryKey: ["orders-map-drivers", selectedDate, statusFilter],
    queryFn: async () => {
      let query = supabase.from("orders").select("driver_id").limit(1000);

      // Apply date filter if a date is selected
      if (selectedDate) {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        query = query.eq("date", dateStr);
      }

      // Apply status filter if not 'all'
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get unique driver IDs
      const driverIds = new Set<string>();
      data?.forEach((order) => {
        if (order.driver_id) {
          driverIds.add(order.driver_id);
        }
      });

      return Array.from(driverIds);
    },
    staleTime: 5 * 60 * 1000,
  });

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

  // Group orders by driver
  const ordersByDriver = useMemo(() => {
    if (!orders) return new Map<string, OrderWithLocation[]>();

    const driverMap = new Map<string, OrderWithLocation[]>();

    orders.forEach((order) => {
      const driverId = order.driver_id || "none";
      const existing = driverMap.get(driverId) || [];
      driverMap.set(driverId, [...existing, order]);
    });

    return driverMap;
  }, [orders]);

  // Filter drivers to only show those with orders for the selected date
  // Uses allOrdersForDrivers (without driver filter) so dropdown always shows all available drivers
  const driversWithOrders = useMemo(() => {
    if (!allOrdersForDrivers || !driverUsers) return [];

    // Filter driverUsers to only include those with orders for the selected date
    return driverUsers.filter((driver) =>
      allOrdersForDrivers.includes(driver.id)
    );
  }, [allOrdersForDrivers, driverUsers]);

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

  // Google Maps SymbolPath constants (numeric values work directly)
  // Using numeric values to avoid "google is not defined" errors during initial render
  const SYMBOL_PATH = {
    CIRCLE: 0, // google.maps.SymbolPath.CIRCLE
    BACKWARD_CLOSED_ARROW: 4, // google.maps.SymbolPath.BACKWARD_CLOSED_ARROW
  };

  // Custom warehouse icon - diamond/square shape for better visibility
  // SVG path: creates a diamond shape pointing up
  const WAREHOUSE_ICON_PATH = "M 0,-10 L 10,0 L 0,10 L -10,0 Z";

  // Calculate optimized routes for drivers
  const calculateRoutes = useCallback(async () => {
    if (!orders || orders.length === 0 || !showRoutes) {
      setRoutes([]);
      return;
    }

    // Check if Google Maps API is loaded
    if (typeof google === "undefined" || !google.maps) {
      console.warn("Google Maps API not loaded yet");
      return;
    }

    setIsCalculatingRoutes(true);

    try {
      if (!directionsServiceRef.current) {
        directionsServiceRef.current = new google.maps.DirectionsService();
      }

      const routesPromises: Promise<RouteData | null>[] = [];
      let colorIndex = 0;

      // Calculate routes for each driver
      for (const [driverId, driverOrders] of ordersByDriver.entries()) {
        if (driverId === "none" || driverOrders.length === 0) continue;

        // If a specific driver is selected, only calculate route for that driver
        if (selectedDriver !== "all" && selectedDriver !== driverId) continue;

        // Get driver info
        const driver = driverUsers?.find((d) => d.id === driverId);
        if (!driver) continue;

        // Get unique delivery locations (remove duplicates at same coordinates)
        const uniqueLocations = Array.from(
          new Map(
            driverOrders.map((order) => [
              `${order.lat},${order.lng}`,
              { lat: order.lat, lng: order.lng },
            ])
          ).values()
        );

        if (uniqueLocations.length === 0) continue; // Need at least 1 delivery location

        const color = DRIVER_COLORS[colorIndex % DRIVER_COLORS.length];
        colorIndex++;

        // Create waypoints from all delivery locations
        const waypoints = uniqueLocations.map((location) => ({
          location: new google.maps.LatLng(location.lat, location.lng),
          stopover: true,
        }));

        // Start from warehouse
        const origin = new google.maps.LatLng(
          WAREHOUSE_LOCATION.lat,
          WAREHOUSE_LOCATION.lng
        );

        // End at warehouse (return to depot)
        const destination = new google.maps.LatLng(
          WAREHOUSE_LOCATION.lat,
          WAREHOUSE_LOCATION.lng
        );

        // Calculate route
        const routePromise = new Promise<RouteData | null>((resolve) => {
          directionsServiceRef.current!.route(
            {
              origin,
              destination,
              waypoints,
              optimizeWaypoints: true, // Optimize route order
              travelMode: google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
              if (status === google.maps.DirectionsStatus.OK && result) {
                resolve({
                  driverId,
                  driverName: driver.full_name || "Unknown",
                  directionsResult: result,
                  color,
                });
              } else {
                console.error(
                  `Route calculation failed for driver ${driver.full_name}:`,
                  status
                );
                resolve(null);
              }
            }
          );
        });

        routesPromises.push(routePromise);
      }

      const calculatedRoutes = await Promise.all(routesPromises);
      setRoutes(calculatedRoutes.filter((r) => r !== null) as RouteData[]);
    } catch (error) {
      console.error("Error calculating routes:", error);
      setRoutes([]);
    } finally {
      setIsCalculatingRoutes(false);
    }
  }, [orders, ordersByDriver, driverUsers, showRoutes, selectedDriver]);

  // Calculate routes when orders or showRoutes changes
  useEffect(() => {
    if (showRoutes && orders && orders.length > 0 && mapRef.current) {
      calculateRoutes();
    } else {
      setRoutes([]);
    }
  }, [showRoutes, orders, calculateRoutes]);

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
                {driversWithOrders.map((driver) => (
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

          <div className="flex items-center gap-2">
            <Checkbox
              id="show-routes"
              checked={showRoutes}
              onCheckedChange={(checked) => setShowRoutes(checked === true)}
            />
            <Label
              htmlFor="show-routes"
              className="text-sm font-medium cursor-pointer flex items-center gap-2"
            >
              <Route className="h-4 w-4" />
              Zobrazit trasy
            </Label>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              setSelectedDate(addDays(new Date(), 1));
              setStatusFilter("all");
              setSelectedDriver("all");
              setShowRoutes(false);
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
        {isCalculatingRoutes && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
            <Navigation className="h-4 w-4 text-blue-600 animate-spin" />
            <span className="text-sm text-blue-700">
              Počítání optimalizovaných tras...
            </span>
          </div>
        )}

        <div className="rounded-lg overflow-hidden border">
          <LoadScript googleMapsApiKey={apiKey} libraries={["places"]}>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={8}
              options={{
                streetViewControl: false,
                mapTypeControl: true,
              }}
              onLoad={(map) => {
                mapRef.current = map;
                // Log warehouse location for debugging
                console.log("Warehouse location:", WAREHOUSE_LOCATION);
                console.log("Map center:", mapCenter);
                if (showRoutes && orders && orders.length > 0) {
                  calculateRoutes();
                }
              }}
            >
              {/* Render optimized routes */}
              {showRoutes &&
                routes.map((route, index) => (
                  <DirectionsRenderer
                    key={`route-${route.driverId}-${index}`}
                    directions={route.directionsResult}
                    options={{
                      polylineOptions: {
                        strokeColor: route.color,
                        strokeWeight: 4,
                        strokeOpacity: 0.7,
                      },
                      suppressMarkers: false,
                      markerOptions: {
                        icon: {
                          path: SYMBOL_PATH.CIRCLE,
                          scale: 6,
                          fillColor: route.color,
                          fillOpacity: 1,
                          strokeColor: "#FFFFFF",
                          strokeWeight: 2,
                        },
                      },
                    }}
                  />
                ))}

              {/* Render warehouse marker (start/end point) */}
              <Marker
                key="warehouse-marker"
                position={{
                  lat: WAREHOUSE_LOCATION.lat,
                  lng: WAREHOUSE_LOCATION.lng,
                }}
                icon={{
                  path: WAREHOUSE_ICON_PATH,
                  scale: 1.2,
                  fillColor: "#000000",
                  fillOpacity: 1,
                  strokeColor: "#FFFFFF",
                  strokeWeight: 2,
                }}
                title={`SKLAD - ${WAREHOUSE_LOCATION.address}\n${WAREHOUSE_LOCATION.plusCode}`}
                label={{
                  text: "S",
                  color: "#FFFFFF",
                  fontWeight: "bold",
                  fontSize: "10px",
                }}
                zIndex={1000}
                visible={true}
                onClick={() => {
                  console.log("Warehouse marker clicked:", WAREHOUSE_LOCATION);
                  setSelectedOrder(null); // Close any open info windows
                }}
              />

              {/* Render order markers */}
              {Array.from(ordersByLocation.entries()).map(
                ([key, locationOrders]) => {
                  const firstOrder = locationOrders[0];
                  const orderCount = locationOrders.length;

                  // Determine marker color based on driver if routes are shown
                  let markerColor = "#FF6B6B"; // Default red
                  if (showRoutes && firstOrder.driver_id) {
                    const route = routes.find(
                      (r) => r.driverId === firstOrder.driver_id
                    );
                    if (route) {
                      markerColor = route.color;
                    }
                  }

                  return (
                    <Marker
                      key={key}
                      position={{ lat: firstOrder.lat, lng: firstOrder.lng }}
                      onClick={() => handleMarkerClick(firstOrder)}
                      label={
                        orderCount > 1
                          ? {
                              text: String(orderCount),
                              color: "#FFFFFF",
                              fontWeight: "bold",
                            }
                          : undefined
                      }
                      icon={
                        showRoutes
                          ? {
                              path: SYMBOL_PATH.CIRCLE,
                              scale: 8,
                              fillColor: markerColor,
                              fillOpacity: 1,
                              strokeColor: "#FFFFFF",
                              strokeWeight: 2,
                            }
                          : undefined
                      }
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
          <h4 className="font-semibold mb-2">Legenda</h4>
          <ul className="space-y-1 text-sm">
            <li className="flex items-center gap-2">
              <div className="w-4 h-4 bg-black rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">S</span>
              </div>
              <span>Skladiště (výchozí a cílový bod tras)</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Umístění objednávky (klikněte pro detaily)</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                5
              </div>
              <span>Číslo označuje více objednávek na stejném místě</span>
            </li>
            {showRoutes && routes.length > 0 && (
              <>
                <li className="flex items-center gap-2 mt-2 pt-2 border-t">
                  <Route className="h-4 w-4" />
                  <span className="font-medium">
                    Optimalizované trasy řidičů:
                  </span>
                </li>
                {routes.map((route) => (
                  <li key={route.driverId} className="flex items-center gap-2">
                    <div
                      className="w-4 h-1 rounded"
                      style={{ backgroundColor: route.color }}
                    ></div>
                    <span>{route.driverName}</span>
                    {route.directionsResult.routes[0]?.legs && (
                      <span className="text-muted-foreground ml-auto">
                        {route.directionsResult.routes[0].legs.reduce(
                          (total, leg) => total + (leg.distance?.value || 0),
                          0
                        ) / 1000}{" "}
                        km,{" "}
                        {Math.round(
                          route.directionsResult.routes[0].legs.reduce(
                            (total, leg) => total + (leg.duration?.value || 0),
                            0
                          ) / 60
                        )}{" "}
                        min
                      </span>
                    )}
                  </li>
                ))}
              </>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
