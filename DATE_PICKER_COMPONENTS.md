# Date Picker Components

## Overview

Created reusable date picker components extracted from the OrdersTable component to promote code reuse and consistency across the application.

## Components Created

### 1. DatePicker (`src/components/ui/date-picker.tsx`)

A single date selection component.

**Features:**
- Single date selection
- Customizable placeholder
- Locale support (defaults to Czech)
- Disabled state
- Consistent shadcn/ui styling

**Props:**
```typescript
interface DatePickerProps {
  date?: Date;
  onSelect?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  locale?: Locale;
}
```

**Usage:**
```tsx
import { DatePicker } from "@/components/ui/date-picker";

<DatePicker
  date={selectedDate}
  onSelect={setSelectedDate}
  placeholder="Select date"
  className="w-[200px]"
/>
```

### 2. DateRangePicker (`src/components/ui/date-range-picker.tsx`)

A date range selection component for selecting start and end dates.

**Features:**
- Date range selection (from/to)
- Two-month calendar view
- Locale support
- Formatted range display

**Props:**
```typescript
interface DateRangePickerProps {
  dateRange?: DateRange;
  onSelect?: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  locale?: Locale;
}
```

**Usage:**
```tsx
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";

const [dateRange, setDateRange] = useState<DateRange>();

<DateRangePicker
  dateRange={dateRange}
  onSelect={setDateRange}
  placeholder="Select range"
/>
```

## Files Modified

### OrdersTable.tsx

**Before:**
```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant={"outline"} className={cn("w-[150px] ...")}>
      <CalendarIcon className="mr-2 h-4 w-4" />
      {date ? format(date, "PPP") : <span>Vyberte datum</span>}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0" align="start">
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      initialFocus
      locale={cs}
    />
  </PopoverContent>
</Popover>
```

**After:**
```tsx
<DatePicker
  date={date}
  onSelect={setDate}
  placeholder="Vyberte datum"
  className="w-[150px]"
/>
```

**Benefits:**
- Reduced code duplication (30+ lines → 5 lines)
- Improved maintainability
- Consistent behavior across app
- Removed unnecessary imports

**Imports removed:**
```tsx
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
```

**Import added:**
```tsx
import { DatePicker } from "@/components/ui/date-picker";
```

## Documentation

### Component Documentation
- `src/components/ui/date-picker.md` - Comprehensive DatePicker documentation

### Example Component
- `src/components/examples/DatePickerExamples.tsx` - Live examples showing:
  - Basic single date selection
  - Date range selection
  - Multiple independent pickers
  - Filtering pattern with dates

## Usage Examples in Codebase

### 1. OrdersTable Component
```tsx
<DatePicker
  date={date}
  onSelect={setDate}
  placeholder="Vyberte datum"
  className="w-[150px]"
/>
```

### 2. Future Usage in OrdersMap
```tsx
// Could replace the time period filter with custom date range
<DateRangePicker
  dateRange={dateRange}
  onSelect={(range) => {
    setDateRange(range);
    // Refetch orders with custom date range
  }}
/>
```

## Benefits

1. **Code Reusability**: Single source of truth for date picking UI
2. **Consistency**: Same look and feel across the application
3. **Maintainability**: Updates in one place affect all usages
4. **Type Safety**: Proper TypeScript definitions
5. **Accessibility**: Inherits from Radix UI primitives
6. **Internationalization**: Easy locale switching

## Testing

All components have been checked for linter errors and are ready for use. No runtime errors detected.

## Next Steps

### Potential Improvements
1. Add preset date ranges (Today, This Week, Last 7 Days)
2. Add min/max date restrictions
3. Create time picker variant
4. Add month/year only picker variants
5. Add keyboard shortcuts for common date selections

### Adoption
Consider refactoring these components to use the new DatePicker:
- AdminTable (if using date filters)
- ReceivedInvoices (for date filtering)
- Any other components with inline date selection

## Migration Guide

To migrate existing date picker implementations:

1. **Import the component:**
   ```tsx
   import { DatePicker } from "@/components/ui/date-picker";
   ```

2. **Replace Popover/Calendar code:**
   ```tsx
   // Before
   <Popover>
     <PopoverTrigger asChild>
       <Button>...</Button>
     </PopoverTrigger>
     <PopoverContent>
       <Calendar ... />
     </PopoverContent>
   </Popover>

   // After
   <DatePicker
     date={date}
     onSelect={setDate}
   />
   ```

3. **Remove unused imports:**
   - Remove Calendar, Popover imports
   - Remove format from date-fns (handled internally)
   - Remove locale imports (handled internally)

4. **Update state management:**
   - Ensure state type is `Date | undefined`
   - Update any date filtering logic if needed

## Support

For questions or issues:
1. Check `date-picker.md` documentation
2. Review `DatePickerExamples.tsx` for usage patterns
3. Refer to OrdersTable implementation as reference

