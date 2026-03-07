'use client';

import React, { useRef, useState, useMemo } from 'react';
import type { TransactionReceipt } from '@/lib/data';
import LinkReceiptModal from './LinkReceiptModal';
import BelegeKiWorkflow from './BelegeKiWorkflow';

function formatSize(bytes: number | null | undefined): string {
    if (!bytes) return '–';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(amount);
}

interface UnlinkedReceipt {
    id: string;
    file_name: string;
    file_size: number | null;
    uploaded_at: string;
    ai_vendor: string | null;
    ai_amount: number | null;
    ai_date: string | null;
    ai_description: string | null;
    ai_suggestions: Suggestion[] | null;
}

interface Suggestion {
    transaction_id: string;
    confidence: number;
    reason: string;
    transaction: { id: string; date: string; description: string; counterparty: string; amount: number; category: string };
}

interface SuggestResult {
    extracted: { vendor?: string; amount?: number; date?: string; description?: string };
    suggestions: Suggestion[];
}

interface Props {
    receipts: TransactionReceipt[];
    unlinked: UnlinkedReceipt[];
    initialTab: string;
}

export default function VerwaltungBelegeClient({ receipts: initialReceipts, unlinked: initialUnlinked, initialTab }: Props) {
    const tab = initialTab as 'linked' | 'unlinked' | 'ki' | 'ki-workflow';
    const [receipts, setReceipts] = useState(initialReceipts);
    const [unlinked, setUnlinked] = useState(initialUnlinked);
    const [search, setSearch] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [loadingUrl, setLoadingUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [linkModal, setLinkModal] = useState<{ id: string; fileName: string } | null>(null);
    const [suggestingId, setSuggestingId] = useState<string | null>(null);
    const [suggestionResults, setSuggestionResults] = useState<Record<string, SuggestResult>>(() => {
        const initial: Record<string, SuggestResult> = {};
        for (const r of initialUnlinked) {
            if (r.ai_vendor || r.ai_amount != null || r.ai_date || r.ai_description || r.ai_suggestions?.length) {
                initial[r.id] = {
                    extracted: {
                        vendor: r.ai_vendor ?? undefined,
                        amount: r.ai_amount ?? undefined,
                        date: r.ai_date ?? undefined,
                        description: r.ai_description ?? undefined,
                    },
                    suggestions: r.ai_suggestions ?? [],
                };
            }
        }
        return initial;
    });
    const fileRef = useRef<HTMLInputElement>(null);

    const filtered = useMemo(() => {
        if (!search.trim()) return receipts;
        const term = search.toLowerCase();
        return receipts.filter(r =>
            r.transaction_description.toLowerCase().includes(term) ||
            r.transaction_counterparty.toLowerCase().includes(term) ||
            r.transaction_category.toLowerCase().includes(term) ||
            r.file_name.toLowerCase().includes(term)
        );
    }, [receipts, search]);

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/receipts', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.id) setUnlinked(prev => [{ ...data, ai_vendor: null, ai_amount: null, ai_date: null, ai_description: null }, ...prev]);
        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
    }

    async function handleSuggest(r: UnlinkedReceipt) {
        setSuggestingId(r.id);
        try {
            const res = await fetch(`/api/receipts/${r.id}/suggest`, { method: 'POST' });
            const text = await res.text();
            const data = text ? JSON.parse(text) : {};
            if (data.suggestions) {
                setSuggestionResults(prev => ({ ...prev, [r.id]: data }));
                // Update local state with saved AI data
                setUnlinked(prev => prev.map(u => u.id === r.id ? {
                    ...u,
                    ai_vendor: data.extracted?.vendor ?? null,
                    ai_amount: data.extracted?.amount ?? null,
                    ai_date: data.extracted?.date ?? null,
                    ai_description: data.extracted?.description ?? null,
                } : u));
            } else {
                alert('KI-Analyse fehlgeschlagen: ' + (data.error ?? 'Unbekannter Fehler') + (data.raw ? '\n\nRohantwort:\n' + data.raw.slice(0, 500) : ''));
            }
        } catch (e: any) {
            alert('Fehler bei der KI-Analyse: ' + e.message);
        } finally {
            setSuggestingId(null);
        }
    }

    async function handleLinkSuggestion(receiptId: string, tx: Suggestion['transaction']) {
        await fetch(`/api/receipts/${receiptId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transaction_id: tx.id }),
        });
        handleLinked(receiptId, tx);
        setSuggestionResults(prev => { const next = { ...prev }; delete next[receiptId]; return next; });
    }

    async function handleOpenLinked(r: TransactionReceipt) {
        setLoadingUrl(r.id);
        const res = await fetch(`/api/transactions/${r.transaction_id}/receipts`);
        const data = await res.json();
        const found = Array.isArray(data) ? data.find((x: any) => x.id === r.id) : null;
        if (found?.url) window.open(found.url, '_blank');
        setLoadingUrl(null);
    }

    async function handleDeleteLinked(r: TransactionReceipt) {
        if (!confirm(`Beleg „${r.file_name}" wirklich löschen?`)) return;
        setDeletingId(r.id);
        await fetch(`/api/transactions/${r.transaction_id}/receipts/${r.id}`, { method: 'DELETE' });
        setReceipts(prev => prev.filter(x => x.id !== r.id));
        setDeletingId(null);
    }

    async function handleDeleteUnlinked(r: UnlinkedReceipt) {
        if (!confirm(`Beleg „${r.file_name}" wirklich löschen?`)) return;
        setDeletingId(r.id);
        await fetch(`/api/receipts/${r.id}`, { method: 'DELETE' });
        setUnlinked(prev => prev.filter(x => x.id !== r.id));
        setSuggestionResults(prev => { const next = { ...prev }; delete next[r.id]; return next; });
        setDeletingId(null);
    }

    function handleLinked(receiptId: string, tx: { id: string; date: string; description: string; counterparty: string; amount: number; category: string }) {
        const receipt = unlinked.find(r => r.id === receiptId);
        if (!receipt) return;
        setUnlinked(prev => prev.filter(r => r.id !== receiptId));
        setReceipts(prev => [{
            ...receipt,
            transaction_id: tx.id,
            file_path: '',
            transaction_date: tx.date,
            transaction_description: tx.description,
            transaction_counterparty: tx.counterparty,
            transaction_amount: tx.amount,
            transaction_category: tx.category,
        }, ...prev]);
        setLinkModal(null);
    }

    return (
        <div>
            {/* Tab Nav */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 24 }}>
                <a href="/verwaltung/belege?tab=linked" style={{
                    padding: '8px 20px', fontSize: 13, fontWeight: tab === 'linked' ? 600 : 500,
                    color: tab === 'linked' ? 'var(--navy)' : 'var(--text-muted)',
                    borderBottom: tab === 'linked' ? '2px solid var(--primary)' : '2px solid transparent',
                    marginBottom: -2, textDecoration: 'none', whiteSpace: 'nowrap',
                }}>
                    Zugeordnete Belege {receipts.length > 0 && <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}>({receipts.length})</span>}
                </a>
                <a href="/verwaltung/belege?tab=unlinked" style={{
                    padding: '8px 20px', fontSize: 13, fontWeight: tab === 'unlinked' ? 600 : 500,
                    color: tab === 'unlinked' ? 'var(--navy)' : (unlinked.length > 0 ? 'var(--red)' : 'var(--text-muted)'),
                    borderBottom: tab === 'unlinked' ? '2px solid var(--primary)' : '2px solid transparent',
                    marginBottom: -2, textDecoration: 'none', whiteSpace: 'nowrap',
                }}>
                    Unzugeordnete Belege {unlinked.length > 0 && <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}>({unlinked.length})</span>}
                </a>
                <a href="/verwaltung/belege?tab=ki" style={{
                    padding: '8px 20px', fontSize: 13, fontWeight: tab === 'ki' ? 600 : 500,
                    color: tab === 'ki' ? 'var(--navy)' : 'var(--text-muted)',
                    borderBottom: tab === 'ki' ? '2px solid var(--primary)' : '2px solid transparent',
                    marginBottom: -2, textDecoration: 'none', whiteSpace: 'nowrap',
                }}>
                    KI-Belegfunktion
                </a>
                <a href="/verwaltung/belege?tab=ki-workflow" style={{
                    padding: '8px 20px', fontSize: 13, fontWeight: tab === 'ki-workflow' ? 600 : 500,
                    color: tab === 'ki-workflow' ? 'var(--navy)' : 'var(--text-muted)',
                    borderBottom: tab === 'ki-workflow' ? '2px solid var(--primary)' : '2px solid transparent',
                    marginBottom: -2, textDecoration: 'none', whiteSpace: 'nowrap',
                }}>
                    KI Workflow
                </a>
            </div>

            {/* Stats */}
            {tab !== 'ki-workflow' && <div className="stats-grid mb-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <div className="stat-card" style={{ padding: '12px 16px' }}>
                    <div className="stat-card-label">📎 Belege gesamt</div>
                    <div className="stat-card-value" style={{ fontSize: 20 }}>{receipts.length + unlinked.length}</div>
                    <div className="stat-card-sub">Hochgeladene Dateien</div>
                </div>
                <div className="stat-card" style={{ padding: '12px 16px' }}>
                    <div className="stat-card-label">🔗 Zugeordnet</div>
                    <div className="stat-card-value" style={{ fontSize: 20 }}>{receipts.length}</div>
                    <div className="stat-card-sub">Mit Buchung verknüpft</div>
                </div>
                <div className="stat-card" style={{ padding: '12px 16px' }}>
                    <div className="stat-card-label" style={{ color: unlinked.length > 0 ? 'var(--red)' : 'var(--text-muted)' }}>⚠️ Nicht zugeordnet</div>
                    <div className="stat-card-value" style={{ fontSize: 20, color: unlinked.length > 0 ? 'var(--red)' : 'var(--text)' }}>{unlinked.length}</div>
                    <div className="stat-card-sub">Noch keine Buchung</div>
                </div>
                <div className="stat-card" style={{ padding: '12px 16px' }}>
                    <div className="stat-card-label">💾 Gesamtgröße</div>
                    <div className="stat-card-value" style={{ fontSize: 20 }}>
                        {formatSize([...receipts, ...unlinked].reduce((s, r) => s + (r.file_size || 0), 0))}
                    </div>
                    <div className="stat-card-sub">Speicherverbrauch</div>
                </div>
            </div>}

            {/* Tab: Unzugeordnete Belege */}
            {tab === 'unlinked' && (
            <div className="card mb-6">
                <div className="card-header" style={{ justifyContent: 'space-between' }}>
                    <div className="card-title">⚠️ Nicht zugeordnete Belege</div>
                    <div>
                        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
                        <button
                            className="btn btn-primary"
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                            style={{ opacity: uploading ? 0.6 : 1 }}
                        >
                            {uploading ? 'Hochladen…' : '+ Beleg hochladen'}
                        </button>
                    </div>
                </div>
                {unlinked.length === 0 ? (
                    <div className="card-body" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                        Alle Belege sind einer Buchung zugeordnet.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Dateiname</th>
                                    <th>Buchung zuordnen</th>
                                    <th style={{ textAlign: 'right' }}>Größe</th>
                                    <th style={{ width: '1%', whiteSpace: 'nowrap' }}>Hochgeladen am</th>
                                    <th style={{ width: '1%' }} />
                                </tr>
                            </thead>
                            <tbody>
                                {unlinked.map(r => (
                                    <tr key={r.id}>
                                        <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                                            <button
                                                onClick={async () => {
                                                    const res = await fetch(`/api/receipts/${r.id}`);
                                                    const data = await res.json();
                                                    if (data.url) window.open(data.url, '_blank');
                                                }}
                                                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, color: 'inherit' }}
                                                title="Öffnen"
                                            >
                                                <span>{r.file_name.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}</span>
                                                <span style={{ textDecoration: 'underline' }}>{r.file_name}</span>
                                            </button>
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => setLinkModal({ id: r.id, fileName: r.file_name })}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 6,
                                                    padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                                                    border: '1px dashed var(--border)', background: 'var(--bg)',
                                                    cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)',
                                                    whiteSpace: 'nowrap', minWidth: 360, justifyContent: 'flex-start',
                                                }}
                                            >
                                                <span style={{ opacity: 0.5 }}>🔗</span>
                                                <span>Buchung wählen…</span>
                                            </button>
                                        </td>
                                        <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {formatSize(r.file_size)}
                                        </td>
                                        <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-muted)' }}>
                                            {new Date(r.uploaded_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => handleDeleteUnlinked(r)}
                                                disabled={deletingId === r.id}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--red)', padding: '2px 4px', opacity: deletingId === r.id ? 0.5 : 1 }}
                                                title="Löschen"
                                            >
                                                🗑
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            )}

            {/* Tab: KI-Belegfunktion */}
            {tab === 'ki' && (
            <div className="card mb-6">
                <div className="card-header">
                    <div className="card-title">✨ KI-Beleganalyse</div>
                </div>
                {unlinked.length === 0 ? (
                    <div className="card-body" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                        Keine unzugeordneten Belege vorhanden.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Dateiname</th>
                                    <th>KI-Analyse</th>
                                    <th style={{ textAlign: 'right' }}>Größe</th>
                                    <th style={{ width: '1%', whiteSpace: 'nowrap' }}>Hochgeladen am</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unlinked.map(r => (
                                    <React.Fragment key={r.id}>
                                        <tr>
                                            <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                                                <button
                                                    onClick={async () => {
                                                        const res = await fetch(`/api/receipts/${r.id}`);
                                                        const data = await res.json();
                                                        if (data.url) window.open(data.url, '_blank');
                                                    }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, color: 'inherit' }}
                                                    title="Öffnen"
                                                >
                                                    <span>{r.file_name.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}</span>
                                                    <span style={{ textDecoration: 'underline' }}>{r.file_name}</span>
                                                </button>
                                            </td>
                                            <td>
                                                <button
                                                    onClick={() => handleSuggest(r)}
                                                    disabled={suggestingId === r.id}
                                                    title="KI-Vorschlag generieren"
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 5,
                                                        padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                                                        border: '1px solid var(--border)', background: 'var(--bg)',
                                                        cursor: suggestingId === r.id ? 'default' : 'pointer',
                                                        fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap',
                                                        opacity: suggestingId === r.id ? 0.6 : 1,
                                                    }}
                                                >
                                                    <span>{suggestingId === r.id ? '⏳' : '✨'}</span>
                                                    <span>{suggestingId === r.id ? 'Analysiere…' : (suggestionResults[r.id] ? 'Neu analysieren' : 'KI-Vorschlag')}</span>
                                                </button>
                                            </td>
                                            <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                {formatSize(r.file_size)}
                                            </td>
                                            <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-muted)' }}>
                                                {new Date(r.uploaded_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                        </tr>

                                        {/* KI-Vorschläge */}
                                        {suggestionResults[r.id] && (
                                            <tr key={`${r.id}-suggestions`}>
                                                <td colSpan={4} style={{ padding: '0 16px 12px', background: 'var(--bg)' }}>
                                                    <div style={{ borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                                        {/* Extracted info */}
                                                        {(() => {
                                                            const ex = suggestionResults[r.id].extracted;
                                                            const hasData = ex.vendor || ex.amount != null || ex.date || ex.description;
                                                            const filenameNums = (r.file_name.match(/\d{4,}/g) || []);
                                                            return (
                                                                <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderBottom: suggestionResults[r.id].suggestions.length > 0 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12, alignItems: 'center' }}>
                                                                    <span style={{ color: 'var(--text-muted)' }}>✨ KI-Analyse:</span>
                                                                    {ex.vendor && <span><strong>Aussteller:</strong> {ex.vendor}</span>}
                                                                    {ex.amount != null && <span><strong>Betrag:</strong> {formatCurrency(ex.amount!)}</span>}
                                                                    {ex.date && <span><strong>Datum:</strong> {new Date(ex.date!).toLocaleDateString('de-DE')}</span>}
                                                                    {ex.description && <span><strong>Zweck:</strong> {ex.description}</span>}
                                                                    {!hasData && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Beleginhalt nicht lesbar</span>}
                                                                    {!hasData && filenameNums.length > 0 && <span><strong>Nummer aus Dateiname:</strong> {filenameNums.join(', ')}</span>}
                                                                    <button onClick={() => setSuggestionResults(prev => { const next = { ...prev }; delete next[r.id]; return next; })} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}>✕</button>
                                                                </div>
                                                            );
                                                        })()}
                                                        {/* Suggestions */}
                                                        {suggestionResults[r.id].suggestions.length === 0 && (
                                                            <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                                                                Keine passende Buchung gefunden – bitte manuell zuordnen.
                                                            </div>
                                                        )}
                                                        {suggestionResults[r.id].suggestions.map((s, i) => (
                                                            <div key={s.transaction_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < suggestionResults[r.id].suggestions.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                                                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0, color: s.confidence > 0.8 ? 'var(--green)' : 'var(--text-muted)' }}>
                                                                    {Math.round(s.confidence * 100)}%
                                                                </div>
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                        {new Date(s.transaction.date).toLocaleDateString('de-DE')} · {s.transaction.counterparty || s.transaction.description}
                                                                        <span className={`tx-amount ${s.transaction.amount >= 0 ? 'positive' : 'negative'}`} style={{ marginLeft: 8 }}>
                                                                            {(s.transaction.amount >= 0 ? '+' : '') + formatCurrency(s.transaction.amount)}
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{s.reason}</div>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleLinkSuggestion(r.id, s.transaction)}
                                                                    className="btn btn-primary"
                                                                    style={{ fontSize: 12, padding: '5px 12px', whiteSpace: 'nowrap' }}
                                                                >
                                                                    Zuordnen
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            )}

            {/* Tab: KI Workflow */}
            {tab === 'ki-workflow' && <BelegeKiWorkflow />}

            {/* Tab: Zugeordnete Belege */}
            {tab === 'linked' && (
            <div className="card">
                <div className="card-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div className="card-title">📎 Zugeordnete Belege</div>
                    <input
                        type="text"
                        placeholder="Suchen…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="form-input"
                        style={{ padding: '8px 12px', width: 240 }}
                    />
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: '1%', whiteSpace: 'nowrap' }}>Buchungsdatum</th>
                                <th>Beschreibung</th>
                                <th>Gegenüber</th>
                                <th>Kategorie</th>
                                <th style={{ textAlign: 'right' }}>Betrag</th>
                                <th>Dateiname</th>
                                <th style={{ textAlign: 'right' }}>Größe</th>
                                <th style={{ width: '1%', whiteSpace: 'nowrap' }}>Hochgeladen am</th>
                                <th style={{ width: '1%' }} />
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                                        {search ? 'Keine Belege gefunden.' : 'Noch keine zugeordneten Belege.'}
                                    </td>
                                </tr>
                            ) : filtered.map(r => (
                                <tr key={r.id}>
                                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 13 }}>
                                        {r.transaction_date ? new Date(r.transaction_date).toLocaleDateString('de-DE') : '–'}
                                    </td>
                                    <td style={{ fontSize: 13, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        <span title={r.transaction_description}>{r.transaction_description || '–'}</span>
                                    </td>
                                    <td style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {r.transaction_counterparty || '–'}
                                    </td>
                                    <td style={{ fontSize: 13 }}>
                                        <span className="category-badge" style={{ fontSize: 11 }}>{r.transaction_category || '–'}</span>
                                    </td>
                                    <td className={`tx-amount ${r.transaction_amount >= 0 ? 'positive' : 'negative'}`} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                        {(r.transaction_amount >= 0 ? '+' : '') + formatCurrency(r.transaction_amount)}
                                    </td>
                                    <td style={{ fontSize: 13 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span>{r.file_name.toLowerCase().endsWith('.pdf') ? '📄' : '🖼️'}</span>
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }} title={r.file_name}>{r.file_name}</span>
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                        {formatSize(r.file_size)}
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-muted)' }}>
                                        {new Date(r.uploaded_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap' }}>
                                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                            <button
                                                onClick={() => handleOpenLinked(r)}
                                                disabled={loadingUrl === r.id}
                                                style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', opacity: loadingUrl === r.id ? 0.5 : 1, whiteSpace: 'nowrap' }}
                                            >
                                                Öffnen ↗
                                            </button>
                                            <button
                                                onClick={() => handleDeleteLinked(r)}
                                                disabled={deletingId === r.id}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--red)', padding: '2px 4px', opacity: deletingId === r.id ? 0.5 : 1 }}
                                                title="Löschen"
                                            >
                                                🗑
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            {linkModal && (
                <LinkReceiptModal
                    receiptId={linkModal.id}
                    fileName={linkModal.fileName}
                    onLinked={handleLinked}
                    onClose={() => setLinkModal(null)}
                />
            )}
        </div>
    );
}
