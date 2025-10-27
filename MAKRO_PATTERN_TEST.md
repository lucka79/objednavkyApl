# Testing MAKRO Pattern

## Lines that don't match:
```
456517 2,000  MOCHYNĚ-PHYSALIS 100g 35,37 1 35,37 70,74 12,0 8,49 79,23
295821 2,000  SALÁM PL. HERKULES 750G 140,86 1 140,86 281,72 12,0 33,81 315,53
209697 4,000  BONECO OMÁČ. 1250g HORČICOVÁ 141,37 1 141,37 565,48 12,0 67,86 633,34
```

## Issue: 
Double space before description

## Updated Pattern (handles variable spacing):
```regex
^(\d+)\s+([\d,]+)\s+(.+?)\s+([\d,]+)\s+(\d+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s*$
```

This should already work, but let's make the description capture more robust:

```regex
^(\d+)\s+([\d,]+)\s+(.+?)\s+([\d,]+)\s+(\d+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)(?:\s+.*)?$
```

Or better yet, trim spaces from description in post-processing.

## Best Pattern (explicit about numeric fields):
```regex
^(\d+)\s+([\d,]+)\s+(.+?)(?:\s+)([\d,]+)\s+(\d+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s*$
```

Actually, the simplest fix is to make sure we trim the description and be more explicit about where numbers start:

```regex
^(\d+)\s+([\d,]+)\s+(.+?)\s+([\d,]+)\s+(\d+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s*$
```

This should work if we add `.strip()` to the description in Python.

