export interface ChangelogEntry {
    date: string;
    changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
    {
        date: '04.03.2026',
        changes: [
            '— Benutzerprofil & Berechtigungen —',
            'Eltern- und Vorstandsmitglieder können jetzt auch ihre IBAN im Profil hinterlegen',

            '— Belege —',
            'Beleg-PDF: Seitentitel aller Seiten angepasst – jede Seite zeigt jetzt einen passenden Namen im Browser-Tab',
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
