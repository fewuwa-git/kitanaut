export interface ChangelogEntry {
    date: string;
    changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
    {
        date: '03.03.2026',
        changes: [
            'Automatischer Logout nach 24 Stunden Inaktivität – wer aktiv ist, bleibt eingeloggt',
            'Favicon: Das Pankonauten-Logo erscheint jetzt im Browser-Tab',
            'Login-Seite: Passwortfeld wird beim Klick geleert, damit Autofill-Punkte nicht verwirren',
            'Login-Seite: Überflüssige Überschrift „Willkommen zurück" entfernt',
            'Performance: Alle Seiten laden deutlich schneller – Inhalte erscheinen stufenweise statt alles auf einmal zu warten',
            'Performance: Lade-Skeleton (pulsierende Platzhalter) zeigt sofort die Seitenstruktur beim Navigieren',
            'Sicherheit: Globaler Zugriffsschutz für alle Seiten über zentrales Middleware',
        ],
    },
];
