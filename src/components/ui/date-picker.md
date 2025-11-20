# DatePicker Component

A reusable date picker component built with Radix UI Popover and Calendar components.

## Features

- Single date selection
- Customizable placeholder text
- Support for different locales (defaults to Czech - `cs`)
- Disabled state support
- Consistent styling with shadcn/ui design system

## Usage

### Basic Example

```tsx
import { DatePicker } from "@/components/ui/date-picker";
import { useState } from "react";

function MyComponent() {
  const [date, setDate] = useState<Date>();

  return (
    <DatePicker
      date={date}
      onSelect={setDate}
    />
  );
}
```

### With Custom Placeholder

```tsx
<DatePicker
  date={selectedDate}
  onSelect={setSelectedDate}
  placeholder="Pick a delivery date"
/>
```

### With Custom Width

```tsx
<DatePicker
  date={date}
  onSelect={setDate}
  className="w-[200px]"
/>
```

### Disabled State

```tsx
<DatePicker
  date={date}
  onSelect={setDate}
  disabled={true}
/>
```

### With Different Locale

```tsx
import { enUS } from "date-fns/locale";

<DatePicker
  date={date}
  onSelect={setDate}
  locale={enUS}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `date` | `Date \| undefined` | `undefined` | The currently selected date |
| `onSelect` | `(date: Date \| undefined) => void` | `undefined` | Callback when a date is selected |
| `placeholder` | `string` | `"Vyberte datum"` | Placeholder text when no date is selected |
| `className` | `string` | `undefined` | Additional CSS classes for the button |
| `disabled` | `boolean` | `false` | Whether the picker is disabled |
| `locale` | `Locale` | `cs` (Czech) | Date-fns locale for formatting |

## Implementation Details

- Built on top of Radix UI Popover and Calendar
- Uses date-fns for date formatting
- Fully accessible (keyboard navigation, screen readers)
- Integrated with shadcn/ui theming system

## Related Components

- `Calendar` - The underlying calendar component
- `Popover` - The container component
- `Button` - The trigger button

## Examples in Codebase

### OrdersTable Component

```tsx
<DatePicker
  date={date}
  onSelect={setDate}
  placeholder="Vyberte datum"
  className="w-[150px]"
/>
```

## Future Enhancements

Potential additions to this component:

1. **Date Range Picker**: Support for selecting start and end dates
2. **Preset Ranges**: Quick selection like "Last 7 days", "This month"
3. **Min/Max Dates**: Restrict selectable dates
4. **Multiple Date Selection**: Allow selecting multiple dates
5. **Time Picker**: Add time selection alongside date

