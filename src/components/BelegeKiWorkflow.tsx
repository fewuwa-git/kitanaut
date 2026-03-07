'use client';

import { useState } from 'react';

const STEP_STYLE = {
    display: 'flex',
    gap: 20,
    position: 'relative' as const,
};

const STEP_NUMBER_STYLE = (color: string) => ({
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: color,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
    marginTop: 2,
    zIndex: 1,
    position: 'relative' as const,
});

const CONNECTOR_STYLE = {
    position: 'absolute' as const,
    left: 17,
    top: 40,
    bottom: -24,
    width: 2,
    background: 'var(--border)',
    zIndex: 0,
};

const CODE_STYLE = {
    background: '#1a2e45',
    color: '#e2e8f0',
    borderRadius: 'var(--radius-sm)',
    padding: '12px 16px',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 1.6,
    overflowX: 'auto' as const,
    marginTop: 10,
    whiteSpace: 'pre' as const,
};

const TAG_STYLE = (color: string, bg: string) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    color,
    background: bg,
    marginRight: 4,
});

const FIELD_ROW = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '5px 0',
    borderBottom: '1px solid var(--border)',
    fontSize: 13,
};

interface StepProps {
    number: number;
    color: string;
    title: string;
    subtitle?: string;
    isLast?: boolean;
    children: React.ReactNode;
}

function Step({ number, color, title, subtitle, isLast, children }: StepProps) {
    return (
        <div style={{ ...STEP_STYLE, paddingBottom: isLast ? 0 : 32 }}>
            {!isLast && <div style={CONNECTOR_STYLE} />}
            <div style={STEP_NUMBER_STYLE(color)}>{number}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>{title}</div>
                {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>{subtitle}</div>}
                {children}
            </div>
        </div>
    );
}

function renderLog(content: string) {
    return content.split('\n').map((line, i) => {
        if (line.startsWith('## ')) return <div key={i} style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', marginTop: 20, marginBottom: 6 }}>{line.slice(3)}</div>;
        if (line.startsWith('### ')) return <div key={i} style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginTop: 14, marginBottom: 4 }}>{line.slice(4)}</div>;
        if (line.startsWith('# ')) return <div key={i} style={{ fontWeight: 700, fontSize: 16, color: 'var(--navy)', marginBottom: 8 }}>{line.slice(2)}</div>;
        if (line.startsWith('- ')) return <div key={i} style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 12, lineHeight: 1.7 }}>· {line.slice(2)}</div>;
        if (line.startsWith('**') && line.endsWith('**')) return <div key={i} style={{ fontWeight: 600, fontSize: 13, marginTop: 8 }}>{line.slice(2, -2)}</div>;
        if (line === '---') return <hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />;
        if (line === '') return <div key={i} style={{ height: 4 }} />;
        return <div key={i} style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>{line}</div>;
    });
}

