# KI-Workflow Änderungslog

Dieses Log dokumentiert alle Änderungen am KI-Beleganalyse-Workflow.
Relevante Dateien:
- Logik: `src/app/api/receipts/[id]/suggest/route.ts`
- Visualisierung: `src/components/BelegeKiWorkflow.tsx`

---

## 07.03.2026 – Claude als zweiter KI-Anbieter

**Änderung:** Neben Gemini kann jetzt auch Anthropic Claude als KI-Anbieter gewählt werden. Umschaltung in KI-Einstellungen unter „KI-Anbieter".

**Claude-spezifisch:**
- PDFs werden als `document`-Block übergeben (native PDF-Unterstützung)
- Bilder als `image`-Block (Base64, image/webp)
- Kein `thinkingBudget`-Parameter – Claude verwendet eigene Reasoning-Logik
- Modelle: `claude-sonnet-4-6` (Standard), `claude-opus-4-6`, `claude-haiku-4-5-20251001`
- Fallback bei Überlast (`overloaded`-Fehler): Fallback-Modell + 3s Wartezeit

**Technisch:** `suggest/route.ts` verzweigt nach `kiSettings.provider` ('gemini' | 'claude'). Extraktion und Matching laufen jeweils mit dem konfigurierten SDK. Prompts, Buchungsfilterung und Confidence-Korrektur sind provider-unabhängig.

---

## 07.03.2026 – KI-Einstellungen über Datenbank konfigurierbar

**Änderung:** Neue Seite „KI-Einstellungen" in der Belegverwaltung. Alle zentralen Parameter sind jetzt über die UI konfigurierbar und werden in der Tabelle `pankonauten_settings` gespeichert.

**Konfigurierbare Parameter:**
- Gemini API Key (überschreibt `GEMINI_API_KEY` aus `.env`)
- Extraktionsmodell, Matching-Modell, Fallback-Modell
- Zeitfenster ±N Tage (vorher hardcoded 60)
- Max. Buchungen (vorher hardcoded 300)
- Auto-Zuordnung + Schwellenwert

**Technisch:** `src/lib/kiSettings.ts` liest Einstellungen aus DB (Fallback auf `.env`/Defaults). `suggest/route.ts` nutzt jetzt `getKiSettings()` statt Hardcodes.

---

## 07.03.2026 – Fix: thinkingBudget=0 für Extraktion + maxOutputTokens 256→512

**Problem:** Bei mehreren PDFs wurde „Beleginhalt nicht lesbar" angezeigt – alle extrahierten Felder (vendor, amount, date, description) kamen als null zurück.

**Ursache:** `gemini-2.5-flash` hat standardmäßig Thinking aktiviert. Mit `maxOutputTokens: 256` blieb nach dem internen Reasoning kaum Platz für die eigentliche JSON-Ausgabe – die Antwort wurde abgeschnitten und das JSON-Parsing schlug still fehl.

**Änderungen:**
- Extraktionsmodell: `thinkingBudget: 0` gesetzt (war vorher nicht explizit gesetzt → Thinking aktiv)
- Extraktionsmodell: `maxOutputTokens: 256 → 512` erhöht
- Server-Logging hinzugefügt: `[suggest] extract raw response:` für Debugging

**Betroffene Dateien:**
- `src/app/api/receipts/[id]/suggest/route.ts` – Modell-Konfiguration für Extraktion
- `src/components/BelegeKiWorkflow.tsx` – Workflow-Visualisierung synchronisiert

---

## 07.03.2026 – Initiale Dokumentation

**Was:** KI-Workflow-Seite erstellt (`/verwaltung/belege?tab=ki-workflow`)

**Aktueller Stand:**

### Modelle
- Extraktion: `gemini-2.5-flash` mit `thinkingBudget: 0` (Fallback: `gemini-2.0-flash` bei 503/429)
- Matching: `gemini-2.5-flash` mit `thinkingBudget: 0`
- Beide mit `temperature: 0.1`

### Schritt 1 – Extraktion
- Prompt extrahiert: `vendor`, `amount`, `date`, `description`, `invoice_number`
- Max. Output-Tokens: 512
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
