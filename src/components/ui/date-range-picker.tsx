import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cs } from "date-fns/locale";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  dateRange?: DateRange;
  onSelect?: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  locale?: Locale;
}

export function DateRangePicker({
  dateRange,
  onSelect,
  placeholder = "Vyberte rozsah",
  className,
  disabled = false,
  locale = cs,
}: DateRangePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-[300px] justify-start text-left font-normal",
            !dateRange && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateRange?.from ? (
            dateRange.to ? (
              <>
                {format(dateRange.from, "d. MMM yyyy", { locale })} -{" "}
                {format(dateRange.to, "d. MMM yyyy", { locale })}
              </>
            ) : (
              format(dateRange.from, "d. MMM yyyy", { locale })
            )
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={dateRange?.from}
          selected={dateRange}
          onSelect={onSelect}
          numberOfMonths={2}
          locale={locale}
        />
      </PopoverContent>
    </Popover>
  );
}

