export interface ChangelogEntry {
    date: string;
    changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
    {
        date: '03.03.2026',
        changes: [
            '— Benutzerprofil & Berechtigungen —',
            'Eltern- und Vorstandsmitglieder-Accounts können jetzt ihre Adresse (Straße + Hausnummer, PLZ + Ort) im Profil hinterlegen und bearbeiten',
            'Neue Unterschrift-Funktion: Springerinnen, Eltern und Vorstandsmitglieder können ihre Unterschrift direkt im Browser per Maus, Trackpad oder Finger auf dem Touchscreen zeichnen und speichern – mit Vorschau und der Option, sie jederzeit zu ändern',

            '— Abrechnung —',
            'Neuer Statusfilter auf der Abrechnungsübersicht: Einträge lassen sich jetzt nach Status (Entwurf / Eingereicht / Bezahlt) filtern, ergänzend zu den bestehenden Filtern nach Springerin, Monat und Jahr',
            'PDF-Öffnung in Safari: Popup-Blockierung umgangen – Abrechnungs-PDFs öffnen jetzt zuverlässig in einem neuen Tab',

            '— Eltern-Bereich —',
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
