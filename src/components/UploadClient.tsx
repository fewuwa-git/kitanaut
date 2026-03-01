'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import Sidebar from '@/components/Sidebar';

interface User {
    name: string;
    email: string;
    role: string;
}

interface PreviewRow {
    date: string;
    description: string;
    counterparty: string;
    amount: number;
    category: string;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
    'Elternbeiträge': ['eltern', 'beitrag', 'familie', 'mueller', 'schmidt', 'wagner', 'klein', 'becker', 'hoffmann', 'fischer', 'weber', 'wolf'],
    'Fördermittel Senat': ['senat', 'förder', 'zuschuss', 'verwaltung berlin'],
    'Spenden': ['spen', 'förderverein', 'anonym'],
    'Miete': ['miete', 'wohnungs', 'pacht'],
    'Personal': ['gehalt', 'lohn', 'personal', 'sozial'],
    'Lebensmittel': ['metro', 'bio', 'rewe', 'edeka', 'lebensmittel', 'lidl', 'aldi'],
    'Bastelmaterial': ['modulor', 'idee', 'bastel', 'kreativ'],
    'Versicherungen': ['versicher', 'arag', 'aon'],
    'Strom & Gas': ['vattenfall', 'gas', 'strom', 'energie', 'stadtwerke'],
    'Reinigung': ['reinig', 'putzen', 'clean'],
    'Verwaltung': ['steuerberat', 'datev', 'bank', 'gebühr', 'konto', 'post'],
    'Reparaturen': ['handwerk', 'reparatur', 'wartung', 'schreiner', 'elektriker'],
};

function guessCategory(description: string, counterparty: string): string {
    const text = `${description} ${counterparty}`.toLowerCase();
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some((k) => text.includes(k))) return cat;
    }
    return 'Sonstige';
}

interface UploadClientProps {
    user: User;
}

