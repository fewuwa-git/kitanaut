# E-Mail-System – Aufbau & Funktionsweise

## Versanddienst

E-Mails werden über **Resend** verschickt (https://resend.com).
Absenderadresse: `finanzen@pankonauten.de`
API-Key: Umgebungsvariable `RESEND_API_KEY`

---

## Templates

Die E-Mail-Texte werden **nicht im Code** gepflegt, sondern in der Supabase-Datenbank
in der Tabelle `pankonauten_email_templates`. Admins können sie direkt im Portal unter
**Verwaltung → E-Mails** bearbeiten.

### Vorhandene Templates

| ID                  | Verwendung                                              |
|---------------------|---------------------------------------------------------|
| `invite`            | Einladung eines neuen Nutzers (mit Einladungslink)      |
| `approval`          | Freischaltung eines registrierten Accounts durch Admin  |
| `password_reset`    | Passwort-Zurücksetzen-Link                              |
| `abrechnung_bezahlt`| Benachrichtigung an Springerin bei Auszahlung           |

### Variablen in Templates

In Betreff und Inhalt können Platzhalter verwendet werden: `{{variablenname}}`

| Variable  | Verfügbar in                          |
|-----------|---------------------------------------|
| `{{name}}`| allen Templates                       |
| `{{url}}` | invite, approval, password_reset      |
| `{{monat}}`| abrechnung_bezahlt                   |
| `{{jahr}}` | abrechnung_bezahlt                   |
| `{{betrag}}`| abrechnung_bezahlt                  |
| `{{iban}}` | abrechnung_bezahlt                   |

---

## Ablauf beim Versand

1. Eine Funktion aus `src/lib/email.ts` wird aufgerufen (z.B. `sendInviteEmail`)
2. Das Template wird per ID aus der Datenbank geladen
3. Platzhalter im Betreff und Inhalt werden durch die übergebenen Werte ersetzt
4. Die fertige E-Mail wird über die Resend-API verschickt

---

## API-Endpunkte (nur für Admins)

| Methode  | Route                          | Funktion                        |
|----------|--------------------------------|---------------------------------|
| `GET`    | `/api/email-templates`         | Alle Templates abrufen          |
| `GET`    | `/api/email-templates/[id]`    | Einzelnes Template abrufen      |
| `PATCH`  | `/api/email-templates/[id]`    | Template bearbeiten (subject + body) |

---

## Relevante Dateien

- `src/lib/email.ts` – Versandfunktionen
- `src/lib/data.ts` – Datenbankzugriff für Templates (`getEmailTemplate`, `saveEmailTemplate`)
- `src/app/verwaltung/emails/` – UI zum Bearbeiten der Templates
