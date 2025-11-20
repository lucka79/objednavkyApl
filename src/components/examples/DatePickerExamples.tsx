/**
 * DatePicker Examples
 * 
 * This file demonstrates various usage patterns for the DatePicker and DateRangePicker components.
 * Use these examples as reference when implementing date selection in your components.
 */

import { useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export function DatePickerExamples() {
  // Single date picker state
  const [selectedDate, setSelectedDate] = useState<Date>();
  
  // Date range picker state
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Multiple independent date pickers
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Date Picker Examples</h1>

      {/* Example 1: Basic Single Date Picker */}
      <Card>
        <CardHeader>
          <CardTitle>Example 1: Single Date Picker</CardTitle>
          <CardDescription>
            Basic usage of the DatePicker component for selecting a single date
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DatePicker
            date={selectedDate}
            onSelect={setSelectedDate}
            placeholder="Select a date"
          />
          
          {selectedDate && (
            <div>
              <Badge variant="outline">
                Selected: {format(selectedDate, "PPP", { locale: cs })}
              </Badge>
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            <p className="font-medium">Code:</p>
            <pre className="bg-muted p-2 rounded mt-2 overflow-x-auto">
{`const [selectedDate, setSelectedDate] = useState<Date>();

<DatePicker
  date={selectedDate}
  onSelect={setSelectedDate}
  placeholder="Select a date"
/>`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Example 2: Date Range Picker */}
      <Card>
        <CardHeader>
          <CardTitle>Example 2: Date Range Picker</CardTitle>
          <CardDescription>
            Select a range of dates with start and end dates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DateRangePicker
            dateRange={dateRange}
            onSelect={setDateRange}
            placeholder="Select date range"
          />
          
          {dateRange?.from && (
            <div className="flex gap-2">
              <Badge variant="outline">
                From: {format(dateRange.from, "PPP", { locale: cs })}
              </Badge>
              {dateRange.to && (
                <Badge variant="outline">
                  To: {format(dateRange.to, "PPP", { locale: cs })}
                </Badge>
              )}
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            <p className="font-medium">Code:</p>
            <pre className="bg-muted p-2 rounded mt-2 overflow-x-auto">
{`import { DateRange } from "react-day-picker";

const [dateRange, setDateRange] = useState<DateRange | undefined>();

<DateRangePicker
  dateRange={dateRange}
  onSelect={setDateRange}
  placeholder="Select date range"
/>`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Example 3: Multiple Date Pickers */}
      <Card>
        <CardHeader>
          <CardTitle>Example 3: Multiple Independent Date Pickers</CardTitle>
          <CardDescription>
            Use multiple date pickers for different purposes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-center">
            <div>
              <label className="text-sm font-medium mb-2 block">Start Date</label>
              <DatePicker
                date={startDate}
                onSelect={setStartDate}
                placeholder="Start date"
                className="w-[200px]"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">End Date</label>
              <DatePicker
                date={endDate}
                onSelect={setEndDate}
                placeholder="End date"
                className="w-[200px]"
              />
            </div>
          </div>
          
          {startDate && endDate && (
            <Badge variant="outline">
              Duration: {Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} days
            </Badge>
          )}

          <div className="text-sm text-muted-foreground">
            <p className="font-medium">Code:</p>
            <pre className="bg-muted p-2 rounded mt-2 overflow-x-auto">
{`const [startDate, setStartDate] = useState<Date>();
const [endDate, setEndDate] = useState<Date>();

<DatePicker
  date={startDate}
  onSelect={setStartDate}
  placeholder="Start date"
  className="w-[200px]"
/>

<DatePicker
  date={endDate}
  onSelect={setEndDate}
  placeholder="End date"
  className="w-[200px]"
/>`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Example 4: With Filtering Logic */}
      <Card>
        <CardHeader>
          <CardTitle>Example 4: Date Picker with Filtering</CardTitle>
          <CardDescription>
            Common pattern: Use date picker to filter data (like in OrdersTable)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DatePicker
            date={selectedDate}
            onSelect={(date) => {
              setSelectedDate(date);
              // In real usage, trigger data filtering here
              console.log("Filter data for date:", date);
            }}
            placeholder="Filter by date"
          />

          <div className="text-sm text-muted-foreground">
            <p className="font-medium">Usage Pattern:</p>
            <pre className="bg-muted p-2 rounded mt-2 overflow-x-auto">
{`// In a component that displays filtered data
const [date, setDate] = useState<Date>();

const filteredData = useMemo(() => {
  if (!date) return allData;
  
  return allData.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate.toDateString() === date.toDateString();
  });
}, [allData, date]);

return (
  <div>
    <DatePicker
      date={date}
      onSelect={setDate}
      placeholder="Filter by date"
    />
    {/* Render filtered data */}
  </div>
);`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