export default function UploadClient({ user }: UploadClientProps) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<PreviewRow[]>([]);
    const [dragging, setDragging] = useState(false);
    const [fileName, setFileName] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    const [namesToAnonymize, setNamesToAnonymize] = useState<string[]>([]);
    const [newNameInput, setNewNameInput] = useState('');
    const [pasteArea, setPasteArea] = useState('');

    useEffect(() => {
        const stored = localStorage.getItem('anonymizeNames');
        if (stored) {
            try {
                setNamesToAnonymize(JSON.parse(stored));
            } catch {
                setNamesToAnonymize(['Annett Kirchner', 'Marlene Brecht']);
            }
        } else {
            setNamesToAnonymize(['Annett Kirchner', 'Marlene Brecht']);
        }
    }, []);

    const saveNames = (names: string[]) => {
        setNamesToAnonymize(names);
        localStorage.setItem('anonymizeNames', JSON.stringify(names));
    };

    const handleAddName = () => {
        const trimmed = newNameInput.trim();
        if (trimmed && !namesToAnonymize.includes(trimmed)) {
            saveNames([...namesToAnonymize, trimmed]);
            setNewNameInput('');
        }
    };

    const handleRemoveName = (nameToRemove: string) => {
        const updated = namesToAnonymize.filter(name => name !== nameToRemove);
        saveNames(updated);
    };

    const anonymizeText = useCallback((text: string): string => {
        if (!text) return text;
        let result = text;
        for (const name of namesToAnonymize) {
            const regex = new RegExp(name, 'gi');
            result = result.replace(regex, '********');
        }
        return result;
    }, [namesToAnonymize]);



    const processCSV = useCallback((file: File) => {
        setFileName(file.name);
        setError('');
        setSuccess('');
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rows = results.data as Record<string, string>[];
                const parsed: PreviewRow[] = rows.map((row) => {
                    // Try common bank CSV column names
                    let date = row['Buchungstag'] || row['date'] || row['Datum'] || row['Date'] || '';
                    if (date.includes('.')) {
                        const parts = date.split('.');
                        if (parts.length === 3) {
                            let dtYear = parts[2];
                            if (dtYear.length === 2) dtYear = '20' + dtYear;
                            date = `${dtYear}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                        }
                    }
                    let description = row['Buchungstext'] || row['description'] || row['Verwendungszweck'] || row['Description'] || '';
                    let counterparty = row['Beguenstigter/Zahlungspflichtiger'] || row['counterparty'] || row['Auftraggeber'] || row['Payee'] || '';

                    description = anonymizeText(description);
                    counterparty = anonymizeText(counterparty);
                    const amountStr = row['Betrag'] || row['amount'] || row['Amount'] || row['Umsatz'] || '0';
                    const amount = parseFloat(amountStr.replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
                    const category = guessCategory(description, counterparty);
                    return { date, description, counterparty, amount, category };
                }).filter((r) => r.date && r.amount !== 0);
                setPreview(parsed);
            },
            error: () => setError('CSV-Datei konnte nicht gelesen werden.'),
        });
    }, [anonymizeText]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) {
            processCSV(file);
        } else {
            setError('Bitte eine CSV-Datei hochladen.');
        }
    }, [processCSV]);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processCSV(file);
    }, [processCSV]);

    const handlePasteProcess = () => {
        if (!pasteArea.trim()) return;
        setError('');
        setSuccess('');

        const lines = pasteArea.split('\n').filter(l => l.trim());
        const parsed: PreviewRow[] = lines.map(line => {
            const cols = line.split('\t');
            if (cols.length < 5) return null;

            // Mapping based on provided sample:
            // 26.11.2025 (0) | meine krankenkasse (1) | Beitraege... (2) | SEPA Zahlung (3) | -2.048,60 (4) | 1.320,97 (5) | Krankenkasse (6)
            let date = cols[0]?.trim() || '';
            if (date.includes('.')) {
                const parts = date.split('.');
                if (parts.length === 3) {
                    let dtYear = parts[2];
                    if (dtYear.length === 2) dtYear = '20' + dtYear;
                    date = `${dtYear}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
            let counterparty = cols[1]?.trim() || '';
            let description = cols[2]?.trim() || '';
            const amountStr = cols[4]?.trim() || '0';

            description = anonymizeText(description);
            counterparty = anonymizeText(counterparty);
            const amount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.')) || 0;
            const category = guessCategory(description, counterparty);

            return { date, description, counterparty, amount, category };
        }).filter((r): r is PreviewRow => r !== null && r.date !== '' && r.amount !== 0);

        if (parsed.length === 0) {
            setError('Keine gültigen Transaktionen im Text gefunden. Bitte Tab-getrennten Text einfügen.');
        } else {
            setPreview(parsed);
            setPasteArea('');
        }
    };

    const handleImport = async () => {
        if (preview.length === 0) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transactions: preview }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            if (data.imported < preview.length) {
                const duplicates = preview.length - data.imported;
                setSuccess(`✅ ${data.imported} neue Buchungen importiert! (${duplicates} Duplikate ignoriert)`);
            } else {
                setSuccess(`✅ ${data.imported} Buchungen erfolgreich importiert!`);
            }

            setPreview([]);
            setFileName('');
            setTimeout(() => router.push('/dashboard'), 3500);
        } catch {
            setError('Import fehlgeschlagen. Bitte versuche es erneut.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-layout">
            <Sidebar user={user} />
            <main className="main-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Kontoauszug hochladen</h1>
                        <p>CSV-Datei importieren und Transaktionen einlesen</p>
                    </div>
                </div>
                <div className="page-body">
                    {/* Drop Zone */}
                    <div className="card mb-6">
                        <div className="card-body">
                            <div
                                className={`upload-zone ${dragging ? 'drag-over' : ''}`}
                                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="upload-zone-icon">📄</div>
                                <h3>{fileName || 'CSV-Datei hier ablegen'}</h3>
                                <p>{fileName ? 'Klicken zum Ändern' : 'oder klicken zum Auswählen · CSV-Format'}</p>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                style={{ display: 'none' }}
                                onChange={handleFileChange}
                            />

                            <div className="paste-zone mt-6">
                                <div className="paste-zone-header">
                                    <h4>Oder Daten hier einfügen</h4>
                                    <span className="text-muted" style={{ fontSize: '11px' }}>Kopiert aus Excel oder Online-Banking Tabelle (Tab-getrennt)</span>
                                </div>
                                <textarea
                                    className="paste-area"
                                    placeholder="Datum	Gegenüber	Beschreibung	...	Betrag"
                                    value={pasteArea}
                                    onChange={(e) => setPasteArea(e.target.value)}
                                    rows={4}
                                />
                                <div className="flex justify-end mt-2">
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={handlePasteProcess}
                                        disabled={!pasteArea.trim()}
                                    >
                                        Text verarbeiten
                                    </button>
                                </div>
                            </div>

                            {error && <div className="error-msg mt-4">⚠️ {error}</div>}
                            {success && (
                                <div style={{ color: '#16a34a', fontSize: '14px', marginTop: '12px', fontWeight: 600 }}>
                                    {success}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CSV Format Hint */}
                    <div className="card mb-6">
                        <div className="card-header">
                            <div className="card-title">ℹ️ CSV-Format</div>
                        </div>
                        <div className="card-body">
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                Unterstützte Spaltenbezeichnungen (kompatibel mit Sparkasse, ING, DKB, Commerzbank):
                            </p>
                            <code style={{
                                display: 'block',
                                background: 'var(--bg)',
                                padding: '12px 16px',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '12px',
                                color: 'var(--text)',
                                fontFamily: 'monospace',
                            }}>
                                Buchungstag;Buchungstext;Beguenstigter/Zahlungspflichtiger;Betrag<br />
                                oder:<br />
                                date;description;counterparty;amount
                            </code>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '12px' }}>
                                💡 <strong>Hinweis:</strong> Duplikate werden beim Import automatisch erkannt und ignoriert.
                                Du kannst also bedenkenlos Zeiträume hochladen, die sich überschneiden.
                            </p>
                        </div>
                    </div>

                    {/* Preview */}
                    {preview.length > 0 && (
                        <div className="card mb-6">
                            <div className="card-header">
                                <div className="card-title">👁️ Vorschau — {preview.length} Buchungen erkannt</div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => { setPreview([]); setFileName(''); }}>
                                        Abbrechen
                                    </button>
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={handleImport}
                                        disabled={loading}
                                    >
                                        {loading ? 'Importieren...' : `${preview.length} Buchungen importieren`}
                                    </button>
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Datum</th>
                                            <th>Beschreibung</th>
                                            <th>Gegenüber</th>
                                            <th>Kategorie</th>
                                            <th style={{ textAlign: 'right' }}>Betrag</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.slice(0, 30).map((row, i) => (
                                            <tr key={i}>
                                                <td style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>{row.date}</td>
                                                <td style={{ fontSize: '13px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {row.description}
                                                </td>
                                                <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{row.counterparty}</td>
                                                <td>
                                                    <span style={{
                                                        padding: '2px 8px',
                                                        borderRadius: '12px',
                                                        fontSize: '12px',
                                                        background: 'var(--primary-light)',
                                                        color: 'var(--navy)',
                                                    }}>
                                                        {row.category}
                                                    </span>
                                                </td>
                                                <td
                                                    className={`tx-amount ${row.amount >= 0 ? 'positive' : 'negative'}`}
                                                    style={{ textAlign: 'right', fontSize: '13px', whiteSpace: 'nowrap' }}
                                                >
                                                    {row.amount >= 0 ? '+' : ''}{row.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {preview.length > 30 && (
                                    <div style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                        … und {preview.length - 30} weitere Buchungen
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Anonymization Settings Hint */}
                    <div className="card mb-6">
                        <div className="card-header">
                            <div className="card-title">🛡️ Zu anonymisierende Namen</div>
                        </div>
                        <div className="card-body">
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                                Diese Namen werden beim Import in &quot;********&quot; umgwandelt, sowohl im Buchungstext als auch beim Empfänger/Absender.
                                Änderungen werden in deinem Browser gespeichert.
                            </p>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                                {namesToAnonymize.map(name => (
                                    <div key={name} style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        background: 'var(--bg)',
                                        border: '1px solid var(--border)',
                                        padding: '4px 10px',
                                        borderRadius: '16px',
                                        fontSize: '13px',
                                        color: 'var(--text)'
                                    }}>
                                        {name}
                                        <button
                                            onClick={() => handleRemoveName(name)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--text-muted)',
                                                cursor: 'pointer',
                                                padding: '0 2px',
                                                fontSize: '14px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            title="Entfernen"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: '8px', maxWidth: '400px' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Neuer Name (z.B. Max Mustermann)"
                                    value={newNameInput}
                                    onChange={(e) => setNewNameInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddName();
                                        }
                                    }}
                                />
                                <button className="btn btn-secondary" onClick={handleAddName}>
                                    Hinzufügen
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
