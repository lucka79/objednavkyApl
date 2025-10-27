# MAKRO Invoice Line Pattern

## Sample Lines:
```
482670 1,000 MALINY VANIČKA 125g 53,70 1 53,70 53,70
367021 25,000 MC SALÁT LOLLO BIONDO I. CZ ks 38,59 1 38,59 964,75
456517 2,000 MOCHYNĚ-PHYSALIS 100g 35,37 1 35,37 70,74
437540 2,260 *MC HOT DOG 24x cca. 50g 99,90 1 99,90 225,77
375382 1,000 ARO DORT. KRAB 22x22x9 cm 50x 11,34 50 567,00 567,00
```

## Pattern Structure:
1. **číslo zboží**: 6 digits (e.g., `482670`)
2. **počet**: number with comma separator (e.g., `1,000`)
3. **název zboží**: description, may contain unit at end (e.g., `MALINY VANIČKA 125g`)
4. **zákl. cena**: base price (e.g., `53,70`)
5. **jedn. v MU**: units in MU - integer (e.g., `1` or `50`)
6. **cena za MU**: price per MU (e.g., `53,70` or `567,00`)
7. **cena celkem**: total price (e.g., `53,70` or `567,00`)

## Regex Pattern (10 columns - FULL):
```regex
^(\d+)\s+([\d,\s]+)\s+(\S.*?)\s+([\d,\s]+)\s+(\d+)\s+([\d,\s]+)\s+([\d,\s]+)\s+([\d,\s]+)\s+([\d,\s]+)\s+([\d,\s]+)\s*$
```

**Changes:** 
- `(.+?)` → `(\S.*?)` to ensure description starts with non-whitespace character
- `([\d,]+)` → `([\d,\s]+)` to handle both comma (`,`) and space (` `) as thousand separators (e.g., `1 080,52`)

### Capture Groups (10):
1. `(\d+)` - product code (6 digits)
2. `([\d,\s]+)` - quantity (with comma and/or space separators)
3. `(\S.*?)` - description (non-greedy, starts with non-whitespace, includes unit at end)
4. `([\d,\s]+)` - base price (zákl. cena)
5. `(\d+)` - units in MU (jedn. v MU - integer only)
6. `([\d,\s]+)` - price per MU (cena za MU)
7. `([\d,\s]+)` - total price without VAT (cena celkem)
8. `([\d,\s]+)` - VAT rate (DPH%)
9. `([\d,\s]+)` - VAT amount (DPH CZK)
10. `([\d,\s]+)` - total price with VAT (Celkem s DPH - e.g., `1 080,52`)

## Note:
- The MU (unit) appears to be embedded in the description (e.g., "ks" at the end)
- We need to extract it separately or add it as a separate capture group

