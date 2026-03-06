'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import Sidebar from '@/components/Sidebar';
import { type CategoryRule, applyRules } from '@/lib/categoryMatcher';

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
    balance: number;
    category: string;
}

interface CsvMapping {
    date: string;
    description: string;
    counterparty: string;
    amount: string;
    balance: string;
}

const MAPPING_STORAGE_KEY = 'csvColumnMapping';

const DATE_ALIASES = ['Datum', 'Buchungstag', 'date', 'Date', 'Buchungsdatum', 'Valutadatum'];
const DESCRIPTION_ALIASES = ['Verwendungszweck', 'Buchungstext', 'description', 'Description', 'Zahlungsreferenz', 'Betreff'];
const COUNTERPARTY_ALIASES = ['Name', 'Beguenstigter/Zahlungspflichtiger', 'counterparty', 'Auftraggeber', 'Payee', 'Empfänger', 'Zahlungsempfänger'];
const AMOUNT_ALIASES = ['Betrag (EUR)', 'Betrag', 'amount', 'Amount', 'Umsatz', 'Betrag (€)'];
const BALANCE_ALIASES = ['Saldo (EUR)', 'Saldo', 'balance', 'Balance', 'Kontostand', 'Saldo (€)'];

function autoDetect(cols: string[], aliases: string[]): string {
    return cols.find(c => aliases.some(a => a.toLowerCase() === c.toLowerCase())) || '';
}

function autoDetectMapping(cols: string[]): CsvMapping {
    return {
        date: autoDetect(cols, DATE_ALIASES),
        description: autoDetect(cols, DESCRIPTION_ALIASES),
        counterparty: autoDetect(cols, COUNTERPARTY_ALIASES),
        amount: autoDetect(cols, AMOUNT_ALIASES),
        balance: autoDetect(cols, BALANCE_ALIASES),
    };
}