export default function BelegeKiWorkflow() {
    const [logOpen, setLogOpen] = useState(false);
    const [logContent, setLogContent] = useState<string | null>(null);
    const [logLoading, setLogLoading] = useState(false);

    async function openLog() {
        setLogOpen(true);
        if (logContent !== null) return;
        setLogLoading(true);
        const res = await fetch('/api/ki-workflow-log');
        const data = await res.json();
        setLogContent(data.content);
        setLogLoading(false);
    }

    return (
        <div>
            {/* Log Modal */}
            {logOpen && (
                <div
                    onClick={() => setLogOpen(false)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '64px 32px 32px' }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{ background: 'var(--card)', borderRadius: 'var(--radius)', width: 520, maxHeight: '75vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>KI-Workflow Log</span>
                            <button onClick={() => setLogOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', lineHeight: 1 }}>✕</button>
                        </div>
                        <div style={{ overflowY: 'auto', padding: '16px 20px', flex: 1 }}>
                            {logLoading
                                ? <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Lade…</div>
                                : logContent !== null ? renderLog(logContent) : null
                            }
                        </div>
                    </div>
                </div>
            )}

            {/* Header Info */}
            <div className="card mb-6" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 280 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Wie funktioniert die KI-Beleganalyse?</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                            Wenn du auf "KI-Vorschlag" klickst, durchläuft der Beleg automatisch zwei KI-Schritte:
                            zuerst eine <strong>Extraktion</strong> (was steht auf dem Beleg?), dann ein <strong>Matching</strong> (welche Buchung passt dazu?).
                            Alle Ergebnisse werden dauerhaft in der Datenbank gespeichert.
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200, alignItems: 'flex-end' }}>
                        <button
                            onClick={openLog}
                            style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
                        >
                            KI-Log
                        </button>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2, marginTop: 4 }}>VERWENDETE MODELLE</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={TAG_STYLE('#1d4ed8', '#dbeafe')}>Extraktion</span>
                            <span style={{ fontSize: 12, fontFamily: 'monospace' }}>gemini-2.5-flash</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>thinkingBudget=0</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={TAG_STYLE('#6d28d9', '#ede9fe')}>Matching</span>
                            <span style={{ fontSize: 12, fontFamily: 'monospace' }}>gemini-2.5-flash</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>thinkingBudget=0</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={TAG_STYLE('#065f46', '#d1fae5')}>Fallback</span>
                            <span style={{ fontSize: 12, fontFamily: 'monospace' }}>gemini-2.0-flash</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Workflow Steps */}
            <div className="card" style={{ padding: '28px 28px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 28, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: 11 }}>
                    ABLAUF SCHRITT FÜR SCHRITT
                </div>

                <Step number={1} color="#3b82f6" title="Beleg aus Storage laden"
                    subtitle="API-Route: POST /api/receipts/[id]/suggest">
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        Der Beleg wird anhand der <code style={{ fontSize: 12, background: 'var(--bg)', padding: '1px 5px', borderRadius: 3 }}>id</code> aus der Tabelle
                        {' '}<code style={{ fontSize: 12, background: 'var(--bg)', padding: '1px 5px', borderRadius: 3 }}>pankonauten_transaction_receipts</code> geladen.
                        Dann wird die Datei aus dem Supabase Storage Bucket heruntergeladen und als Base64 kodiert.
                    </div>
                    <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>STORAGE BUCKET</div>
                        <div style={{ ...FIELD_ROW, borderBottom: 'none' }}>
                            <span style={TAG_STYLE('#1d4ed8', '#dbeafe')}>bucket</span>
                            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>transaction-receipts</span>
                        </div>
                        <div style={{ ...FIELD_ROW, borderBottom: 'none' }}>
                            <span style={TAG_STYLE('#374151', '#f3f4f6')}>mime</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>PDF → application/pdf · Bilder → image/webp</span>
                        </div>
                    </div>
                </Step>

                <Step number={2} color="#8b5cf6" title="Schritt 1: KI-Extraktion"
                    subtitle="Gemini liest den Beleg und extrahiert strukturierte Daten">
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        Das Belegbild/PDF wird direkt an die KI übergeben (multimodal). <strong>thinkingBudget=0</strong> ist gesetzt,
                        damit alle 512 Output-Tokens für die JSON-Ausgabe verfügbar sind und nicht für internes Reasoning verbraucht werden.
                        Der folgende Prompt wird verwendet:
                    </div>
                    <div style={CODE_STYLE}>{`Extrahiere aus diesem Beleg: Aussteller/Firma, Betrag (Zahl),
Datum (YYYY-MM-DD), kurze Beschreibung, Rechnungsnummer oder
Auftragsnummer (nur die Zahl/Nummer).
Antworte NUR mit JSON (kein Markdown):
{
  "vendor": "...",
  "amount": 0.00,
  "date": "YYYY-MM-DD",
  "description": "...",
  "invoice_number": "..."
}
Falls ein Wert nicht erkennbar ist, setze null.`}</div>
                    <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>WIRD IN DB GESPEICHERT (sofort nach Extraktion)</div>
                        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                            {[
                                ['ai_vendor', 'text', 'Extrahierter Aussteller/Firmenname'],
                                ['ai_amount', 'numeric', 'Extrahierter Betrag'],
                                ['ai_date', 'date', 'Extrahiertes Rechnungsdatum'],
                                ['ai_description', 'text', 'Kurze Beschreibung des Belegs'],
                                ['ai_invoice_number', 'text', 'Rechnungs- oder Auftragsnummer'],
                            ].map(([field, type, desc], i, arr) => (
                                <div key={field} style={{ ...FIELD_ROW, padding: '8px 12px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, minWidth: 160 }}>{field}</span>
                                    <span style={TAG_STYLE('#374151', '#f3f4f6')}>{type}</span>
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Step>

                <Step number={3} color="#f59e0b" title="Buchungskandidaten filtern & priorisieren"
                    subtitle="Zeitfenster ±60 Tage · max. 300 Buchungen · Nummernabgleich">
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        Alle Buchungen aus der Datenbank werden nach Relevanz gefiltert und sortiert, bevor sie an die KI übergeben werden.
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                            { label: 'Zeitfenster', value: '±60 Tage um das Belegdatum. Falls weniger als 5 Treffer: alle Buchungen, sortiert nach Nähe.' },
                            { label: 'Limit', value: 'Maximal 300 Buchungen werden an die KI übergeben.' },
                            { label: 'Nummernabgleich', value: 'Rechnungsnummer (aus KI-Extraktion) + Zahlen aus dem Dateinamen (≥4 Stellen) werden in Buchungsbeschreibung/-gegenüber gesucht. Treffer werden mit ★ markiert und nach oben sortiert.' },
                        ].map(({ label, value }) => (
                            <div key={label} style={{ display: 'flex', gap: 10, fontSize: 13 }}>
                                <span style={{ fontWeight: 600, minWidth: 140, color: 'var(--text)' }}>{label}</span>
                                <span style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{value}</span>
                            </div>
                        ))}
                    </div>
                    <div style={CODE_STYLE}>{`Format pro Buchung:
[★] Nr | Datum | Gegenüber | Beschreibung | Betrag€

Beispiel:
★  1 | 2025-11-03 | REWE GmbH | Einkauf Büromaterial | -48.90€
   2 | 2025-11-01 | Amazon     | Bestellung 4892-AB   | -120.00€`}</div>
                </Step>

                <Step number={4} color="#8b5cf6" title="Schritt 2: KI-Matching"
                    subtitle="Gemini vergleicht Beleg mit Buchungsliste und nennt die 3 besten Treffer">
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        Das Belegbild/PDF wird erneut übergeben – zusammen mit der gefilterten Buchungsliste. <strong>thinkingBudget=0</strong> verhindert,
                        dass das Modell in einen langen Denkmodus wechselt, was sonst die JSON-Ausgabe stört.
                    </div>
                    <div style={CODE_STYLE}>{`Beleg-Info: Aussteller="[vendor]", Betrag=[amount]€, Datum=[date]
Rechnungs-/Auftragsnummern aus Beleg/Dateiname: [numbers]
– Buchungen mit ★ enthalten diese Nummer.

Buchungen (★=Nummernübereinstimmung | Nr | Datum | Gegenüber | Beschreibung | Betrag):
[gefilterte Buchungsliste]

Welche 3 Buchungen passen am besten zu diesem Beleg?
★-markierte Buchungen haben sehr hohe Priorität.
Antworte NUR mit JSON (kein Markdown), reason max. 8 Wörter auf Deutsch:
{
  "suggestions": [
    {"nr": 1, "confidence": 0.9, "reason": "..."},
    ...
  ]
}`}</div>
                </Step>

                <Step number={5} color="#10b981" title="Confidence-Korrektur (regelbasiert)"
                    subtitle="Harte Fakten überschreiben die KI-Einschätzung">
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                        Die KI-Confidence wird durch deterministische Regeln überschrieben, wenn objektive Fakten vorliegen:
                    </div>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                        {[
                            { rule: 'Rechnungsnummer stimmt überein (★)', confidence: '0.99', color: '#065f46', bg: '#d1fae5', reason: '"Rechnungsnummer stimmt überein"' },
                            { rule: 'Betrag stimmt exakt (Differenz < 0,01€)', confidence: '0.85', color: '#1e40af', bg: '#dbeafe', reason: '"Betrag stimmt überein"', cond: 'nur wenn KI < 0.85' },
                            { rule: 'Keine harten Fakten vorhanden', confidence: 'KI-Wert', color: '#374151', bg: '#f3f4f6', reason: 'Original KI-Begründung' },
                        ].map(({ rule, confidence, color, bg, reason, cond }, i, arr) => (
                            <div key={rule} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                                <div style={{ width: 44, height: 28, borderRadius: '14px', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                                    {confidence}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 500 }}>{rule}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                                        Grund: {reason}{cond ? <span style={{ marginLeft: 6, opacity: 0.7 }}>({cond})</span> : null}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Step>

                <Step number={6} color="#3b82f6" title="Vorschläge in DB speichern"
                    subtitle="Ergebnisse werden dauerhaft gespeichert und beim nächsten Seitenaufruf wiederhergestellt"
                    isLast>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 12 }}>
                        Die fertigen Vorschläge werden als JSON-Array in der Datenbank gespeichert. Beim nächsten Laden der Seite werden sie
                        automatisch wiederhergestellt – kein erneuter KI-Aufruf nötig.
                    </div>
                    <div style={CODE_STYLE}>{`-- Spalte: ai_suggestions (jsonb)
-- Tabelle: pankonauten_transaction_receipts

[
  {
    "transaction_id": "uuid-der-buchung",
    "confidence": 0.99,
    "reason": "Rechnungsnummer stimmt überein"
  },
  {
    "transaction_id": "uuid-der-buchung",
    "confidence": 0.87,
    "reason": "Betrag und Datum passen"
  }
]`}</div>
                    <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 13 }}>
                        <strong>Beim Seitenaufruf:</strong> Die gespeicherten <code style={{ fontSize: 12 }}>transaction_id</code>-Werte werden mit der
                        Buchungstabelle gejoint, damit vollständige Buchungsdaten angezeigt werden können – ohne erneuten KI-Aufruf.
                    </div>
                </Step>
            </div>
        </div>
    );
}
