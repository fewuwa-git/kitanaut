# KI-Workflow Änderungslog

Dieses Log dokumentiert alle Änderungen am KI-Beleganalyse-Workflow.
Relevante Dateien:
- Logik: `src/app/api/receipts/[id]/suggest/route.ts`
- Visualisierung: `src/components/BelegeKiWorkflow.tsx`

---

## 07.03.2026 – Initiale Dokumentation

**Was:** KI-Workflow-Seite erstellt (`/verwaltung/belege?tab=ki-workflow`)

**Aktueller Stand:**

### Modelle
- Extraktion: `gemini-2.5-flash` (Fallback: `gemini-2.0-flash` bei 503/429)
- Matching: `gemini-2.5-flash` mit `thinkingBudget: 0`
- Beide mit `temperature: 0.1`

### Schritt 1 – Extraktion
- Prompt extrahiert: `vendor`, `amount`, `date`, `description`, `invoice_number`
- Max. Output-Tokens: 256
- Gespeicherte DB-Felder: `ai_vendor`, `ai_amount`, `ai_date`, `ai_description`, `ai_invoice_number`

### Schritt 2 – Buchungsfilterung
- Zeitfenster: ±60 Tage um Belegdatum
- Fallback bei < 5 Treffern: alle Buchungen nach Nähe sortiert
- Limit: max. 300 Buchungen
- Nummernabgleich: `invoice_number` + Zahlen ≥4 Stellen aus Dateiname → ★-Markierung

### Schritt 3 – Matching
- Prompt: Beleg-Info + Buchungsliste → Top-3-Vorschläge als JSON
- Max. Output-Tokens: 512
- Format: `{"suggestions":[{"nr":1,"confidence":0.9,"reason":"..."}]}`

### Schritt 4 – Confidence-Korrektur
- Rechnungsnummer stimmt überein (★): confidence = 0.99
- Betrag exakt (Differenz < 0,01€): confidence = 0.85 (nur wenn KI < 0.85)

### Schritt 5 – Speicherung
- Spalte: `ai_suggestions` (jsonb) in `pankonauten_transaction_receipts`
- Format: `[{transaction_id, confidence, reason}]`
