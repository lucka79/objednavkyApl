import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface CrateRecord {
  id: string;
  date: string;
  driver_id: string;
  crate_small_issued: number;
  crate_big_issued: number;
  crate_small_received: number;
  crate_big_received: number;
  created_at: string;
  updated_at: string;
}

export interface CrateInput {
  date: string;
  driver_id: string;
  crate_small_issued?: number;
  crate_big_issued?: number;
  crate_small_received?: number;
  crate_big_received?: number;
}

// Fetch crates for a specific date
export const useCratesByDate = (date: string) => {
  return useQuery({
    queryKey: ["crates", date],
    queryFn: async (): Promise<CrateRecord[]> => {
      const { data, error } = await supabase
        .from("crates")
        .select("*")
        .eq("date", date)
        .order("driver_id");

      if (error) {
        console.error("Error fetching crates:", error);
        throw error;
      }

      return data || [];
    },
    enabled: !!date,
  });
};

// Fetch crates for a date range
export const useCratesByDateRange = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: ["crates", "range", startDate, endDate],
    queryFn: async (): Promise<CrateRecord[]> => {
      const { data, error } = await supabase
        .from("crates")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date")
        .order("driver_id");

      if (error) {
        console.error("Error fetching crates by range:", error);
        throw error;
      }

      return data || [];
    },
    enabled: !!startDate && !!endDate,
  });
};

// Create or update crate record
export const useUpsertCrates = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (crates: CrateInput[]): Promise<CrateRecord[]> => {
      const results: CrateRecord[] = [];

      for (const crate of crates) {
        const { data, error } = await supabase
          .from("crates")
          .upsert(
            {
              date: crate.date,
              driver_id: crate.driver_id,
              crate_small_issued: crate.crate_small_issued || 0,
              crate_big_issued: crate.crate_big_issued || 0,
              crate_small_received: crate.crate_small_received || 0,
              crate_big_received: crate.crate_big_received || 0,
            },
            {
              onConflict: "date,driver_id",
            }
          )
          .select()
          .single();

        if (error) {
          console.error("Error upserting crate:", error);
          throw error;
        }

        results.push(data);
      }

      return results;
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      const dates = [...new Set(data.map((crate) => crate.date))];
      dates.forEach((date) => {
        queryClient.invalidateQueries({ queryKey: ["crates", date] });
      });
      queryClient.invalidateQueries({ queryKey: ["crates", "range"] });
    },
  });
};

// Delete crate record
export const useDeleteCrate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("crates").delete().eq("id", id);

      if (error) {
        console.error("Error deleting crate:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crates"] });
    },
  });
};

// Helper function to calculate crate stats from orders
export const calculateCrateStatsFromOrders = (orders: any[]) => {
  const driverStats = new Map();

  orders.forEach((order) => {
    if (order.driver) {
      const driverId = order.driver.id;
      const driverName = order.driver.full_name;

      if (!driverStats.has(driverId)) {
        driverStats.set(driverId, {
          driver_id: driverId,
          driver_name: driverName,
          crate_small_issued: 0,
          crate_big_issued: 0,
          crate_small_received: 0,
          crate_big_received: 0,
        });
      }

      const stats = driverStats.get(driverId);
      stats.crate_small_issued += order.crateSmall || 0;
      stats.crate_big_issued += order.crateBig || 0;
      stats.crate_small_received += order.crateSmallReceived || 0;
      stats.crate_big_received += order.crateBigReceived || 0;
    }
  });

  return Array.from(driverStats.values());
};
