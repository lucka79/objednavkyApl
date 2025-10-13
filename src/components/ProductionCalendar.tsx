import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";

import { Calendar } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
} from "date-fns";
import { cs } from "date-fns/locale";
import { supabase } from "@/lib/supabase";

interface ProductionDay {
  date: string;
  hasProduction: boolean;
  productionCount: number;
}

interface ProductionCalendarProps {
  selectedMonth: Date;
  selectedUserId?: string;
}

export function ProductionCalendar({
  selectedMonth,
  selectedUserId,
}: ProductionCalendarProps) {
  const [productionDays, setProductionDays] = useState<ProductionDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get all days in the selected month
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Fetch production data for the current month
  useEffect(() => {
    const fetchProductionData = async () => {
      setIsLoading(true);

      const startDate = format(monthStart, "yyyy-MM-dd");
      const endDate = format(monthEnd, "yyyy-MM-dd");

      try {
        let data, error;

        // Check if selectedUserId is the bakery user (APLICA - Pekárna výrobna)
        const isBakeryUser =
          selectedUserId === "e597fcc9-7ce8-407d-ad1a-fdace061e42f";

        if (isBakeryUser) {
          // Use bakers table for bakery production
          console.log("Fetching bakers data (bakery production)");
          const result = await supabase
            .from("bakers")
            .select("date")
            .gte("date", startDate)
            .lte("date", endDate);

          data = result.data;
          error = result.error;
        } else if (selectedUserId) {
          // Use productions table for store users
          console.log("Fetching productions for user:", selectedUserId);
          const result = await supabase
            .from("productions")
            .select("date")
            .eq("user_id", selectedUserId)
            .gte("date", startDate)
            .lte("date", endDate);

          data = result.data;
          error = result.error;
        } else {
          // No user selected - show empty calendar
          console.log("No user selected");
          data = [];
          error = null;
        }

        if (error) {
          console.error("Error fetching production data:", error);
          return;
        }

        // Group by date and count productions
        const productionMap = new Map<string, number>();
        data?.forEach((item: any) => {
          const date = item.date;
          productionMap.set(date, (productionMap.get(date) || 0) + 1);
        });

        // Create array of all days with production status
        const days: ProductionDay[] = daysInMonth.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const hasProduction = productionMap.has(dateStr);
          const productionCount = productionMap.get(dateStr) || 0;

          return {
            date: dateStr,
            hasProduction,
            productionCount,
          };
        });

        setProductionDays(days);
      } catch (error) {
        console.error("Error fetching production data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProductionData();
  }, [selectedMonth, selectedUserId]);

  const getProductionStats = () => {
    const totalDays = productionDays.length;
    const daysWithProduction = productionDays.filter(
      (day) => day.hasProduction
    ).length;
    const daysWithoutProduction = totalDays - daysWithProduction;
    const productionRate =
      totalDays > 0 ? (daysWithProduction / totalDays) * 100 : 0;

    return {
      totalDays,
      daysWithProduction,
      daysWithoutProduction,
      productionRate,
    };
  };

  const stats = getProductionStats();

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="text-muted-foreground mt-2">
            Načítám data o produkci...
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4 overflow-x-auto">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-green-600" />
          <h3 className="text-sm font-semibold">Kalendář produkce</h3>
        </div>

        {/* Month Display */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium min-w-[80px] text-center">
            {format(selectedMonth, "MMM yyyy", { locale: cs })}
          </span>
        </div>

        {/* Compact Stats */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-100 border border-green-300 rounded"></div>
            <span className="text-green-600 font-medium">
              {stats.daysWithProduction}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-gray-50 border border-gray-200 rounded"></div>
            <span className="text-gray-500">{stats.daysWithoutProduction}</span>
          </div>
          <span className="text-blue-600 font-medium">
            {stats.productionRate.toFixed(0)}%
          </span>
        </div>

        {/* GitHub-style Contribution Grid */}
        <div className="flex gap-1">
          {/* Calendar days */}
          {productionDays.map((day, index) => {
            const dayNumber = index + 1;
            const isToday = isSameDay(new Date(day.date), new Date());
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const isTomorrow = isSameDay(new Date(day.date), tomorrow);

            return (
              <div
                key={day.date}
                className={`
                  w-5 h-5 rounded-sm flex items-center justify-center text-xs font-bold
                  ${
                    isToday
                      ? "bg-orange-500 text-white"
                      : isTomorrow
                        ? "bg-white border-2 border-orange-500 neutral-400"
                        : day.hasProduction
                          ? "bg-green-500"
                          : "bg-gray-200"
                  }
                `}
                title={`${format(new Date(day.date), "d. MMMM yyyy", { locale: cs })} - ${
                  day.hasProduction
                    ? `${day.productionCount} výrobních plánů`
                    : "Žádná produkce"
                }`}
              >
                {(!day.hasProduction || isTomorrow) && (
                  <span
                    className={`text-xs ${isTomorrow ? "neutral-400" : "text-gray-600"}`}
                  >
                    {dayNumber}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