function parseDate(raw: string): string {
    if (!raw) return '';
    if (raw.includes('.')) {
        const parts = raw.split('.');
        if (parts.length === 3) {
            let year = parts[2];
            if (year.length === 2) year = '20' + year;
            return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }
    return raw;
}


interface UploadClientProps {
    user: User;
}

const MAPPING_LABELS: { key: keyof CsvMapping; label: string; optional?: boolean }[] = [
    { key: 'date', label: 'Datum' },
    { key: 'description', label: 'Beschreibung' },
    { key: 'counterparty', label: 'Gegenüber' },
    { key: 'amount', label: 'Betrag' },
    { key: 'balance', label: 'Saldo', optional: true },
];

export default function UploadClient({ user }: UploadClientProps) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<PreviewRow[]>([]);
    const [dragging, setDragging] = useState(false);
    const [fileName, setFileName] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    const [formatOpen, setFormatOpen] = useState(false);
    const [namesToAnonymize, setNamesToAnonymize] = useState<string[]>([]);
    const [newNameInput, setNewNameInput] = useState('');
    const [pasteArea, setPasteArea] = useState('');
    const [pasteOpen, setPasteOpen] = useState(false);

    const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [mapping, setMapping] = useState<CsvMapping>({ date: '', description: '', counterparty: '', amount: '', balance: '' });
    const [mappingFromStorage, setMappingFromStorage] = useState(false);

    const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([]);
    const [categoryColors, setCategoryColors] = useState<Record<string, string>>({});

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

    useEffect(() => {
        fetch('/api/category-rules')
            .then(r => r.json())
            .then(data => { if (Array.isArray(data)) setCategoryRules(data); })
            .catch(() => {});
        fetch('/api/categories')
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data)) {
                    const map: Record<string, string> = {};
                    for (const cat of data) map[cat.name] = cat.color;
                    setCategoryColors(map);
                }
            })
            .catch(() => {});
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

    const applyMapping = useCallback((rows: Record<string, string>[], m: CsvMapping) => {
        const parsed: PreviewRow[] = rows.map((row) => {
            const date = parseDate(row[m.date] || '');
            const description = anonymizeText(row[m.description] || '');
            const counterparty = anonymizeText(row[m.counterparty] || '');
            const amountStr = row[m.amount] || '0';
            const amount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
            const balanceStr = m.balance ? (row[m.balance] || '0') : '0';
            const balance = parseFloat(balanceStr.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
            const category = applyRules(categoryRules, description, counterparty);
            return { date, description, counterparty, amount, balance, category };
        }).filter((r) => r.date && r.amount !== 0);
        setPreview(parsed);
        localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(m));
    }, [anonymizeText, categoryRules]);

    const processCSV = useCallback((file: File) => {
        setFileName(file.name);
        setError('');
        setSuccess('');
        setPreview([]);
        setRawRows([]);
        setColumns([]);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            encoding: 'ISO-8859-1',
            complete: (results) => {
                const rows = results.data as Record<string, string>[];
                const cols = (results.meta.fields || []).filter(Boolean);
                setRawRows(rows);
                setColumns(cols);

                const saved = localStorage.getItem(MAPPING_STORAGE_KEY);
                let detectedMapping: CsvMapping;
                let fromStorage = false;
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved) as CsvMapping;
                        const allValid = Object.values(parsed).every(v => !v || cols.includes(v));
                        if (allValid) {
                            detectedMapping = parsed;
                            fromStorage = true;
                        } else {
                            detectedMapping = autoDetectMapping(cols);
                        }
                    } catch {
                        detectedMapping = autoDetectMapping(cols);
                    }
                } else {
                    detectedMapping = autoDetectMapping(cols);
                }
                setMapping(detectedMapping);
                setMappingFromStorage(fromStorage);
            },
            error: () => setError('CSV-Datei konnte nicht gelesen werden.'),
        });
    }, []);

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
            const category = applyRules(categoryRules, description, counterparty);

            return { date, description, counterparty, amount, balance: 0, category };
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
            setTimeout(() => { window.location.href = '/dashboard'; }, 3500);
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
                    {/* CSV Format Hint */}
                    <div className="card mb-6">
                        <div
                            className="card-header"
                            onClick={() => setFormatOpen(o => !o)}
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                            <div className="card-title">ℹ️ CSV-Format</div>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatOpen ? '▲ schließen' : '▼ anzeigen'}</span>
                        </div>
                        {formatOpen && (
                            <div className="card-body">
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                    <strong>Trennzeichen:</strong> Semikolon (;) oder Komma (,) – wird automatisch erkannt.
                                </p>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                    <strong>Zeichenkodierung:</strong> ISO-8859-1 und UTF-8 werden unterstützt (kompatibel mit Sparkasse, ING, DKB, Commerzbank u.a.).
                                </p>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                    <strong>Duplikate:</strong> Bereits vorhandene Buchungen werden beim Import automatisch erkannt und ignoriert – Zeiträume dürfen sich überschneiden.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Drop Zone */}
                    <div className="card mb-6">
                        <div className="card-body">
                            <div
                                className={`upload-zone ${dragging ? 'drag-over' : ''}`}
                                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={handleDrop}
                            >
                                <div className="upload-zone-icon">📄</div>
                                <h3>{fileName || 'CSV-Datei hier ablegen'}</h3>
                                <p style={{ marginBottom: '12px' }}>oder direkt auswählen:</p>
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    type="button"
                                >
                                    {fileName ? 'Andere Datei wählen' : 'Datei auswählen'}
                                </button>
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
                                    <h4
                                        onClick={() => setPasteOpen(o => !o)}
                                        style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        Oder Daten hier einfügen
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>{pasteOpen ? '▲' : '▼ anzeigen'}</span>
                                    </h4>
                                </div>
                                {pasteOpen && (
                                    <>
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
                                    </>
                                )}
                            </div>

                            {error && <div className="error-msg mt-4">⚠️ {error}</div>}
                            {success && (
                                <div style={{ color: '#16a34a', fontSize: '14px', marginTop: '12px', fontWeight: 600 }}>
                                    {success}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Column Mapping */}
                    {columns.length > 0 && preview.length === 0 && (
                        <div className="card mb-6">
                            <div className="card-header">
                                <div className="card-title">🗂️ Spaltenzuordnung</div>
                                {mappingFromStorage && (
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>gespeichertes Mapping geladen</span>
                                )}
                            </div>
                            <div className="card-body">
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                                    Welche Spalte der CSV enthält welche Information? Das Mapping wird für den nächsten Import gespeichert.
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px 16px', alignItems: 'center', maxWidth: '480px', marginBottom: '20px' }}>
                                    {MAPPING_LABELS.map(({ key, label }) => (
                                        <React.Fragment key={key}>
                                            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>
                                                {label}
                                            </label>
                                            <select
                                                className="form-input"
                                                style={{ fontSize: '13px', padding: '6px 10px' }}
                                                value={mapping[key]}
                                                onChange={(e) => setMapping(m => ({ ...m, [key]: e.target.value }))}
                                            >
                                                <option value="">— nicht zugeordnet —</option>
                                                {columns.map(col => (
                                                    <option key={col} value={col}>{col}</option>
                                                ))}
                                            </select>
                                        </React.Fragment>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => applyMapping(rawRows, mapping)}
                                        disabled={!mapping.date || !mapping.amount}
                                    >
                                        Vorschau generieren
                                    </button>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => { setColumns([]); setRawRows([]); setFileName(''); }}
                                    >
                                        Abbrechen
                                    </button>
                                </div>
                                {(!mapping.date || !mapping.amount) && (
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                        Datum und Betrag müssen zugeordnet sein.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Preview */}
                    {preview.length > 0 && (
                        <div className="card mb-6">
                            <div className="card-header">
                                <div className="card-title">👁️ Vorschau — {preview.length} Buchungen erkannt</div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => { setPreview([]); setColumns([]); setRawRows([]); setFileName(''); }}>
                                        Abbrechen
                                    </button>
                                    {rawRows.length > 0 && (
                                        <button className="btn btn-secondary btn-sm" onClick={() => setPreview([])}>
                                            Mapping anpassen
                                        </button>
                                    )}
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
                                            <th>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    Datum
                                                    <span style={{ position: 'relative', display: 'inline-flex' }} className="date-info-icon">
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            width: '14px',
                                                            height: '14px',
                                                            borderRadius: '50%',
                                                            background: 'var(--text-muted)',
                                                            color: '#fff',
                                                            fontSize: '9px',
                                                            fontWeight: 700,
                                                            cursor: 'default',
                                                            flexShrink: 0,
                                                        }}>i</span>
                                                        <span style={{
                                                            display: 'none',
                                                            position: 'absolute',
                                                            top: '18px',
                                                            left: '0',
                                                            background: 'var(--card)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: 'var(--radius-sm)',
                                                            padding: '6px 10px',
                                                            fontSize: '12px',
                                                            color: 'var(--text)',
                                                            whiteSpace: 'nowrap',
                                                            zIndex: 50,
                                                            boxShadow: 'var(--shadow)',
                                                            fontWeight: 400,
                                                        }} className="date-info-tooltip">
                                                            Vorschau: JJJJ-MM-TT · Im Dashboard: TT.MM.JJJJ
                                                        </span>
                                                    </span>
                                                </span>
                                            </th>
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
                                                <td style={{ fontSize: '13px' }}>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 5,
                                                        padding: '2px 8px', borderRadius: 12,
                                                        background: categoryColors[row.category] ? categoryColors[row.category] + '22' : '#f3f4f6',
                                                        color: categoryColors[row.category] || '#6b7280',
                                                        fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                                                    }}>
                                                        {row.category !== 'Nicht kategorisiert' && (
                                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: categoryColors[row.category] || '#6b7280', flexShrink: 0 }} />
                                                        )}
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
