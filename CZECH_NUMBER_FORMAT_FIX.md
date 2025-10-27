# Oprava problému s českým formátováním čísel v šablonách faktur

## Problém
Při zpracování faktury od dodavatele Pešek-Rambousek (ID: `62c56662-5459-481c-91ca-30575596c9c5`) se v "Extrahované položky" zobrazuje:
- **Očekáváno**: cena celkem = `11 650,00` Kč
- **Zobrazeno**: cena celkem = `650,00` Kč

### Příklad z faktury
```
máslo blok 25kg Brazzale
0682 50kg 233,00 12 % 11 650,00
```

## Příčina
České faktury používají **mezery jako oddělovače tisíců** (např. `11 650,00`).

Regex vzor **MUSÍ** obsahovat `\s` (mezera) v číselných skupinách, jinak se zachytí jen část za mezerou:
- ❌ **ŠPATNĚ**: `([\d,]+)` → zachytí pouze `"650,00"` z `"11 650,00"`
- ✅ **SPRÁVNĚ**: `([\d\s,]+)` → zachytí celé `"11 650,00"`

## Řešení pro Pešek-Rambousek (dvouřádkový formát)

### 1. Otevřete šablonu dodavatele
Admin → Šablony faktur → Vyberte dodavatele Pešek-Rambousek

### 2. Nastavte typ zobrazení
V poli **"Typ zobrazení položek"** vyberte: **"Dvouřádkové položky (Pešek-Rambousek)"**

### 3. Aktualizujte line_pattern v JSON konfiguraci

Najděte sekci `table_columns` → `line_pattern` a použijte tento vzor:

```json
{
  "table_columns": {
    "line_pattern": "^([^\\n]+?)\\s*\\n\\s*(\\d+)\\s+([\\d\\s,]+)\\s*([a-zA-Zěščřžýáíéúů]{1,8})\\s+([\\d\\s,]+)\\s+\\d+\\s*%?\\s*([\\d\\s,\\.]+)"
  }
}
```

### Vysvětlení vzoru pro dvouřádkový formát:

```
máslo blok 25kg Brazzale          ← řádek 1
0682 50kg 233,00 12 % 11 650,00   ← řádek 2
```

**Zachycené skupiny:**
1. `([^\\n]+?)` → **description**: `máslo blok 25kg Brazzale`
2. `(\\d+)` → **product_code**: `0682`
3. `([\\d\\s,]+)` → **quantity**: `50` (mezery povoleny! ✓)
4. `([a-zA-Zěščřžýáíéúů]{1,8})` → **unit**: `kg`
5. `([\\d\\s,]+)` → **unit_price**: `233,00` (mezery povoleny! ✓)
6. `(\\d+\\s*%?)` → VAT% (nezachyceno, přeskočeno)
7. `([\\d\\s,\\.]+)` → **total**: `11 650,00` (mezery povoleny! ✓)

### 4. Důležité body

⚠️ **Všechny číselné skupiny MUSÍ obsahovat `\\s`:**
- ✅ `([\\d\\s,]+)` - správně
- ✅ `([\\d\\s,\\.]+)` - správně  
- ❌ `([\\d,]+)` - špatně, nezachytí mezery!

### 5. Otestujte šablonu
Po uložení šablony klikněte na **"Test šablony"** a nahrajte ukázkovou fakturu od Pešek-Rambousek.

## Kompletní příklad konfigurace

```json
{
  "display_layout": "two-line",
  "ocr_settings": {
    "dpi": 300,
    "language": "ces",
    "psm": 6
  },
  "patterns": {
    "invoice_number": "Číslo dokladu\\s+(\\d+)",
    "date": "Datum uskutečnění plnění:\\s*(\\d{1,2}\\.\\d{1,2}\\.\\d{4})",
    "total_amount": "Celková částka[^:]*:\\s*([\\d\\s,]+)",
    "table_start": "Označení dodávky"
  },
  "table_columns": {
    "line_pattern": "^([^\\n]+?)\\s*\\n\\s*(\\d+)\\s+([\\d\\s,]+)\\s*([a-zA-Zěščřžýáíéúů]{1,8})\\s+([\\d\\s,]+)\\s+\\d+\\s*%?\\s*([\\d\\s,\\.]+)"
  }
}
```

## Backend zpracování
Backend Python služba (`extract_number()`) automaticky odstraní mezery a převede čárky na tečky:
```python
cleaned = text.replace(' ', '').replace(',', '.')
# "11 650,00" → "11650.00"
```

**Proto je klíčové, aby regex nejdříve zachytil celé číslo včetně mezer!**

## Kontrola
Po nastavení by se měly zobrazovat správné hodnoty:
- **Množství**: `50 kg`
- **Jedn. cena**: `233,00 Kč`
- **Celkem**: `11 650,00 Kč` ✓ (ne `650,00`!)

---

**Vytvořeno:** 2025-10-27  
**Pro dodavatele:** Pešek-Rambousek (ID: 62c56662-5459-481c-91ca-30575596c9c5)

