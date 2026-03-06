export interface ChangelogEntry {
    date: string;
    changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
    {
        date: '06.03.2026',
        changes: [
            '— Kategorien —',
            'Neue Seite „Import-Regeln": Automatische Kategorie-Zuweisung beim CSV-Import konfigurieren – über Stichwörter im Verwendungszweck oder Empfängernamen. Bedingungen: enthält, beginnt mit, exakt. Priorität steuerbar.',
            'Live-Tester auf der Regelseite: Verwendungszweck und Empfänger eingeben und sofort sehen, welche Regel greifen würde.',
            'Im CSV-Import erscheint in der Vorschau jetzt eine Kategorie-Spalte – automatisch zugewiesene Kategorien werden direkt angezeigt, bevor der Import bestätigt wird.',
            'Neue Funktion auf der Regelseite: Regeln lassen sich auf alle bestehenden Buchungen anwenden – wahlweise nur für noch nicht kategorisierte Buchungen oder als vollständige Neukategorisierung aller Buchungen.',
        ],
    },
    {
        date: '05.03.2026',
        changes: [
            '— CSV-Import —',
            'Duplikat-Erkennung verbessert: Buchungen mit identischem Datum, Betrag, Beschreibung und Gegenüber werden jetzt korrekt als separate Buchungen importiert, wenn sie mehrfach in der CSV vorkommen – z.B. zwei gleich hohe Auslagen am selben Tag.',
            '— Verwaltung —',
            'Neue Seite „Zugriffsrechte": Admins sehen auf einen Blick, welche Rollen auf welche Seiten zugreifen dürfen.',
            'Der Bereich „Verwaltung" in der Navigation lässt sich für Admins ein- und ausklappen.',
            'Neue Funktion „Ansicht wechseln": Admins können die Oberfläche aus der Perspektive eines anderen Nutzers erleben – mit Suche und alphabetischer Sortierung.',
            'Seiten mit eingeschränktem Zugriff zeigen jetzt eine strukturierte Hinweisseite mit Navigation statt einer leeren Fehlermeldung.',
            '— CSV-Import —',
            'Beim Hochladen einer CSV-Datei erscheint jetzt eine Spaltenzuordnung: Man kann auswählen, welche Spalte der CSV welchem Feld entspricht (Datum, Beschreibung, Gegenüber, Betrag, Saldo). Die Zuordnung wird automatisch erkannt und für den nächsten Import gespeichert.',
            'Der Kontostand (Saldo) wird jetzt direkt aus der CSV-Datei übernommen, sofern die Spalte zugeordnet ist – statt ihn aus den Beträgen neu zu berechnen.',
            '— Logfiles —',
            'Neue Seite „Logfiles" (nur für Admins): Protokolliert alle relevanten Aktionen – Belege erstellen, einreichen und bezahlen, Abrechnungen erstellen, einreichen und bezahlen, sowie CSV-Importe.',
        ],
    },
    {
        date: '04.03.2026',
        changes: [
            '— Abrechnungen —',
            'Beim Erfassen eines neuen Tages ist das Datumsfeld jetzt vorausgefüllt – mit dem heutigen Tag (im aktuellen Monat) oder dem 1. des gewählten Monats. Nur noch den Tag anpassen.',
            'Beim Markieren einer Abrechnung als „Bezahlt" kann nun gewählt werden, ob eine Benachrichtigungs-E-Mail an die Springerin gesendet werden soll (Checkbox im Bestätigungsdialog, standardmäßig aktiviert).',
            'Springerinnen erhalten automatisch eine E-Mail, wenn ihre Abrechnung als „Bezahlt" markiert wird – mit Betrag, IBAN und einer persönlichen Dankesnachricht.',

            '— Verwaltung —',
            'Neuer Bereich „E-Mails": Admins können die Texte aller automatisch versendeten E-Mails (Einladung, Freischaltung, Passwort-Reset) direkt im Portal bearbeiten – inkl. Betreff, Inhalt und Live-Vorschau.',

            '— Registrierung & Zugangsverwaltung —',
            'Neue Registrierungsseite: Benutzer können sich selbst registrieren. Der Account wird erst nach manueller Freischaltung durch einen Admin aktiviert.',
            'Admins sehen ausstehende Registrierungen in der Benutzerverwaltung und können Rolle zuweisen und freischalten – oder ablehnen.',
            'Nach der Freischaltung erhält der Benutzer automatisch eine Bestätigungs-E-Mail mit Login-Link.',
            'Neue Funktion „Passwort vergessen": Benutzer können sich einen Reset-Link per E-Mail zuschicken lassen.',
            'Benutzer bearbeiten öffnet jetzt eine eigene Seite statt eines Modals.',

            '— Benutzerverwaltung —',
            'Beim Anlegen eines neuen Benutzers wird die Einladungs-E-Mail nicht mehr automatisch versendet. Stattdessen erscheint ein Dialog mit dem Einladungslink und der Option, die E-Mail auf Wunsch manuell zu senden.',
            'Neuer Einladungs-Workflow: Admins können Benutzer jetzt per E-Mail einladen – kein Passwort mehr manuell vergeben. Der neue Benutzer erhält eine Einladungsmail und setzt sein Passwort selbst.',
            'Einladungslink wird nach dem Anlegen eines Benutzers auch direkt im Admin-Bereich angezeigt und kann per Klick kopiert werden.',
            'Eingeladene (noch nicht aktivierte) Benutzer werden in der Benutzerliste mit dem Hinweis „Eingeladen" gekennzeichnet.',
            'Login-Sperre für nicht aktivierte Accounts: Wer die Einladung noch nicht angenommen hat, sieht beim Login einen Hinweis, die E-Mails zu prüfen.',

            '— Benutzerprofil & Berechtigungen —',
            'Eltern- und Vorstandsmitglieder können jetzt auch ihre IBAN im Profil hinterlegen',

            '— Belege —',
            'Beleg-PDF: Seitentitel aller Seiten angepasst – jede Seite zeigt jetzt einen passenden Namen im Browser-Tab',

            '— Benutzerprofil —',
            'Unterschrift wird jetzt sofort gespeichert, ohne auf „Änderungen speichern" zu klicken – außerdem kann die Unterschrift nun gelöscht werden.',
            'Admins können den Stundensatz einer Abrechnung auch dann neu berechnen, wenn diese bereits als „Bezahlt" markiert ist.',

            '— Sicherheit —',
            'Umfassendes Sicherheits-Update: Alle API-Routen sind jetzt geschützt, Tokens werden sicherer generiert, und zahlreiche weitere Sicherheitslücken wurden geschlossen.',
        ],
    },
    {
        date: '03.03.2026',
        changes: [
            '— Benutzerprofil & Berechtigungen —',
            'Eltern- und Vorstandsmitglieder-Accounts können jetzt ihre Adresse (Straße + Hausnummer, PLZ + Ort) im Profil hinterlegen und bearbeiten',
            'Neue Unterschrift-Funktion: Springerinnen, Eltern und Vorstandsmitglieder können ihre Unterschrift direkt im Browser per Maus, Trackpad oder Finger auf dem Touchscreen zeichnen und speichern – mit Vorschau und der Option, sie jederzeit zu ändern',

            '— Abrechnung —',
            'Neuer Statusfilter auf der Abrechnungsübersicht: Einträge lassen sich jetzt nach Status (Entwurf / Eingereicht / Bezahlt) filtern, ergänzend zu den bestehenden Filtern nach Springerin, Monat und Jahr',
            'Abrechnungs-PDF: Die hinterlegte Unterschrift erscheint jetzt im PDF neben der Zusammenfassung – mit Linie und Name darunter, wie eine echte Unterschrift. Wenn keine Unterschrift hinterlegt ist, bleibt der Bereich leer',
            'PDF-Öffnung in Safari: Popup-Blockierung umgangen – Abrechnungs-PDFs öffnen jetzt zuverlässig in einem neuen Tab',

            '— Eltern-Bereich —',
            'Neue Seite „Meine Belege": Eltern, Vorstandsmitglieder und Admins können Belege verwalten – mit Filter nach Benutzer und Status (Entwurf / Eingereicht / Genehmigt / Abgelehnt)',
            'Beleg erstellen: Formular mit Netto/Brutto-Berechnung, optionaler 19% MwSt., automatischer Belegnummer (BEL-YYYY-NNN), Adresse aus dem Profil und Ort/Datum vorausgefüllt mit Berlin und aktuellem Datum',
            'Beleg bearbeiten: Entwürfe können nachträglich bearbeitet werden; nach dem Einreichen ist der Beleg gesperrt',
            'Beleg einreichen: Entwürfe können mit einem Klick eingereicht werden – Admins können eingereichte Belege genehmigen oder ablehnen',
            'Beleg löschen: Entwürfe können gelöscht werden; nach dem Einreichen ist das Löschen nicht mehr möglich',
            'Admin-Funktion: Beim Erstellen eines Belegs kann der Admin den Beleg einer anderen Person (Eltern / Vorstand) zuweisen',
            'Beleg-PDF: Layout nach Avery Zweckform 1205 – zweispaltiger Kopfbereich (Adresse + Beträge), EUR in Worten, Verwendungszweck, Zu Gunsten/Lasten, Ort/Datum und Unterschrift; zusätzliche Beschreibung erscheint im Feld Buchungsvermerke',
            'Eltern-Accounts können sich einloggen und sehen ihre eigenen Buchungen sowie ihr Benutzerprofil',
            'Neue Seite „Meine Buchungen": Eltern sehen ausschließlich ihre eigenen Buchungen; Admins können per Dropdown zwischen allen Eltern-Accounts wechseln',
            'Neuer Sidebar-Bereich „Eltern" mit direktem Link zu den Buchungen – sichtbar für Eltern, Vorstandsmitglieder und Admins',
            'Sidebar: Menüpunkt umbenannt von „Eltern-Buchungen" in „Meine Buchungen"',

            '— Allgemein & Technik —',
            'Automatischer Logout nach 24 Stunden Inaktivität – wer aktiv ist, bleibt eingeloggt',
            'Das Pankonauten-Logo erscheint jetzt als Favicon im Browser-Tab',
            'Alle Seiten laden deutlich schneller – Inhalte erscheinen stufenweise mit sichtbarem Lade-Skeleton statt auf alles auf einmal zu warten',
            'Login-Seite: Passwortfeld wird beim Klick geleert, damit Autofill-Punkte nicht verwirren; überflüssige Überschrift entfernt',
            'Globaler Zugriffsschutz für alle Seiten über eine zentrale Middleware',
        ],
    },
];
